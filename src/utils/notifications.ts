import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Attack } from '../types';
import { attackMaxSeverity } from './stats';
import { formatTime } from './format';
import { queuePendingAction } from './pendingActions';

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
// The snooze interval itself lives with whoever reschedules: 30 minutes in
// NotificationActionHandler.swift on native, in public/sw.js on web.
const ACTION_TYPE_ID = 'MIGRAINE_CHECKIN';

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
  const areas = Object.keys(cur.areas).join(', ') || 'unknown area';
  // The body is frozen when the notification is *scheduled*, but read when it
  // fires — an interval later — and often later still, since the point of the
  // reminder is that the user isn't looking at the phone. Anything relative
  // ("Started just now", via formatElapsed) is therefore wrong by the time
  // anyone sees it: an attack logged at 14:05 with a 30-minute reminder
  // announced "Started just now" at 14:35. An absolute clock time stays true
  // however long the notification sits unread.
  return `Started ${formatTime(first.time)} · ${areas} · severity ${severity}`;
}

const TITLE = "How's your migraine?";

// Registers the notification's action buttons. Native only, and must run
// before the first schedule() or iOS shows the notification with no buttons.
//
// `foreground` maps to UNNotificationAction's .foreground option, which brings
// the app up when the action is tapped. "Something changed" needs it — it opens
// the update wizard. The other two do not, because they are now resolved in
// Swift by `NotificationActionHandler`, which iOS runs whether or not there is
// a WebView alive.
//
// Both were `foreground: true` for a while, and that was not a preference: the
// handling lived in JavaScript inside the WebView, so with the app evicted from
// memory a background action had nothing to run it and silently did nothing.
// Opening the app was the lesser evil until the native handler existed.
export async function registerNotificationActions(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [{
        id: ACTION_TYPE_ID,
        actions: [
          { id: 'update', title: 'Something changed', foreground: true },
          { id: 'no_change', title: 'No change', foreground: false },
          { id: 'snooze', title: 'Snooze 30 min', foreground: false },
        ],
      }],
    });
  } catch (err) {
    console.error('Failed to register notification actions:', err);
  }
}

/** A reminder the OS is actually holding, for the diagnostics readout. */
export interface PendingReminder {
  id: number;
  /** When it will fire, if the OS reports a schedule. */
  at: string | null;
}

/**
 * What is genuinely queued, read back from the OS rather than inferred.
 *
 * **This exists because notification bugs here have been invisible three
 * times.** Every failure so far looked identical from the outside — nothing
 * arrives — whether the cause was a missing bundled sound, a stale web
 * bundle, permission never granted, or a schedule that was never made. The
 * app could always say what it *meant* to do and never what the OS was
 * actually holding, so every diagnosis started by guessing.
 *
 * Native only: on the web the pending timers live inside the service worker,
 * which has no equivalent read-back.
 */
export async function pendingReminders(): Promise<PendingReminder[] | null> {
  if (!isNative()) return null;
  try {
    const res = await LocalNotifications.getPending();
    return res.notifications.map((n) => ({
      id: n.id,
      at: n.schedule?.at ? new Date(n.schedule.at).toISOString() : null,
    }));
  } catch (err) {
    console.error('Failed to read pending notifications:', err);
    return null;
  }
}

/** Whether the OS will actually deliver anything — the other silent failure. */
export async function notificationPermission(): Promise<string> {
  if (!isNative()) return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  try {
    return (await LocalNotifications.checkPermissions()).display;
  } catch {
    return 'unknown';
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
        // Without this the plugin leaves `content.sound` nil, and iOS then
        // delivers the reminder *silently* — no alert tone, but also no
        // vibration and no tap on a paired Apple Watch, since those are driven
        // by the notification having a sound. A reminder nobody can feel is
        // useless to someone lying down with a migraine.
        //
        // It has to be a real file in the bundle (`ios/App/App/reminder.wav`,
        // in the target's Copy Bundle Resources). The plugin can't express
        // `UNNotificationSound.default` — it only takes a filename — and its
        // docs claim an unresolvable name falls back to the system default.
        // It does not: tested on device, a name with no matching file is
        // silent, which is the same bug wearing a disguise.
        sound: 'reminder.wav',
        // followUpMs is for the Swift handler: when the user answers "No
        // change" it schedules the next reminder itself, and it has no way to
        // work the interval out — that needs the attack's notificationConfig
        // and snapshot count, both of which live in localStorage.
        extra: { attackId: attack.id, followUpMs: followUpDelay(attack) },
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

// Subscribes to reminder button taps and returns an unsubscribe. The callback
// takes no arguments: it means *"an answer is waiting — drain the queue"*, and
// nothing more, on both platforms.
//
// The answer itself never travels through here. It is written to the pending
// queue first — in Swift on native, below on web — and `consumePendingActions`
// is the only thing that reads it. This subscription exists purely so a WebView
// that happens to be running already reacts now instead of on next foreground.
//
// It is deliberately not load-bearing. Delivering the answer *through* this
// listener is what failed twice on device: the app opened and the button did
// nothing, because the path from the OS to a React effect (Capacitor's router →
// plugin → retained event → async `addListener`) assumes a WebView further
// along than it is when a reminder launches the app. Missing the cue now costs
// a delay; missing the answer cost the answer.
//
// `snooze` never reaches here at all — it re-queues the reminder and changes no
// data (Swift on native, `public/sw.js` on web).
export function onNotificationAction(handler: () => void): () => void {
  if (isNative()) {
    const listener = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      () => handler(),
    );
    return () => { listener.then((l) => l.remove()).catch(() => {}); };
  }

  const swHandler = (e: MessageEvent) => {
    const { type, action, attackId } = e.data ?? {};
    if (type !== 'NOTIFICATION_ACTION') return;
    if (action === 'snooze') return; // handled in the SW
    if (typeof attackId !== 'number') return;
    // There is no Swift handler on web, so the page queues the answer itself,
    // then nudges — landing on exactly the same drain the native path feeds.
    void queuePendingAction({
      attackId,
      time: new Date().toISOString(),
      action: action === 'no_change' ? 'no_change' : 'update',
      rescheduled: false,
    }).then(handler);
  };
  navigator.serviceWorker?.addEventListener('message', swHandler);
  return () => navigator.serviceWorker?.removeEventListener('message', swHandler);
}

// Adaptive: +1h after the first reading, +2h after any later one.
function delayForSnapshotCount(cfg: Attack['notificationConfig'], count: number): number {
  if (!cfg.enabled) return 0;
  if (cfg.mode === 'fixed') return cfg.fixedIntervalMinutes * 60 * 1000;
  return count === 1 ? 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
}

/**
 * Two hours after a dose is the standard trial endpoint for acute migraine
 * treatment — pain freedom, or relief of the most bothersome symptom (dossier
 * §5). It is not specific to any one drug: Sumatriptan's own "2 hours" is a
 * *minimum gap between doses* off its leaflet, which is a different figure
 * that happens to share a number.
 *
 * `medicationResponse` already hunts for the reading nearest dose + 2h, so
 * this is the app asking for the reading its own metric wants.
 */
export const MED_CHECK_IN_MS = 2 * 60 * 60 * 1000;

/**
 * Brings the attack's next reminder forward to two hours after the most recent
 * dose, when that lands sooner than the reminder already due.
 *
 * **Deliberately not a second notification.** The design that was specced
 * added a separate dose check-in and then had to suppress it whenever it fell
 * within ~30 minutes of an attack reminder — but the adaptive schedule is
 * already +2h from each reading, so a dose check-in at +2h would collide
 * nearly every time and the suppression would be the common case rather than
 * the edge one. Re-timing the reminder we already have gets the same reading
 * with one notification, and avoids carving `notifId()`'s 32-bit space into
 * two namespaces to stop the two colliding.
 *
 * Only ever moves a reminder *earlier*. A dose backdated more than two hours
 * leaves the schedule alone rather than firing something immediately: the
 * response window runs to four hours, so a late reading still counts, and a
 * notification that arrives the instant you finish logging is noise.
 */
export function medCheckInDelay(attack: Attack, baseDelay: number, now: number = Date.now()): number {
  const lastDose = [...attack.snapshots].reverse().find((s) => s.medication?.name);
  if (!lastDose) return baseDelay;
  const due = new Date(lastDose.time).getTime() + MED_CHECK_IN_MS - now;
  return due > 0 && due < baseDelay ? due : baseDelay;
}

export function nextDelay(attack: Attack): number {
  return medCheckInDelay(
    attack,
    delayForSnapshotCount(attack.notificationConfig, attack.snapshots.length),
  );
}

// The interval that will apply once a "no change" reading lands — one more
// snapshot than the attack has now. Carried in the notification so the Swift
// handler can schedule the follow-up at the moment the button is tapped
// instead of leaving the chain stalled until the app is next opened.
function followUpDelay(attack: Attack): number {
  return delayForSnapshotCount(attack.notificationConfig, attack.snapshots.length + 1);
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
