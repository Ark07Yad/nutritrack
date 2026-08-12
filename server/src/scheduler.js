/**
 * The tick.
 *
 * Once a minute, work out which devices are due a nudge in *their* local time
 * and send a wake-up push. Everything here is arithmetic on stored preferences
 * — the server has no idea whether you actually drank anything, which is the
 * point. The device decides what the notification says.
 */

import {
  listActive, markWaterSent, markStreakSent, pruneStale, subscriptionCount,
} from './db.js';
import { sendTo, vapidConfigured } from './push.js';

const MINUTE = 60_000;

/* ─────────────────────────── Local-time helpers ─────────────────────────── */

/**
 * `tzOffsetMinutes` is minutes to ADD to UTC to reach the device's wall clock
 * (+330 for IST). Shifting the timestamp and then reading UTC fields gives us
 * that wall clock without dragging in a timezone database.
 */
function localParts(tzOffsetMinutes, at = Date.now()) {
  const d = new Date(at + tzOffsetMinutes * MINUTE);
  return {
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    day: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
  };
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Handles windows that wrap past midnight, e.g. 22:00 → 06:00. */
const withinWindow = (now, from, to) => {
  const a = toMinutes(from);
  const b = toMinutes(to);
  return b >= a ? now >= a && now <= b : now >= a || now <= b;
};

/* ──────────────────────────────── Decisions ─────────────────────────────── */

/**
 * Pure: given a row and the current instant, what should be sent?
 * Exported so the logic can be reasoned about (and tested) without a database.
 */
export function decide(row, at = Date.now()) {
  const out = [];
  const { minutes, day } = localParts(row.tz_offset_min, at);

  if (row.water_on) {
    const goalAlreadyMet = row.water_done_day === day;
    const due = at - row.last_water_at >= row.water_every_min * MINUTE;
    if (!goalAlreadyMet && due && withinWindow(minutes, row.water_from, row.water_to)) {
      out.push({ kind: 'water', day });
    }
  }

  if (row.streak_on) {
    const alreadySentToday = row.last_streak_day === day;
    const alreadyLogged = row.logged_day === day;
    if (!alreadySentToday && !alreadyLogged && minutes >= toMinutes(row.streak_at)) {
      out.push({ kind: 'streak', day });
    }
  }

  return out;
}

/* ────────────────────────────────── Loop ────────────────────────────────── */

let timer = null;
let running = false;
const stats = { ticks: 0, sent: 0, pruned: 0, failed: 0, lastTickAt: 0 };

export async function runTick(at = Date.now()) {
  if (running) return stats; // a slow push service must not overlap ticks
  running = true;

  try {
    const rows = listActive();
    for (const row of rows) {
      for (const job of decide(row, at)) {
        const result = await sendTo(row, {
          kind: job.kind,
          // The device re-derives everything; this is only a hint for the SW
          // in the rare case it cannot open its own database.
          sentAt: at,
        });

        if (result.ok) {
          stats.sent++;
          if (job.kind === 'water') markWaterSent(row.id, at);
          else markStreakSent(row.id, job.day);
        } else if (result.pruned) {
          stats.pruned++;
          break; // this row is gone; stop processing it
        } else {
          stats.failed++;
          // Still record the attempt so a broken endpoint cannot be retried
          // every single minute forever.
          if (job.kind === 'water') markWaterSent(row.id, at);
          else markStreakSent(row.id, job.day);
        }
      }
    }

    stats.ticks++;
    stats.lastTickAt = at;

    // Housekeeping once an hour.
    if (stats.ticks % 60 === 0) {
      const removed = pruneStale();
      if (removed) console.log(`[scheduler] pruned ${removed} stale subscription(s)`);
    }
  } catch (err) {
    console.error('[scheduler] tick failed:', err);
  } finally {
    running = false;
  }

  return stats;
}

export function start() {
  if (timer) return;
  if (!vapidConfigured) {
    console.warn('[scheduler] VAPID keys missing — not starting. Run `npm run keys`.');
    return;
  }

  // Align to the top of the next minute so notifications land on the clock
  // rather than drifting by however long boot took.
  const msToNextMinute = MINUTE - (Date.now() % MINUTE);
  setTimeout(() => {
    runTick();
    timer = setInterval(() => runTick(), MINUTE);
  }, msToNextMinute);

  console.log(
    `[scheduler] started · ${subscriptionCount()} subscription(s) · first tick in ${Math.round(msToNextMinute / 1000)}s`
  );
}

export function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

export const getStats = () => ({ ...stats });
