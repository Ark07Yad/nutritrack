/**
 * Minimal service worker.
 *
 * It exists for two reasons only:
 *   1. Android Chrome refuses `new Notification()` and requires notifications
 *      to be shown through a service worker registration.
 *   2. Clicking a notification should focus the existing tab rather than
 *      opening a second copy of the app.
 *
 * It deliberately does not cache anything. Offline caching would need a real
 * cache-invalidation strategy, and getting that subtly wrong is how people end
 * up stuck on a stale build.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
