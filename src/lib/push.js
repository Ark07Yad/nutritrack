/**
 * Talking to the push backend.
 *
 * What leaves the device: the push endpoint the browser minted, your reminder
 * schedule, a UTC offset, and two date strings meaning "water goal met today"
 * and "logged today". That is the whole payload. The server needs those two
 * flags so it does not push you a reminder you have already acted on; it
 * cannot tell what you drank or ate from them.
 *
 * The notification text itself is written by the service worker on the device.
 */

import { todayKey } from './calc';
import { registerServiceWorker } from './reminders';

const SERVER = (import.meta.env.VITE_PUSH_SERVER || '').replace(/\/+$/, '');

export const pushServerConfigured = Boolean(SERVER);
export const pushServerUrl = SERVER;

/** Browsers need the VAPID public key as a Uint8Array, not base64url. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

async function api(path, options = {}, timeoutMs = 8000) {
  if (!SERVER) throw new Error('No push server configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SERVER}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `Server returned ${res.status}`);
      // Callers branch on this rather than on the message text, so rewording a
      // server error cannot silently break behaviour.
      err.status = res.status;
      throw err;
    }
    return body;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The push server did not respond');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Is the configured server reachable and able to send? */
export async function checkServer() {
  if (!SERVER) return { reachable: false, reason: 'not-configured' };
  try {
    const health = await api('/health', {}, 5000);
    return {
      reachable: true,
      vapidConfigured: !!health.vapidConfigured,
      subscriptions: health.subscriptions,
      url: SERVER,
    };
  } catch (err) {
    return { reachable: false, reason: err.message, url: SERVER };
  }
}

/** The schedule, in the shape the server expects. */
function prefsFrom({ reminders, days, waterGoalGlasses = 0 }) {
  const today = todayKey();
  const day = days?.[today];
  const glasses = day?.water || 0;
  const logged = !!day && Object.values(day.meals || {}).some((l) => l.length > 0);

  return {
    waterOn: !!reminders.water?.on,
    waterEveryMinutes: reminders.water?.everyMinutes ?? 90,
    waterFrom: reminders.water?.from ?? '08:00',
    waterTo: reminders.water?.to ?? '22:00',
    streakOn: !!reminders.streak?.on,
    streakAt: reminders.streak?.at ?? '20:00',
    // Minutes to ADD to UTC to get local time, which is the opposite sign to
    // what getTimezoneOffset() reports.
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
    waterDoneDay: waterGoalGlasses > 0 && glasses >= waterGoalGlasses ? today : '',
    loggedDay: logged ? today : '',
  };
}

/**
 * Subscribe this device. Returns the subscription id to store locally so we
 * can update or remove it later.
 */
export async function subscribe({ reminders, days, waterGoalGlasses }) {
  if (!pushSupported()) throw new Error('This browser does not support push notifications');
  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') throw new Error('Notification permission was not granted');
  }

  const { publicKey } = await api('/api/vapid-public-key');
  if (!publicKey) throw new Error('The server has no VAPID key configured');

  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Service worker registration failed');

  // Reuse an existing subscription unless it was minted for a different key —
  // re-subscribing with a changed applicationServerKey throws otherwise.
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const existingKey = btoa(String.fromCharCode(...new Uint8Array(sub.options?.applicationServerKey || [])))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (existingKey && existingKey !== publicKey) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const saved = await api('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      subscription: sub.toJSON(),
      prefs: prefsFrom({ reminders, days, waterGoalGlasses }),
    }),
  });

  return saved.id;
}

/**
 * Push the current schedule and suppression flags to the server.
 *
 * Returns the subscription id, which may differ from the one passed in: if the
 * server no longer recognises this device, it re-registers automatically.
 *
 * That matters because free hosting tiers generally have no persistent disk,
 * so the server's database is wiped on every restart. Without this, reminders
 * would stop dead and you would have no way of knowing why — the app would
 * happily believe it was still subscribed. Self-healing makes an ephemeral
 * store a survivable trade rather than a silent failure.
 */
export async function syncPrefs(id, { reminders, days, waterGoalGlasses }) {
  const prefs = prefsFrom({ reminders, days, waterGoalGlasses });

  if (id) {
    try {
      await api(`/api/subscribe/${id}`, { method: 'PATCH', body: JSON.stringify(prefs) });
      return id;
    } catch (err) {
      // 404 means the server has forgotten this device. Anything else is
      // transient — offline, restarting, rate-limited — and re-subscribing
      // would not help.
      if (err.status !== 404) throw err;
    }
  }

  return subscribe({ reminders, days, waterGoalGlasses });
}

export async function sendTestPush(id) {
  if (!id) throw new Error('This device is not subscribed');
  return api(`/api/test/${id}`, { method: 'POST' });
}

/** Unsubscribe both locally and on the server. */
export async function unsubscribe(id) {
  try {
    const reg = await registerServiceWorker();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    /* the local half may already be gone; still tell the server */
  }
  if (id) await api(`/api/subscribe/${id}`, { method: 'DELETE' }).catch(() => {});
}
