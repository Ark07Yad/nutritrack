/**
 * Sending. Thin wrapper over web-push that also handles the one thing every
 * push backend gets wrong at first: subscriptions expire, and if you keep
 * hammering dead endpoints the push service starts rate-limiting you.
 *
 * A 404 or 410 from the push service means the browser threw the subscription
 * away — uninstalled, permission revoked, profile cleared. That is not an error
 * to retry, it is a signal to delete the row.
 */

import webpush from 'web-push';
import { noteFailure, removeSubscription } from './db.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

export const vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:nobody@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export const publicKey = VAPID_PUBLIC_KEY || null;

const toSubscription = (row) => ({
  endpoint: row.endpoint,
  keys: { p256dh: row.p256dh, auth: row.auth },
});

/**
 * Send a payload to one device.
 *
 * The payload is only a wake-up signal — `{ kind: 'water' }` or
 * `{ kind: 'streak' }`. The service worker on the device reads the local log
 * and writes the actual wording, so nothing about what you ate ever has to
 * reach this server in order for the notification to be specific.
 */
export async function sendTo(row, payload, { ttl = 3600, urgency = 'normal' } = {}) {
  if (!vapidConfigured) return { ok: false, reason: 'vapid-not-configured' };

  try {
    await webpush.sendNotification(toSubscription(row), JSON.stringify(payload), {
      TTL: ttl,
      urgency,
      topic: payload.kind, // lets the push service collapse duplicates
    });
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;

    if (status === 404 || status === 410) {
      removeSubscription(row.id);
      return { ok: false, reason: 'expired', pruned: true };
    }
    if (status === 413) return { ok: false, reason: 'payload-too-large' };
    if (status === 429) return { ok: false, reason: 'rate-limited' };

    noteFailure(row.id);
    return { ok: false, reason: err?.message || 'send-failed', status };
  }
}

/** Generate a VAPID keypair. Used by `npm run keys`. */
export const generateKeys = () => webpush.generateVAPIDKeys();
