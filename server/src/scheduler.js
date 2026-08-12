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
// Shared with the Cloudflare Worker so the two cannot drift.
import { decide, MINUTE } from './schedule-core.js';

export { decide };

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
  if (process.env.INTERNAL_SCHEDULER === 'false') {
    console.log('[scheduler] internal timer disabled — expecting external POST /api/tick');
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
