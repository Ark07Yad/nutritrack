/**
 * Water reminders and the daily streak nudge.
 *
 * An honest note on how these work: a real background push notification needs
 * a push server, and this app has no server by design. So reminders are
 * scheduled in the page and delivered through the service worker, which means
 * they fire whenever NutriTrack is open in a tab — including a backgrounded
 * tab, and including an installed PWA sitting in the app switcher. If you close
 * the app entirely, nothing fires until you open it again, and at that point
 * anything you missed is shown as an in-app nudge instead.
 *
 * The UI says exactly this rather than implying push you are not getting.
 */

import { todayKey } from './calc';

export const DEFAULT_REMINDERS = {
  enabled: false,
  water: {
    on: true,
    everyMinutes: 90,
    from: '08:00',
    to: '22:00',
  },
  streak: {
    on: true,
    at: '20:00',
  },
  /** Bookkeeping so a reopened tab does not replay the whole day. */
  lastWaterAt: 0,
  lastStreakDay: '',
  lastMilestone: 0,
};

/* ─────────────────────────── Permission & SW ─────────────────────────── */

export function notificationSupport() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

let swReady = null;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  if (swReady) return swReady;
  swReady = navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
  return swReady;
}

/**
 * Show a notification. Android Chrome refuses `new Notification()` and requires
 * the service worker path, so prefer the worker and fall back to the
 * constructor on desktop.
 */
async function notify(title, body, tag) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const options = {
    body,
    tag,
    renotify: false,
    silent: false,
    icon: `${import.meta.env.BASE_URL}icon.svg`,
    badge: `${import.meta.env.BASE_URL}icon.svg`,
  };
  try {
    const reg = await registerServiceWorker();
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/* ──────────────────────────── Time helpers ──────────────────────────── */

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

const withinWindow = (from, to) => {
  const n = nowMinutes();
  const a = toMinutes(from);
  const b = toMinutes(to);
  return b >= a ? n >= a && n <= b : n >= a || n <= b; // handles windows past midnight
};

/* ──────────────────────────── Streak logic ──────────────────────────── */

/** Consecutive days ending today (or yesterday, if today is not logged yet). */
export function loggingStreak(days) {
  const hasEntries = (key) => {
    const d = days[key];
    if (!d) return false;
    return Object.values(d.meals || {}).some((list) => list.length > 0);
  };

  let streak = 0;
  const cursor = new Date();

  // Today not being logged yet does not break a streak — it is still early.
  if (!hasEntries(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  for (;;) {
    if (!hasEntries(todayKey(cursor))) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function loggedToday(days) {
  const d = days[todayKey()];
  return !!d && Object.values(d.meals || {}).some((list) => list.length > 0);
}

const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

function milestoneReached(streak, lastMilestone) {
  const hit = MILESTONES.filter((m) => m <= streak).pop();
  return hit && hit > lastMilestone ? hit : null;
}

/* ────────────────────────────── The tick ────────────────────────────── */

/**
 * Evaluate every reminder against the current state. Returns the patch to
 * merge back into `reminders` (bookkeeping timestamps) plus anything that
 * should surface as an in-app nudge, so reminders still land even when
 * notification permission was declined.
 *
 * Pure decision-making apart from the actual `notify()` call, which makes it
 * straightforward to reason about and to test.
 */
export async function runReminderTick({ reminders, days, waterGoalGlasses }) {
  if (!reminders?.enabled) return null;

  const patch = {};
  const nudges = [];
  const now = Date.now();
  const today = todayKey();

  /* ── Water ── */
  const w = reminders.water;
  if (w?.on) {
    const glasses = days[today]?.water || 0;
    const done = glasses >= waterGoalGlasses;
    const dueAt = (reminders.lastWaterAt || 0) + w.everyMinutes * 60_000;

    if (!done && withinWindow(w.from, w.to) && now >= dueAt) {
      const left = Math.max(0, waterGoalGlasses - glasses);
      const litres = (left * 0.25).toFixed(2);
      const title = 'Time for water 💧';
      const body =
        glasses === 0
          ? `Nothing logged yet today. ${litres} L to go — start with a glass now.`
          : `${glasses} of ${waterGoalGlasses} glasses so far. ${litres} L left today.`;

      await notify(title, body, 'nutritrack-water');
      nudges.push({ id: 'water', tone: 'info', icon: 'drop', title, body, action: 'water', actionLabel: 'Log a glass' });
      patch.lastWaterAt = now;
    }
  }

  /* ── Streak ── */
  const s = reminders.streak;
  if (s?.on && reminders.lastStreakDay !== today) {
    const streak = loggingStreak(days);
    const isLogged = loggedToday(days);
    const dueNow = nowMinutes() >= toMinutes(s.at);

    if (isLogged) {
      // Celebrate a milestone the moment it is earned, whatever the hour.
      const hit = milestoneReached(streak, reminders.lastMilestone || 0);
      if (hit) {
        const title = `${hit}-day streak 🔥`;
        const body =
          hit >= 30
            ? `${hit} days logged in a row. This is not motivation any more, it is a habit.`
            : `${hit} days in a row. Consistency is the whole game — keep it going.`;
        await notify(title, body, 'nutritrack-streak');
        // A milestone is a celebration, not a to-do — no action button.
        nudges.push({ id: 'streak', tone: 'good', icon: 'flame', title, body });
        patch.lastMilestone = hit;
        patch.lastStreakDay = today;
      }
    } else if (dueNow) {
      const title = streak > 0 ? `Your ${streak}-day streak is at risk 🔥` : 'Nothing logged today';
      const body =
        streak > 0
          ? `You have not logged anything today. One meal keeps the run alive.`
          : 'Log a single meal to start a streak — the first day is the hard one.';
      await notify(title, body, 'nutritrack-streak');
      nudges.push({ id: 'streak', tone: 'warn', icon: 'flame', title, body, action: 'log', actionLabel: 'Log a meal' });
      patch.lastStreakDay = today;
    }
  }

  if (!Object.keys(patch).length && !nudges.length) return null;
  return { patch, nudges };
}

/** A friendly summary of the current schedule, for the Settings screen. */
export function describeSchedule(reminders) {
  if (!reminders.enabled) return 'Reminders are off.';
  const bits = [];
  if (reminders.water?.on) {
    const hrs = reminders.water.everyMinutes / 60;
    const every = hrs >= 1 ? `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} h` : `${reminders.water.everyMinutes} min`;
    bits.push(`water every ${every} between ${reminders.water.from} and ${reminders.water.to}`);
  }
  if (reminders.streak?.on) bits.push(`a streak check at ${reminders.streak.at}`);
  return bits.length ? `You will get ${bits.join(', and ')}.` : 'Both reminders are switched off.';
}
