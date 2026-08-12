/**
 * D1 storage.
 *
 * Same table and same column names as the Node server's SQLite schema, so the
 * shared `decide()` reads either without translation. D1 is SQLite underneath,
 * so the SQL is identical — only the driver differs (async, prepared-statement
 * binding rather than synchronous calls).
 */

const COLS = `id, endpoint, p256dh, auth, water_on, water_every_min, water_from, water_to,
  streak_on, streak_at, tz_offset_min, water_done_day, logged_day,
  last_water_at, last_streak_day, created_at, updated_at, last_seen_at, failures`;

/** Only these may be set by a client; anything else in a request is ignored. */
const WRITABLE = {
  waterOn: 'water_on',
  waterEveryMinutes: 'water_every_min',
  waterFrom: 'water_from',
  waterTo: 'water_to',
  streakOn: 'streak_on',
  streakAt: 'streak_at',
  tzOffsetMinutes: 'tz_offset_min',
  waterDoneDay: 'water_done_day',
  loggedDay: 'logged_day',
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate and coerce an incoming preferences patch. */
export function sanitise(prefs = {}) {
  const out = {};
  for (const [key, column] of Object.entries(WRITABLE)) {
    if (!(key in prefs)) continue;
    const v = prefs[key];

    switch (key) {
      case 'waterOn':
      case 'streakOn':
        out[column] = v ? 1 : 0;
        break;
      case 'waterEveryMinutes':
        out[column] = Math.min(360, Math.max(15, Number(v) || 90));
        break;
      case 'waterFrom':
      case 'waterTo':
      case 'streakAt':
        if (TIME_RE.test(String(v))) out[column] = String(v);
        break;
      case 'tzOffsetMinutes':
        out[column] = Math.min(840, Math.max(-840, Math.round(Number(v) || 0)));
        break;
      case 'waterDoneDay':
      case 'loggedDay':
        if (v === '' || DAY_RE.test(String(v))) out[column] = String(v);
        break;
      default:
        break;
    }
  }
  return out;
}

export async function getById(db, id) {
  return db.prepare(`SELECT ${COLS} FROM subscriptions WHERE id = ?`).bind(id).first();
}

export async function getByEndpoint(db, endpoint) {
  return db.prepare(`SELECT ${COLS} FROM subscriptions WHERE endpoint = ?`).bind(endpoint).first();
}

export async function listActive(db) {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM subscriptions WHERE water_on = 1 OR streak_on = 1`)
    .all();
  return results || [];
}

export async function countSubscriptions(db) {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM subscriptions').first();
  return row?.n ?? 0;
}

async function applyPatch(db, id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const sets = keys.map((c) => `${c} = ?`).join(', ');
  await db
    .prepare(`UPDATE subscriptions SET ${sets}, updated_at = ? WHERE id = ?`)
    .bind(...Object.values(patch), Date.now(), id)
    .run();
}

/**
 * Register a device, or update it if the endpoint is already known.
 *
 * Idempotent on endpoint: the browser hands back the same one after a reload,
 * so re-subscribing updates in place instead of accumulating duplicate rows.
 */
export async function upsertSubscription(db, { subscription, prefs }) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Malformed subscription');

  const now = Date.now();
  const existing = await getByEndpoint(db, endpoint);
  let id = existing?.id;

  if (!existing) {
    id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO subscriptions (id, endpoint, p256dh, auth, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, endpoint, keys.p256dh, keys.auth, now, now, now)
      .run();
  } else {
    await db
      .prepare('UPDATE subscriptions SET last_seen_at = ?, failures = 0 WHERE id = ?')
      .bind(now, id)
      .run();
  }

  await applyPatch(db, id, sanitise(prefs));
  return getById(db, id);
}

export async function updatePrefs(db, id, prefs) {
  if (!(await getById(db, id))) return null;
  await applyPatch(db, id, sanitise(prefs));
  await db
    .prepare('UPDATE subscriptions SET last_seen_at = ?, failures = 0 WHERE id = ?')
    .bind(Date.now(), id)
    .run();
  return getById(db, id);
}

export async function removeSubscription(db, id) {
  const res = await db.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}

export const markWaterSent = (db, id, at) =>
  db.prepare('UPDATE subscriptions SET last_water_at = ? WHERE id = ?').bind(at, id).run();

export const markStreakSent = (db, id, day) =>
  db.prepare('UPDATE subscriptions SET last_streak_day = ? WHERE id = ?').bind(day, id).run();

export const noteFailure = (db, id) =>
  db.prepare('UPDATE subscriptions SET failures = failures + 1 WHERE id = ?').bind(id).run();

/** Drop devices that have not checked in for a long time. */
export async function pruneStale(db, maxAgeDays = 90) {
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  const res = await db.prepare('DELETE FROM subscriptions WHERE last_seen_at < ?').bind(cutoff).run();
  return res.meta?.changes ?? 0;
}

/** Shape returned to clients — never the endpoint or the keys. */
export function publicView(row) {
  if (!row) return null;
  return {
    id: row.id,
    waterOn: !!row.water_on,
    waterEveryMinutes: row.water_every_min,
    waterFrom: row.water_from,
    waterTo: row.water_to,
    streakOn: !!row.streak_on,
    streakAt: row.streak_at,
    tzOffsetMinutes: row.tz_offset_min,
    updatedAt: row.updated_at,
  };
}
