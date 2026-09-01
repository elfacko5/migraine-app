import { Preferences } from '@capacitor/preferences';

// Reminder answers that were resolved outside the app and are waiting to be
// written into an attack.
//
// On iOS, `NotificationActionHandler.swift` handles the "No change" button
// without opening the app — but it cannot write the reading itself, since
// attacks live in `localStorage` inside the WebView. So it queues it here and
// the web layer appends it on next launch. The queue carries the *tap* time,
// not the drain time: the whole point is that the app may not be opened for
// hours, and a reading stamped when it was finally read would be a lie.
//
// The web build queues through the same key rather than writing the snapshot
// directly, so both platforms take one code path. `@capacitor/preferences` is
// what makes that possible: `UserDefaults.standard` with a `CapacitorStorage.`
// prefix on iOS (which is where the Swift side writes), `localStorage` with
// the same prefix on web.
//
// **The key is duplicated in Swift — change one, change the other.**
export const PENDING_ACTIONS_KEY = 'pendingNotificationActions';

export interface PendingAction {
  attackId: number;
  /** ISO timestamp of when the button was tapped. */
  time: string;
  /**
   * `no_change` records a reading; `update` asks for the wizard to be opened.
   *
   * `update` goes through the queue too, even though it always brings the app
   * to the foreground and could in principle be delivered live. It was
   * delivered live once, through Capacitor's notification listener, and the
   * button did nothing twice — the chain from the OS to a React effect runs
   * router → plugin → retained event → async `addListener`, and every link of
   * it depends on the WebView being further along than it necessarily is when
   * a reminder launches the app. The queue survives all of that: worst case
   * the wizard opens a moment later instead of never.
   */
  action: 'no_change' | 'update';
  /**
   * Whether the follow-up reminder was already queued by whoever handled the
   * tap. True from the native handler, which schedules it at tap time so the
   * chain doesn't stall while the app is closed; false on web, where the
   * service worker only reports the tap and the drain schedules as usual.
   * Meaningless for `update`.
   */
  rescheduled: boolean;
}

function isPendingAction(value: unknown): value is PendingAction {
  const a = value as PendingAction | null;
  return !!a && typeof a.attackId === 'number' && typeof a.time === 'string'
    && (a.action === 'no_change' || a.action === 'update');
}

export async function queuePendingAction(entry: PendingAction): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: PENDING_ACTIONS_KEY });
    const queue: unknown = value ? JSON.parse(value) : [];
    const existing = Array.isArray(queue) ? queue : [];
    await Preferences.set({ key: PENDING_ACTIONS_KEY, value: JSON.stringify([...existing, entry]) });
  } catch (err) {
    console.error('Failed to queue notification action:', err);
  }
}

/**
 * Reads every queued answer and clears the queue, so each is applied once.
 *
 * Clearing before the caller has written the snapshots risks losing a reading
 * if that write then fails — but the alternative, clearing afterwards, risks
 * replaying the whole queue on every foreground, which would silently
 * multiply readings in someone's health record. Losing one is the better
 * failure.
 */
export async function consumePendingActions(): Promise<PendingAction[]> {
  try {
    const { value } = await Preferences.get({ key: PENDING_ACTIONS_KEY });
    if (!value) return [];
    await Preferences.remove({ key: PENDING_ACTIONS_KEY });
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isPendingAction) : [];
  } catch (err) {
    console.error('Failed to read pending notification actions:', err);
    return [];
  }
}
