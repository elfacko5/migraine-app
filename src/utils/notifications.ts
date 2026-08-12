import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Attack } from '../types';
import { attackMaxSeverity } from './stats';
import { formatElapsed } from './format';

// Reminder scheduling has two backends, chosen at runtime:
//
// - **Native (Capacitor/iOS)** — `@capacitor/local-notifications`. The OS owns
//   the timer, so a reminder still fires after the app is force-quit. This is
//   the whole reason for the native shell.
// - **Web (browser + installed PWA)** — the original service-worker path:
//   timers live in SW memory (see public/sw.js), which survives tab navigation
//   but *not* a browser restart. Kept because the app still ships as a PWA and
//   is developed in a browser.
//
// The exported signatures are identical for both, so callers (useAttacks)
// never branch on platform.

const isNative = () => Capacitor.isNativePlatform();

// Action buttons on the reminder. The ids match the `action` values the SW
// posts back, so App.tsx handles both backends with one code path.
const ACTION_TYPE_ID = 'MIGRAINE_CHECKIN';
const SNOOZE_MS = 30 * 60 * 1000;

export interface NotificationAction {
  action: string;
  attackId: number;
}

// Attack ids are `Date.now()`, which overflows the 32-bit int the plugin
// requires for a notification id, so fold it into a safe range. Deterministic,
// so cancel() derives the same id as schedule() did.
function notifId(attackId: number): number {
  return attackId % 2_000_000_000;
}

function getSW(): ServiceWorker | null {
  return navigator.serviceWorker?.controller ?? null;
}

function notificationBody(attack: Attack): string {
  const first = attack.snapshots[0];
  const cur = attack.snapshots[attack.snapshots.length - 1];
  const severity = attackMaxSeverity(attack);
  const elapsed = formatElapsed(first.time);
  const areas = Object.keys(cur.areas).join(', ') || 'unknown area';
  return `Started ${elapsed} · ${areas} · severity ${severity}`;
}

const TITLE = "How's your migraine?";

// Registers the notification's action buttons. Native only, and must run
// before the first schedule() or iOS shows the notification with no buttons.
export async function registerNotificationActions(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [{
        id: ACTION_TYPE_ID,
        actions: [
          { id: 'update', title: 'Something changed' },
          { id: 'no_change', title: 'No change' },
          { id: 'snooze', title: 'Snooze 30 min' },
        ],
      }],
    });
  } catch (err) {
    console.error('Failed to register notification actions:', err);
  }
}

export function scheduleNotification(attack: Attack, delayMs: number) {
  const body = notificationBody(attack);

  if (isNative()) {
    // Same id as any pending reminder for this attack, which the plugin
    // treats as a replace — matching the SW's clearTimeout-then-set behavior.
    LocalNotifications.schedule({
      notifications: [{
        id: notifId(attack.id),
        title: TITLE,
        body,
        schedule: { at: new Date(Date.now() + delayMs) },
        actionTypeId: ACTION_TYPE_ID,
        extra: { attackId: attack.id },
      }],
    }).catch((err) => console.error('Failed to schedule notification:', err));
    return;
  }

  const sw = getSW();
  if (!sw) return;
  sw.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    attackId: attack.id,
    delayMs,
    title: TITLE,
    body,
  });
}

export function cancelNotification(attackId: number) {
  if (isNative()) {
    LocalNotifications.cancel({ notifications: [{ id: notifId(attackId) }] })
      .catch((err) => console.error('Failed to cancel notification:', err));
    return;
  }
  getSW()?.postMessage({ type: 'CANCEL_NOTIFICATION', attackId });
}

// Subscribes to reminder button taps from whichever backend is active and
// returns an unsubscribe. `snooze` is handled internally (re-scheduled here on
// native, inside the SW on web) and never reaches the handler, so callers only
// deal with the actions that actually change data.
export function onNotificationAction(handler: (a: NotificationAction) => void): () => void {
  if (isNative()) {
    const listener = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (payload) => {
        const attackId = payload.notification.extra?.attackId as number | undefined;
        if (typeof attackId !== 'number') return;
        // `tap` is the notification body itself rather than a button — treat
        // it as "open the update sheet", same as the SW's default click.
        const action = payload.actionId === 'tap' ? 'update' : payload.actionId;
        if (action === 'snooze') {
          LocalNotifications.schedule({
            notifications: [{
              id: notifId(attackId),
              title: payload.notification.title ?? TITLE,
              body: payload.notification.body ?? '',
              schedule: { at: new Date(Date.now() + SNOOZE_MS) },
              actionTypeId: ACTION_TYPE_ID,
              extra: { attackId },
            }],
          }).catch((err) => console.error('Failed to snooze notification:', err));
          return;
        }
        handler({ action, attackId });
      },
    );
    return () => { listener.then((l) => l.remove()).catch(() => {}); };
  }

  const swHandler = (e: MessageEvent) => {
    const { type, action, attackId } = e.data ?? {};
    if (type !== 'NOTIFICATION_ACTION') return;
    if (action === 'snooze') return; // handled in the SW
    handler({ action, attackId });
  };
  navigator.serviceWorker?.addEventListener('message', swHandler);
  return () => navigator.serviceWorker?.removeEventListener('message', swHandler);
}

export function nextDelay(attack: Attack): number {
  const cfg = attack.notificationConfig;
  if (!cfg.enabled) return 0;
  if (cfg.mode === 'fixed') return cfg.fixedIntervalMinutes * 60 * 1000;
  return attack.snapshots.length === 1 ? 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
}

export const DEFAULT_NOTIFICATION_CONFIG = {
  enabled: true,
  mode: 'adaptive' as const,
  fixedIntervalMinutes: 60,
};

// Returns a label for the next scheduled notification time.
export function nextNotificationLabel(attack: Attack): string {
  const ms = nextDelay(attack);
  if (ms === 0) return '';
  const min = ms / 60000;
  if (min < 60) return `in ${min}m`;
  return `in ${min / 60}h`;
}
