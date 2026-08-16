/**
 * Menstrual cycle tracking.
 *
 * Why this belongs in a nutrition tracker rather than being scope creep: the
 * cycle is the single largest source of unexplained noise in a woman's weight
 * data. Premenstrual water retention is commonly 1–2 kg and resolves within
 * days of bleeding starting. Someone dieting carefully can watch the scale
 * climb for a week, conclude the diet has failed, and quit — over water. Being
 * able to see "you are on day 26" next to that rise is the whole point.
 *
 * It also shifts real nutrition needs: iron losses during menstruation are the
 * reason the iron target is roughly double the male one, and appetite and
 * cravings measurably rise in the luteal phase.
 *
 * ── On privacy ──
 * Cycle data is among the most sensitive a person can record. This app stores
 * everything locally and has no account, which is the strongest position
 * available, and this module is deliberately excluded from anything that leaves
 * the device: the push server receives only a schedule and two suppression
 * dates, and never any cycle field. The UI says so plainly.
 *
 * ── On what this is not ──
 * Not contraception, not a fertility method, and not a diagnostic. Predictions
 * are a simple average of your own logged cycles; cycles vary, and stress,
 * illness, travel and training all move them. The UI says that too.
 */

import { todayKey, parseKey } from './calc';

export const DEFAULT_CYCLE = {
  enabled: false,
  /** Start dates of past periods, as 'YYYY-MM-DD', newest last. */
  periods: [],
  /** Typical values, used until there is enough history to learn from. */
  avgCycleDays: 28,
  avgPeriodDays: 5,
  /** Per-day symptom notes, keyed by date. */
  notes: {},
};

const DAY = 86_400_000;
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / DAY);

/* ─────────────────────────── Learning from history ─────────────────────── */

/**
 * Average cycle length from logged starts, ignoring implausible gaps.
 *
 * A gap under 15 or over 60 days is far more likely to be a mistyped or missed
 * entry than a real cycle, and letting those into the average would poison the
 * prediction for months.
 */
export function cycleStats(cycle) {
  const starts = [...(cycle.periods || [])].sort();
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    const g = daysBetween(starts[i - 1], starts[i]);
    if (g >= 15 && g <= 60) gaps.push(g);
  }

  // Recent cycles describe you better than ones from two years ago.
  const recent = gaps.slice(-6);
  const avg = recent.length
    ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
    : cycle.avgCycleDays || 28;

  const spread = recent.length > 1
    ? Math.round(Math.max(...recent) - Math.min(...recent))
    : null;

  return {
    starts,
    lastStart: starts.at(-1) || null,
    cycleLength: avg,
    variability: spread,
    logged: gaps.length,
    /** Enough history for a prediction to be worth showing at all. */
    confident: gaps.length >= 2,
  };
}

/* ──────────────────────────────── Phases ──────────────────────────────── */

export const PHASES = {
  menstrual: {
    label: 'Menstrual',
    tone: 'bad',
    note: 'Iron losses are highest now. Pair iron-rich food with vitamin C, and keep tea and coffee away from those meals — both block absorption.',
  },
  follicular: {
    label: 'Follicular',
    tone: 'good',
    note: 'Appetite and water retention are usually at their lowest, and training tends to feel easiest. A good stretch for harder sessions.',
  },
  ovulatory: {
    label: 'Ovulatory',
    tone: 'info',
    note: 'Energy is typically high. Some people see a small temperature rise and mild fluid retention around this point.',
  },
  luteal: {
    label: 'Luteal',
    tone: 'warn',
    note: 'Appetite commonly rises — often by a few hundred calories a day — and water retention builds toward the end. Scale rises here are usually water, not fat.',
  },
};

/** Which phase a given cycle day falls in, using this person's own average. */
export function phaseForDay(dayOfCycle, cycleLength = 28, periodDays = 5) {
  if (dayOfCycle == null) return null;
  if (dayOfCycle <= periodDays) return 'menstrual';
  // Ovulation tracks backwards from the next period far more reliably than
  // forwards from the last one — the luteal phase is the stable part.
  const ovulation = cycleLength - 14;
  if (dayOfCycle < ovulation - 1) return 'follicular';
  if (dayOfCycle <= ovulation + 1) return 'ovulatory';
  return 'luteal';
}

/* ─────────────────────────────── Current state ─────────────────────────── */

export function cycleStatus(cycle, onDate = todayKey()) {
  if (!cycle?.enabled) return null;
  const stats = cycleStats(cycle);
  if (!stats.lastStart) return { stats, needsFirstEntry: true };

  const dayOfCycle = daysBetween(stats.lastStart, onDate) + 1;

  // A cycle day far beyond any plausible length means the last period simply
  // was not logged. Say that rather than predicting from stale data.
  const stale = dayOfCycle > stats.cycleLength + 25;

  const phase = stale ? null : phaseForDay(dayOfCycle, stats.cycleLength, cycle.avgPeriodDays);
  const daysUntilNext = stats.cycleLength - dayOfCycle + 1;

  const nextDate = (() => {
    const d = parseKey(stats.lastStart);
    d.setDate(d.getDate() + stats.cycleLength);
    return todayKey(d);
  })();

  return {
    stats,
    dayOfCycle,
    phase,
    phaseInfo: phase ? PHASES[phase] : null,
    daysUntilNext,
    nextDate,
    stale,
    isLate: !stale && daysUntilNext < 0,
    needsFirstEntry: false,
  };
}

/**
 * A plain-language note explaining scale movement, when the cycle can explain
 * it. Returns null when there is nothing worth saying — an explanation offered
 * every single day stops being read.
 */
export function weightContext(status) {
  if (!status || status.stale || !status.phase) return null;
  if (status.phase === 'luteal' && status.daysUntilNext <= 7) {
    return 'You are in the week before your period, when water retention typically peaks. A rise of a kilo or two here is usually fluid and drops away once bleeding starts — worth not reading as fat gain.';
  }
  if (status.phase === 'menstrual') {
    return 'Water retention usually falls away over the next few days, so the scale often drops sharply. That is fluid leaving, not fat lost.';
  }
  return null;
}

/** Toggle a date as a period start, keeping the list sorted and unique. */
export function togglePeriodStart(cycle, date) {
  const set = new Set(cycle.periods || []);
  if (set.has(date)) set.delete(date);
  else set.add(date);
  return { ...cycle, periods: [...set].sort() };
}
