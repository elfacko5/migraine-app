// Service worker — handles notification scheduling and action button responses.
// Notifications are scheduled via postMessage from the page; timers live in SW
// memory so they persist across tab navigation (but not browser restarts).

const pendingTimers = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { type, attackId, delayMs, title, body } = event.data ?? {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    if (pendingTimers.has(attackId)) clearTimeout(pendingTimers.get(attackId));
    const tid = setTimeout(async () => {
      pendingTimers.delete(attackId);
      await self.registration.showNotification(title ?? "How's your migraine?", {
        body: body ?? 'Tap to add an update.',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: { attackId },
        actions: [
          { action: 'update', title: 'Something changed' },
          { action: 'no_change', title: 'No change' },
          { action: 'snooze', title: 'Snooze 30 min' },
        ],
        requireInteraction: true,
      });
    }, delayMs);
    pendingTimers.set(attackId, tid);
  }

  if (type === 'CANCEL_NOTIFICATION') {
    if (pendingTimers.has(attackId)) {
      clearTimeout(pendingTimers.get(attackId));
      pendingTimers.delete(attackId);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action } = event;
  const { attackId } = event.notification.data ?? {};

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    const msg = { type: 'NOTIFICATION_ACTION', action, attackId };

    if (clients.length > 0) {
      clients[0].postMessage(msg);
      if (action !== 'no_change') await clients[0].focus();
    } else {
      const url = action === 'no_change' ? `/?swAction=no_change&id=${attackId}` : `/?swAction=update&id=${attackId}`;
      const win = await self.clients.openWindow(url);
      win?.postMessage(msg);
    }
  })());
});
