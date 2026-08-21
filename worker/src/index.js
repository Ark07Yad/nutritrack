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

/* ───────────────────────────── Abuse limits ─────────────────────────────
 *
 * Two layers, because they stop different things.
 *
 * The allowlist below is the one that matters. `POST /api/subscribe` is
 * necessarily unauthenticated — a browser has no credential to offer before it
 * subscribes — so without it anyone could write unlimited rows into D1 by
 * posting made-up endpoints. Requiring the endpoint to belong to a real push
 * service closes that off completely, because an attacker cannot mint FCM or
 * Mozilla endpoints at will. It costs a legitimate browser nothing: the
 * endpoint is issued by the browser's own push service, not chosen by us.
 *
 * The rate limiter is the second layer, and deliberately generous. Limits that
 * are too tight break real users, because whole networks share one address —
 * a university, an office, or a mobile carrier behind CGNAT can put thousands
 * of people on the IP this keys on. Anything a normal user does sits orders of
 * magnitude below these numbers: the client debounces for 1.5s and only syncs
 * when the schedule or a done-flag actually changes, so a heavy day is a
 * handful of requests, not hundreds.
 *
 * ── Why this counts in memory rather than using Cloudflare's binding ──
 *
 * The obvious implementation is the platform's own rate-limiting binding. It
 * was tried first and it does not enforce on this plan: the binding is present
 * and `limit()` resolves, but it answered `{ success: true }` to all thirty
 * calls of a fixed key against a limit of twenty. A limiter that always says
 * yes is worse than none at all, because the config reads like protection and
 * nothing reports otherwise. It was removed rather than left in place looking
 * correct.
 *
 * ── Two counters, because they are not worth the same ──
 *
 * Counting in isolate memory was tried next and is too weak on its own: 25
 * requests measured against this Worker were served by 3 different isolates,
 * so a per-isolate budget of 20 silently became about 7 each and never
 * tripped. It divides by a number nobody controls.
 *
 * So the writes — subscribing, sending a push, guessing the tick secret — go
 * through a Durable Object, which is a single globally-consistent instance per
 * caller and therefore counts properly. Reads and routine preference syncs
 * keep the in-memory counter: they are frequent, cheap, and not worth a round
 * trip or a slice of the Durable Object request budget, and an approximate
 * ceiling is enough for traffic that costs nothing to serve.
 *
 * What none of this does is protect the daily request quota: a 429 is still a
 * Worker invocation and still counts. Stopping a flood before it reaches the
 * Worker needs edge WAF rules, which do not apply to a workers.dev subdomain.
 * What is protected is everything with lasting consequences — the database,
 * the push sends, and the tick secret.
 */

/** Every mainstream browser's push service. */
const PUSH_ENDPOINT_HOSTS = [
  /^fcm\.googleapis\.com$/,                 // Chrome, Edge, Opera, Brave — all Chromium
  /(^|\.)push\.services\.mozilla\.com$/,   // Firefox
  /^web\.push\.apple\.com$/,                // Safari, macOS and iOS
  /(^|\.)notify\.windows\.com$/,            // Edge legacy / WNS
];

/*
 * A browser we have not listed would be turned away, which is why this is a
 * list of families rather than exact hosts — every Chromium browser shares
 * FCM, and Mozilla and Microsoft both use subdomains. Adding a service here is
 * a one-line change if one ever appears.
 */
export function isRealPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return PUSH_ENDPOINT_HOSTS.some((host) => host.test(url.hostname));
}

const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'unknown';

/** Fixed windows, per caller. Reset lazily, so there is no timer to leak. */
const windows = new Map();

/* An isolate is recycled often and this map is small, but a flood of unique
   addresses could still grow it without bound. Expired entries are swept once
   the map is large enough for that to be worth doing. */
const MAX_TRACKED = 10_000;

function sweep(now) {
  for (const [key, w] of windows) if (now >= w.resetAt) windows.delete(key);
}

/**
 * Has `key` exhausted its budget for the current window?
 *
 * Returns true while the caller may proceed. Never throws: a limiter that
 * takes the API down has done more damage than the abuse it was added to
 * prevent, and this is a second line of defence rather than the only one.
 */
export function withinLimit(key, limit, windowMs = 60_000) {
  try {
    const now = Date.now();
    if (windows.size >= MAX_TRACKED) sweep(now);

    let w = windows.get(key);
    if (!w || now >= w.resetAt) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(key, w);
    }
    w.count += 1;
    return w.count <= limit;
  } catch (err) {
    console.error('[ratelimit] failing open', err);
    return true;
  }
}

/** Exposed so tests can start from a clean slate. */
export function _resetLimits() {
  windows.clear();
}

/* Per minute, per caller. Writes create rows, send pushes, or guess at the
   tick secret; reads and routine preference syncs are cheap and frequent. */
const WRITE_PER_MIN = 20;
const READ_PER_MIN = 120;

/**
 * One counter per caller, globally consistent.
 *
 * Held in memory rather than storage: a Durable Object is a single instance,
 * so memory is already correct, and it keeps this off the storage budget. If
 * the instance is evicted the window restarts early, which lets a caller
 * through sooner than intended — the harmless direction for a mistake.
 */
export class RateLimiter {
  constructor() {
    this.count = 0;
    this.resetAt = 0;
  }

  async fetch(request) {
    const { limit, windowMs } = await request.json();
    const now = Date.now();
    if (now >= this.resetAt) {
      this.count = 0;
      this.resetAt = now + windowMs;
    }
    this.count += 1;
    return Response.json({ allowed: this.count <= limit });
  }
}

/**
 * The write budget. Falls back to the in-memory counter if the Durable Object
 * cannot be reached, so a limiter problem degrades rather than 500s.
 */
async function withinWriteLimit(env, key) {
  if (!env.RATE_LIMITER) return withinLimit(`w:${key}`, WRITE_PER_MIN);
  try {
    const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(`w:${key}`));
    const res = await stub.fetch('https://limiter/check', {
      method: 'POST',
      body: JSON.stringify({ limit: WRITE_PER_MIN, windowMs: 60_000 }),
    });
    const { allowed } = await res.json();
    return allowed !== false;
  } catch (err) {
    console.error('[ratelimit] durable object unreachable, falling back', err);
    return withinLimit(`w:${key}`, WRITE_PER_MIN);
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

  /* Writes get the tighter budget: they create rows, send pushes, or guess at
     the tick secret. Reads and routine preference syncs get the loose one.
     /api/tick is limited *before* its auth check, so the secret cannot be
     brute-forced — the real caller is a cron trigger that never comes through
     here anyway. */
  const costly =
    request.method === 'POST' &&
    (path === '/api/subscribe' || path === '/api/tick' || path.startsWith('/api/test/'));

  const ip = clientIp(request);
  const ok = costly
    ? await withinWriteLimit(env, ip)
    : withinLimit(`r:${ip}`, READ_PER_MIN);
  if (!ok) return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' });

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
    if (!isRealPushEndpoint(body.subscription.endpoint)) {
      return json({ error: 'Not a recognised push service endpoint' }, 400);
    }
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
