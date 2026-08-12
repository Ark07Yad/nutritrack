-- D1 schema. Deliberately identical to the Node server's SQLite table, so the
-- shared decide() in server/src/schedule-core.js reads either without changes.
--
--   npx wrangler d1 execute nutritrack-push --file schema.sql --remote

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

  -- Suppression flags the client sets so we do not push pointlessly. Both are
  -- plain dates; neither says anything about what was eaten.
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
CREATE INDEX IF NOT EXISTS idx_subs_seen ON subscriptions(last_seen_at);
