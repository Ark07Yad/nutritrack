/**
 * NutriTrack service worker.
 *
 * The interesting part is the push handler. The server sends only a wake-up
 * signal — `{ kind: 'water' }` — and never learns anything about your log. This
 * worker then opens the app's own IndexedDB, reads today's numbers, and writes
 * the notification text here on the device. So the notification can say
 * "6 of 15 glasses, 2.25 L to go" without that ever having left your phone.
 *
 * It deliberately does not cache anything. Offline caching needs a real
 * invalidation strategy, and getting that subtly wrong is how people end up
 * stuck on a stale build.
 */

const DB_NAME = 'nutritrack';
const STORE = 'state';
const STATE_KEY = 'app';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/* ─────────────────────────── Reading local state ─────────────────────────── */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // If the app has never run, there is nothing to upgrade into — bail rather
    // than creating an empty database the app would then have to migrate.
    req.onupgradeneeded = () => { req.transaction.abort(); reject(new Error('no state')); };
  });
}

async function readState() {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE)) return null;
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(STATE_KEY);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return null;
  }
}

const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayHasMeals = (day) =>
  !!day && Object.values(day.meals || {}).some((list) => Array.isArray(list) && list.length > 0);

function loggingStreak(days) {
  let streak = 0;
  const cursor = new Date();
  if (!dayHasMeals(days[todayKey(cursor)])) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    if (!dayHasMeals(days[todayKey(cursor)])) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ──────────────────────── Composing the notification ──────────────────────── */

function waterNotification(state) {
  const days = state?.days || {};
  const glasses = days[todayKey()]?.water || 0;
  const goal = Math.round((state?.profile?.gender === 'female' ? 2.7 : 3.7) / 0.25);

  // The server suppresses these once the device reports the goal met, but a
  // race is possible — re-check here so a stale push cannot nag you.
  if (glasses >= goal) return null;

  const left = Math.max(0, goal - glasses);
  return {
    title: 'Time for water 💧',
    options: {
      body:
        glasses === 0
          ? `Nothing logged yet today. ${(left * 0.25).toFixed(2)} L to go — start with a glass now.`
          : `${glasses} of ${goal} glasses so far. ${(left * 0.25).toFixed(2)} L left today.`,
      tag: 'nutritrack-water',
      data: { kind: 'water' },
      actions: [
        { action: 'log-water', title: 'Log a glass' },
        { action: 'dismiss', title: 'Not now' },
      ],
    },
  };
}

function streakNotification(state) {
  const days = state?.days || {};
  if (dayHasMeals(days[todayKey()])) return null; // already logged since the server decided

  const streak = loggingStreak(days);
  return {
    title: streak > 0 ? `Your ${streak}-day streak is at risk 🔥` : 'Nothing logged today',
    options: {
      body:
        streak > 0
          ? 'You have not logged anything today. One meal keeps the run alive.'
          : 'Log a single meal to start a streak — the first day is the hard one.',
      tag: 'nutritrack-streak',
      data: { kind: 'streak' },
      actions: [{ action: 'open-diary', title: 'Log a meal' }],
    },
  };
}

/**
 * A push must result in a visible notification — browsers revoke the
 * subscription of sites that swallow them. So when the local state says the
 * reminder is no longer relevant, show something true and useful rather than
 * nothing at all.
 */
function fallbackNotification(kind, state) {
  if (kind === 'water') {
    return {
      title: 'Water goal reached 💧',
      options: { body: 'You have already hit your target for today. Nicely done.', tag: 'nutritrack-water' },
    };
  }
  const streak = loggingStreak(state?.days || {});
  return {
    title: streak > 0 ? `${streak}-day streak going 🔥` : 'NutriTrack',
    options: { body: 'Today is already logged. Nothing needed from you.', tag: 'nutritrack-streak' },
  };
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data?.json() || {};
      } catch {
        payload = { kind: 'water' };
      }

      const state = await readState();

      if (payload.kind === 'test') {
        return self.registration.showNotification('NutriTrack', {
          body: 'Background reminders are working. This came from the server.',
          tag: 'nutritrack-test',
          icon: '/icon.svg',
          badge: '/icon.svg',
        });
      }

      const built =
        payload.kind === 'streak' ? streakNotification(state) : waterNotification(state);

      const { title, options } = built || fallbackNotification(payload.kind, state);

      return self.registration.showNotification(title, {
        icon: '/icon.svg',
        badge: '/icon.svg',
        renotify: false,
        ...options,
      });
    })()
  );
});

/* ──────────────────────────────── Clicks ──────────────────────────────── */

/**
 * Actions route through the page rather than writing to IndexedDB here — two
 * writers on one database is a race worth not having. The hash tells the app
 * what to do whether it was already open or is starting cold.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const hash =
    event.action === 'log-water' ? '#log-water'
    : event.action === 'open-diary' || event.notification.data?.kind === 'streak' ? '#diary'
    : '';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if ('focus' in client) {
          if (hash) client.postMessage({ type: 'notification-action', action: hash.slice(1) });
          return client.focus();
        }
      }
      return self.clients.openWindow(self.registration.scope + hash);
    })()
  );
});
