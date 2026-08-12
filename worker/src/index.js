/**
 * NutriTrack push backend — Cloudflare Workers edition.
 *
 * Same contract as the Node server in `server/`, and the same privacy
 * position: it stores a push endpoint, a schedule, a UTC offset and two date
 * flags, and sends only a wake-up signal. The notification text is written on
 * the device by the service worker.
 *
 * Why this exists alongside the Node version: Workers has a real cron trigger,
 * so the schedule runs every minute without an always-on process and without
 * an external pinger. That is the whole reason reminders are accurate here and
 * approximate on a sleeping free tier elsewhere.
 */

import { decide } from '../../server/src/schedule-core.js';
import { sendPush } from './push.js';
import {
  upsertSubscription, updatePrefs, getById, removeSubscription, listActive,
  countSubscriptions, publicView, markWaterSent, markStreakSent, noteFailure, pruneStale,
} from './db.js';

/* ──────────────────────────────── Helpers ──────────────────────────────── */

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allowed.includes('*')) headers['Access-Control-Allow-Origin'] = '*';
  else if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return headers;
}

const vapidFrom = (env) => ({
  publicKey: env.VAPID_PUBLIC_KEY,
  privateKey: env.VAPID_PRIVATE_KEY,
  subject: env.VAPID_SUBJECT || 'mailto:nobody@example.com',
});

const vapidConfigured = (env) => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

/** Constant-time string compare, so a secret cannot be guessed byte by byte. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

const MAX_BODY = 8 * 1024;

async function readJson(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new Error('Body too large');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON');
  }
}

/* ────────────────────────────── The schedule ────────────────────────────── */

/**
 * One scheduler pass. Shared by the cron trigger and the manual tick endpoint.
 *
 * Sends are issued concurrently — a Worker has a wall-clock budget, and doing
 * a few hundred round trips to push services one at a time would exhaust it.
 */
export async function runTick(env, at = Date.now()) {
  const db = env.DB;
  const stats = { checked: 0, sent: 0, pruned: 0, failed: 0 };
  if (!vapidConfigured(env)) return stats;

  const rows = await listActive(db);
  stats.checked = rows.length;
  const vapid = vapidFrom(env);

  const jobs = [];
  for (const row of rows) {
    for (const job of decide(row, at)) jobs.push({ row, job });
  }

  const results = await Promise.all(
    jobs.map(async ({ row, job }) => {
      const result = await sendPush(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        { kind: job.kind, sentAt: at },
        vapid,
        { topic: job.kind }
      );
      return { row, job, result };
    })
  );

  const writes = [];
  for (const { row, job, result } of results) {
    if (result.expired) {
      stats.pruned++;
      writes.push(removeSubscription(db, row.id));
      continue;
    }
    if (result.ok) stats.sent++;
    else {
      stats.failed++;
      writes.push(noteFailure(db, row.id));
    }
    // Record the attempt either way, so a persistently failing endpoint is not
    // retried every single minute forever.
    writes.push(
      job.kind === 'water' ? markWaterSent(db, row.id, at) : markStreakSent(db, row.id, job.day)
    );
  }
  await Promise.all(writes);

  return stats;
}

/* ──────────────────────────────── Routes ──────────────────────────────── */

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const db = env.DB;

  if (request.method === 'GET' && (path === '/' || path === '/health')) {
    return json({
      service: 'nutritrack-push',
      runtime: 'cloudflare-workers',
      ok: true,
      vapidConfigured: vapidConfigured(env),
      publicKey: env.VAPID_PUBLIC_KEY || null,
      subscriptions: await countSubscriptions(db),
    });
  }

  if (request.method === 'GET' && path === '/api/vapid-public-key') {
    if (!vapidConfigured(env)) return json({ error: 'Server has no VAPID keys configured' }, 503);
    return json({ publicKey: env.VAPID_PUBLIC_KEY });
  }

  if (request.method === 'POST' && path === '/api/subscribe') {
    if (!vapidConfigured(env)) return json({ error: 'Server has no VAPID keys configured' }, 503);
    const body = await readJson(request);
    if (!body?.subscription?.endpoint) return json({ error: 'Missing subscription' }, 400);
    const row = await upsertSubscription(db, { subscription: body.subscription, prefs: body.prefs });
    return json(publicView(row));
  }

  const subMatch = path.match(/^\/api\/subscribe\/([\w-]+)$/);
  if (subMatch) {
    const id = subMatch[1];

    if (request.method === 'GET') {
      const row = await getById(db, id);
      return row ? json(publicView(row)) : json({ error: 'Unknown subscription' }, 404);
    }
    if (request.method === 'PATCH') {
      const row = await updatePrefs(db, id, await readJson(request));
      // The client treats this 404 as "re-register me", so the status matters
      // more than the message.
      return row ? json(publicView(row)) : json({ error: 'Unknown subscription' }, 404);
    }
    if (request.method === 'DELETE') {
      return json({ removed: await removeSubscription(db, id) });
    }
  }

  const testMatch = path.match(/^\/api\/test\/([\w-]+)$/);
  if (request.method === 'POST' && testMatch) {
    const row = await getById(db, testMatch[1]);
    if (!row) return json({ error: 'Unknown subscription' }, 404);
    const result = await sendPush(
      { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
      { kind: 'test', sentAt: Date.now() },
      vapidFrom(env),
      { topic: 'test' }
    );
    if (result.expired) await removeSubscription(db, row.id);
    return json(result, result.ok ? 200 : 502);
  }

  /* Manual tick. The cron trigger below is the normal path; this exists for
     testing and for anyone who would rather drive the schedule themselves. */
  if (request.method === 'POST' && path === '/api/tick') {
    if (!env.TICK_SECRET) return json({ error: 'TICK_SECRET is not set on this server' }, 503);
    const provided =
      request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('key');
    if (!safeEqual(provided, env.TICK_SECRET)) return json({ error: 'Unauthorized' }, 401);
    return json({ ok: true, ...(await runTick(env)) });
  }

  return json({ error: 'Not found' }, 404);
}

/* ──────────────────────────────── Worker ──────────────────────────────── */

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      const res = await handle(request, env);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      const isClient = /Invalid JSON|Body too large|Malformed/.test(err.message);
      if (!isClient) console.error('[worker]', err);
      const res = json({ error: isClient ? err.message : 'Internal error' }, isClient ? 400 : 500);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    }
  },

  /**
   * Cron trigger — every minute, per wrangler.toml.
   *
   * This is the payoff of running on Workers: no always-on process to pay for,
   * no external pinger, and to-the-minute accuracy.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const stats = await runTick(env, event.scheduledTime || Date.now());
        if (stats.sent || stats.pruned || stats.failed) {
          console.log(`[cron] ${JSON.stringify(stats)}`);
        }
        // Housekeeping once an hour, on the hour.
        if (new Date().getUTCMinutes() === 0) {
          const removed = await pruneStale(env.DB);
          if (removed) console.log(`[cron] pruned ${removed} stale subscription(s)`);
        }
      })()
    );
  },
};
