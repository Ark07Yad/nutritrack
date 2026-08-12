/**
 * NutriTrack push backend.
 *
 * What it stores: a push endpoint, a reminder schedule, a UTC offset, and two
 * date strings that say "goal already met today" / "already logged today".
 * What it does not store: anything you ate, weighed, or did. The notification
 * text is composed on your device by the service worker; this server only
 * sends a wake-up signal saying which kind of reminder is due.
 *
 * Plain node:http — the whole API is six routes and adding a framework for
 * that is not a trade worth making.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

// Load .env before anything reads process.env.
try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env file — rely on the real environment (Docker, Railway, Fly, …) */
}

const { publicKey, vapidConfigured, sendTo } = await import('./push.js');
const {
  upsertSubscription, updatePrefs, getSubscription, removeSubscription,
  publicView, subscriptionCount,
} = await import('./db.js');
const scheduler = await import('./scheduler.js');

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/* ──────────────────────────────── Helpers ──────────────────────────────── */

function cors(req, res) {
  const origin = req.headers.origin;
  const allowAll = ALLOWED_ORIGINS.includes('*');

  if (allowAll) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const send = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
};

/** Constant-time compare, so the tick secret cannot be guessed byte by byte. */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length is not leaked by timing alone.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const MAX_BODY = 8 * 1024; // a subscription is ~500 bytes; anything larger is junk

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Crude per-IP rate limit. Enough to stop an accidental loop hammering the
 * push service; not a substitute for a real gateway in front of this.
 */
const hits = new Map();
function rateLimited(req, limit = 60, windowMs = 60_000) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = hits.get(ip);

  if (!rec || now - rec.start > windowMs) {
    hits.set(ip, { start: now, count: 1 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  rec.count++;
  return rec.count > limit;
}

/* ──────────────────────────────── Routes ──────────────────────────────── */

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (rateLimited(req)) return send(res, 429, { error: 'Too many requests' });

  try {
    /* Health and capability discovery. The client calls this before showing
       the "background reminders" option, so it can say honestly whether the
       server it is pointed at is actually able to send. */
    if (req.method === 'GET' && (path === '/' || path === '/health')) {
      return send(res, 200, {
        service: 'nutritrack-push',
        ok: true,
        vapidConfigured,
        publicKey: publicKey || null,
        subscriptions: subscriptionCount(),
        scheduler: scheduler.getStats(),
      });
    }

    if (req.method === 'GET' && path === '/api/vapid-public-key') {
      if (!vapidConfigured) return send(res, 503, { error: 'Server has no VAPID keys configured' });
      return send(res, 200, { publicKey });
    }

    /* Register a device, or update one that already exists. Idempotent: the
       browser hands back the same endpoint every time, so re-subscribing after
       a reinstall updates in place rather than creating duplicates. */
    if (req.method === 'POST' && path === '/api/subscribe') {
      if (!vapidConfigured) return send(res, 503, { error: 'Server has no VAPID keys configured' });

      const body = await readJson(req);
      if (!body?.subscription?.endpoint) {
        return send(res, 400, { error: 'Missing subscription' });
      }
      const row = upsertSubscription({
        id: body.id,
        subscription: body.subscription,
        prefs: body.prefs,
      });
      return send(res, 200, publicView(row));
    }

    const subMatch = path.match(/^\/api\/subscribe\/([\w-]+)$/);
    if (subMatch) {
      const id = subMatch[1];

      if (req.method === 'PATCH') {
        const row = updatePrefs(id, await readJson(req));
        if (!row) return send(res, 404, { error: 'Unknown subscription' });
        return send(res, 200, publicView(row));
      }

      if (req.method === 'GET') {
        const row = getSubscription(id);
        if (!row) return send(res, 404, { error: 'Unknown subscription' });
        return send(res, 200, publicView(row));
      }

      if (req.method === 'DELETE') {
        return send(res, 200, { removed: removeSubscription(id) });
      }
    }

    /* Run one scheduler pass on demand.

       This is what makes free hosting viable. Most free tiers stop your
       process after ~15 minutes idle, which kills an in-process timer and
       therefore every reminder. Driving the tick from outside — a GitHub
       Actions cron, or any uptime pinger — means the request itself wakes the
       service, so reminders keep working on a host that sleeps.

       Guarded by a shared secret: anyone who could call this freely could
       force-send pushes to every subscriber. */
    if (req.method === 'POST' && path === '/api/tick') {
      const secret = process.env.TICK_SECRET;
      if (!secret) return send(res, 503, { error: 'TICK_SECRET is not set on this server' });

      const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') || url.searchParams.get('key');
      if (!timingSafeEqual(provided, secret)) return send(res, 401, { error: 'Unauthorized' });

      const before = scheduler.getStats();
      await scheduler.runTick();
      const after = scheduler.getStats();
      return send(res, 200, {
        ok: true,
        sent: after.sent - before.sent,
        pruned: after.pruned - before.pruned,
        failed: after.failed - before.failed,
        subscriptions: subscriptionCount(),
      });
    }

    /* Fire one push immediately, so "Send a test" proves the whole chain —
       VAPID, the push service, the service worker — rather than just the
       in-page code path. */
    const testMatch = path.match(/^\/api\/test\/([\w-]+)$/);
    if (req.method === 'POST' && testMatch) {
      const row = getSubscription(testMatch[1]);
      if (!row) return send(res, 404, { error: 'Unknown subscription' });

      const result = await sendTo(row, { kind: 'test', sentAt: Date.now() });
      return send(res, result.ok ? 200 : 502, result);
    }

    return send(res, 404, { error: 'Not found' });
  } catch (err) {
    const isClient = /Invalid JSON|Body too large|Malformed/.test(err.message);
    if (!isClient) console.error('[server]', err);
    return send(res, isClient ? 400 : 500, { error: isClient ? err.message : 'Internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  NutriTrack push backend`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → ${subscriptionCount()} subscription(s) stored`);
  if (!vapidConfigured) {
    console.warn('\n  ⚠  No VAPID keys. Run `npm run keys` and put them in .env,');
    console.warn('     otherwise nothing can be sent.\n');
  } else {
    console.log(`  → VAPID configured\n`);
  }
  scheduler.start();
});

const shutdown = () => {
  console.log('\n[server] shutting down');
  scheduler.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
