import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Where the Siri App Intent leaves what the user said. `LogMigraineIntent.swift`
// writes the same key straight into UserDefaults as
// `CapacitorStorage.pendingVoiceEntry` — the exact location and prefix
// @capacitor/preferences reads from on iOS — so the two sides meet without a
// custom native bridge. Change one and you must change the other.
export const PENDING_VOICE_KEY = 'pendingVoiceEntry';

/**
 * Reads the transcript the Siri intent left behind and clears it, so it is
 * consumed exactly once. Returns null on web (no intent can have run) and
 * whenever nothing is waiting.
 *
 * Clearing before the caller acts on the text is deliberate: a transcript that
 * fails to open a sheet is a lost log entry, but one that never clears would
 * re-open the wizard on every foreground, which is worse.
 */
export async function consumePendingVoiceEntry(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await Preferences.get({ key: PENDING_VOICE_KEY });
    if (!value) return null;
    await Preferences.remove({ key: PENDING_VOICE_KEY });
    return value.trim() || null;
  } catch (err) {
    console.error('Failed to read pending voice entry:', err);
    return null;
  }
}
