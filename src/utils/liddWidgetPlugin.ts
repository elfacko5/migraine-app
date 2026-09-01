import { registerPlugin } from '@capacitor/core';

/**
 * The native bridge to the widget extension.
 *
 * Its own module because two unrelated callers need it — `widgetSnapshot.ts`
 * publishes the payload, and `pendingActions.ts` drains answers given from the
 * widget's button — and the second should not have to pull in the first's
 * dependency on `stats` and the medication guardrails to reach one plugin
 * handle.
 *
 * It exists at all because `@capacitor/preferences` cannot serve a separate
 * process: it writes to `UserDefaults.standard`, which the extension cannot
 * read, and its `configure({ group })` switches the store *globally*, which
 * would move `pendingNotificationActions` and `pendingVoiceEntry` out from
 * under the hardcoded `CapacitorStorage.` paths in
 * `NotificationActionHandler.swift` and `LogMigraineIntent.swift` and break
 * both silently. So the App Group traffic goes through here instead.
 */
export interface LiddWidgetPlugin {
  /** Writes the payload into the App Group suite and reloads every timeline. */
  publish(options: { value: string }): Promise<void>;
  /** Takes every answer given from the widget's button, and clears the queue. */
  drainActions(): Promise<{ entries: unknown[] }>;
}

export const LiddWidget = registerPlugin<LiddWidgetPlugin>('LiddWidget');
