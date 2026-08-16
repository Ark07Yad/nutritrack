/**
 * Streaks and milestones.
 *
 * Three separate runs, because they measure different things and conflating
 * them makes all of them meaningless:
 *
 *   logging   — you recorded something. The habit of showing up.
 *   calories  — you finished the day inside your target band. Adherence.
 *   steps     — you hit your step goal.
 *
 * A streak is only motivating if it is honest, so two rules apply throughout:
 *
 *   1. Today never breaks a streak. It is still in progress until midnight, so
 *      an unfinished day is skipped rather than counted as a failure — nobody
 *      should see "streak lost" at 9am because they have not eaten yet.
 *   2. Days with no data are misses, not gaps. Silently skipping unlogged days
 *      would let a streak survive a month of nothing, which is a lie.
 */

import { todayKey } from './calc';

/* ────────────────────────────── Milestones ────────────────────────────── */

/**
 * Deliberately front-loaded. The early ones come quickly because that is when
 * quitting is most likely; past a hundred days the habit is the reward and the
 * markers can be sparse.
 */
export const MILESTONES = [
  3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 750, 1000,
];

export function milestoneProgress(streak) {
  const reached = MILESTONES.filter((m) => m <= streak);
  const next = MILESTONES.find((m) => m > streak) ?? null;
  const last = reached.at(-1) ?? 0;
  return {
    reached,
    lastReached: last,
    next,
    /** 0–1 through the current segment, for a progress ring. */
    fraction: next ? Math.max(0, (streak - last) / (next - last)) : 1,
    toGo: next ? next - streak : 0,
  };
}

/** The highest milestone newly crossed since `alreadySeen`, if any. */
export function newMilestone(streak, alreadySeen = 0) {
  const hit = MILESTONES.filter((m) => m <= streak).at(-1);
  return hit && hit > alreadySeen ? hit : null;
}

export function milestoneBlurb(kind, n) {
  const noun = { logging: 'logged', calories: 'on target', steps: 'hitting your step goal' }[kind] || 'in a row';
  if (n >= 365) return `A full year ${noun}. Whatever this is now, it is not willpower.`;
  if (n >= 100) return `${n} days ${noun}. Past this point the habit maintains itself.`;
  if (n >= 30) return `${n} days ${noun}. This is the stretch where it stops feeling like effort.`;
  if (n >= 7) return `${n} days ${noun}. The first week is the one most people never finish.`;
  return `${n} days ${noun}. Keep going — the early days are the expensive ones.`;
}

/* ─────────────────────────── Per-day predicates ─────────────────────────── */

export const hasEntries = (day) =>
  !!day && Object.values(day.meals || {}).some((l) => Array.isArray(l) && l.length > 0);

const dayKcal = (day) =>
  Object.values(day?.meals || {})
    .flat()
    .reduce((s, e) => s + (e.n?.kcal || 0), 0);

/**
 * Was this day inside the calorie target?
 *
 * A band rather than a number, because nobody lands exactly on a target and a
 * streak that demands it would never start. The default ±10% is wide enough to
 * be achievable and tight enough to mean something.
 *
 * Days with nothing logged are explicitly *not* on target — otherwise not
 * logging would be the easiest way to keep the streak alive.
 */
export function calorieDayOk(day, target, tolerance = 0.1) {
  if (!hasEntries(day)) return false;
  const kcal = dayKcal(day);
  const burned = (day.workouts || []).reduce((s, w) => s + (w.kcal || 0), 0);
  const net = kcal - burned;
  return Math.abs(net - target) <= target * tolerance;
}

export const stepDayOk = (day, goal) => (day?.steps || 0) >= goal;

/* ──────────────────────────── Streak counting ──────────────────────────── */

/**
 * Walk backwards from today counting consecutive qualifying days.
 *
 * Returns the current run, the best run ever seen, and whether today already
 * qualifies — the UI needs the last one to say "keep it alive" versus "done for
 * today" without recomputing.
 */
export function streakFor(days, qualifies, { horizon = 1200 } = {}) {
  const cursor = new Date();
  const today = todayKey(cursor);
  const todayOk = qualifies(days[today], today);

  // An unfinished today is skipped, not counted against you.
  if (!todayOk) cursor.setDate(cursor.getDate() - 1);

  let current = 0;
  for (let i = 0; i < horizon; i++) {
    const key = todayKey(cursor);
    if (!qualifies(days[key], key)) break;
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Best run: scan the whole history rather than only the current tail.
  const keys = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of keys) {
    if (!qualifies(days[key], key)) { run = 0; prev = key; continue; }
    const gap = prev ? Math.round((new Date(key) - new Date(prev)) / 86_400_000) : 1;
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }

  return { current, best: Math.max(best, current), todayOk };
}

/** All three streaks at once, with milestone context attached. */
export function allStreaks({ days, calorieTarget, stepGoal, tolerance = 0.1 }) {
  const build = (kind, qualifies) => {
    const s = streakFor(days, qualifies);
    return { kind, ...s, ...milestoneProgress(s.current) };
  };

  return {
    logging: build('logging', (d) => hasEntries(d)),
    calories: build('calories', (d) => calorieDayOk(d, calorieTarget, tolerance)),
    steps: build('steps', (d) => stepDayOk(d, stepGoal)),
  };
}

/** The last `n` days as booleans, oldest first — for the dot strip. */
export function recentPattern(days, qualifies, n = 14) {
  const out = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = todayKey(cursor);
    out.push({ key, ok: qualifies(days[key], key), isToday: key === todayKey() });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
