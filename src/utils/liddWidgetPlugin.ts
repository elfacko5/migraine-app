import { registerPlugin } from '@capacitor/core';

/**
 * The native bridge to the widget extension.
 *
 * Its own module rather than living in `widgetSnapshot.ts`: it briefly had a
 * second caller (`pendingActions.ts`, draining answers from the widget's
 * button) and keeping the handle separate meant that caller did not have to
 * pull in a dependency on `stats` and the medication guardrails to reach one
 * plugin. The button is gone; the split is still the tidier arrangement.
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
}

export const LiddWidget = registerPlugin<LiddWidgetPlugin>('LiddWidget');
