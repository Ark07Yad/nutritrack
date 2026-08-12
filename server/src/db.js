/**
 * Storage for push subscriptions.
 *
 * Deliberately small. The only things kept per device are: the push endpoint
 * the browser gave us, the reminder schedule, a UTC offset so "20:00" means
 * 20:00 where you are, and two booleans that stop us pushing when there is
 * nothing to say. No food, no weight, no name, no account.
 *
 * Uses node:sqlite, which ships with Node — no native module to compile.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || './data/push.db';

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS subscriptions (
    id              TEXT PRIMARY KEY,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,

    -- Schedule, mirrored from the client's settings screen.
    water_on        INTEGER NOT NULL DEFAULT 1,
    water_every_min INTEGER NOT NULL DEFAULT 90,
    water_from      TEXT    NOT NULL DEFAULT '08:00',
    water_to        TEXT    NOT NULL DEFAULT '22:00',
    streak_on       INTEGER NOT NULL DEFAULT 1,
    streak_at       TEXT    NOT NULL DEFAULT '20:00',

    -- Minutes to add to UTC to get the device's local time.
    tz_offset_min   INTEGER NOT NULL DEFAULT 0,

    -- Suppression flags the client sets so we do not push pointlessly.
    -- Both are plain dates/booleans; neither says anything about what was eaten.
    water_done_day  TEXT    NOT NULL DEFAULT '',
    logged_day      TEXT    NOT NULL DEFAULT '',

    -- Send bookkeeping.
    last_water_at   INTEGER NOT NULL DEFAULT 0,
    last_streak_day TEXT    NOT NULL DEFAULT '',

    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    last_seen_at    INTEGER NOT NULL,
    failures        INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_subs_active ON subscriptions(water_on, streak_on);
`);

const nowMs = () => Date.now();

const COLS = `id, endpoint, p256dh, auth, water_on, water_every_min, water_from, water_to,
  streak_on, streak_at, tz_offset_min, water_done_day, logged_day,
  last_water_at, last_streak_day, created_at, updated_at, last_seen_at, failures`;

const stmt = {
  byId: db.prepare(`SELECT ${COLS} FROM subscriptions WHERE id = ?`),
  byEndpoint: db.prepare(`SELECT ${COLS} FROM subscriptions WHERE endpoint = ?`),
  all: db.prepare(`SELECT ${COLS} FROM subscriptions`),
  active: db.prepare(`SELECT ${COLS} FROM subscriptions WHERE water_on = 1 OR streak_on = 1`),
  insert: db.prepare(`
    INSERT INTO subscriptions (id, endpoint, p256dh, auth, created_at, updated_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  touch: db.prepare(`UPDATE subscriptions SET last_seen_at = ?, failures = 0 WHERE id = ?`),
  remove: db.prepare(`DELETE FROM subscriptions WHERE id = ?`),
  removeByEndpoint: db.prepare(`DELETE FROM subscriptions WHERE endpoint = ?`),
  bumpFailure: db.prepare(`UPDATE subscriptions SET failures = failures + 1 WHERE id = ?`),
  markWater: db.prepare(`UPDATE subscriptions SET last_water_at = ? WHERE id = ?`),
  markStreak: db.prepare(`UPDATE subscriptions SET last_streak_day = ? WHERE id = ?`),
  count: db.prepare(`SELECT COUNT(*) AS n FROM subscriptions`),
};

/** Fields a client is allowed to set. Anything else in the body is ignored. */
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
function sanitise(prefs = {}) {
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

export function upsertSubscription({ id, subscription, prefs }) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Malformed subscription');

  const existing = stmt.byEndpoint.get(endpoint);
  const now = nowMs();
  let rowId = existing?.id;

  if (!existing) {
    rowId = id || crypto.randomUUID();
    stmt.insert.run(rowId, endpoint, keys.p256dh, keys.auth, now, now, now);
  } else {
    stmt.touch.run(now, rowId);
  }

  const patch = sanitise(prefs);
  if (Object.keys(patch).length) applyPatch(rowId, patch);

  return stmt.byId.get(rowId);
}

function applyPatch(id, patch) {
  const sets = Object.keys(patch).map((c) => `${c} = ?`).join(', ');
  const values = Object.values(patch);
  db.prepare(`UPDATE subscriptions SET ${sets}, updated_at = ? WHERE id = ?`).run(
    ...values,
    nowMs(),
    id
  );
}

export function updatePrefs(id, prefs) {
  if (!stmt.byId.get(id)) return null;
  const patch = sanitise(prefs);
  if (Object.keys(patch).length) applyPatch(id, patch);
  stmt.touch.run(nowMs(), id);
  return stmt.byId.get(id);
}

export const getSubscription = (id) => stmt.byId.get(id) ?? null;
export const listActive = () => stmt.active.all();
export const removeSubscription = (id) => stmt.remove.run(id).changes > 0;
export const removeByEndpoint = (endpoint) => stmt.removeByEndpoint.run(endpoint).changes > 0;
export const markWaterSent = (id, at) => stmt.markWater.run(at, id);
export const markStreakSent = (id, day) => stmt.markStreak.run(day, id);
export const noteFailure = (id) => stmt.bumpFailure.run(id);
export const subscriptionCount = () => stmt.count.get().n;

/** Drop devices that have not checked in for a long time. */
export function pruneStale(maxAgeDays = 90) {
  const cutoff = nowMs() - maxAgeDays * 86_400_000;
  return db.prepare(`DELETE FROM subscriptions WHERE last_seen_at < ?`).run(cutoff).changes;
}

/** Shape sent back to the client — never includes the endpoint or keys. */
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

export default db;
