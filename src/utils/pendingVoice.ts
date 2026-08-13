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
/**
 * Reads the pending entry, retrying briefly before giving up.
 *
 * The intent writes to `UserDefaults` from its own process and then asks iOS to
 * open the app; the app's first read can happen before that write is visible to
 * it, and nothing re-reads afterwards because the app is already foregrounded —
 * no `visibilitychange` fires. The symptom is the app opening on the Today tab
 * as if nothing was said, and the draft appearing only after a manual close and
 * reopen.
 *
 * A single `synchronize()` on the writing side isn't enough to fix that, so the
 * reader keeps asking for a few seconds. Nothing is lost if it gives up: the
 * value stays in `UserDefaults` and the next foreground picks it up.
 */
export async function awaitPendingVoiceEntry(timeoutMs = 4000, intervalMs = 250): Promise<PendingVoiceEntry | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const entry = await consumePendingVoiceEntry();
    if (entry) return entry;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export interface PendingVoiceEntry {
  /** What was said about the pain, plus anything else volunteered. */
  note: string;
  /** The separate answer to "when did it start?" — never parsed for severity. */
  started: string;
}

export async function consumePendingVoiceEntry(): Promise<PendingVoiceEntry | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await Preferences.get({ key: PENDING_VOICE_KEY });
    if (!value) return null;
    await Preferences.remove({ key: PENDING_VOICE_KEY });
    return parsePendingVoiceEntry(value);
  } catch (err) {
    console.error('Failed to read pending voice entry:', err);
    return null;
  }
}

/**
 * The App Intent writes JSON with its three answers kept apart. The Siri
 * Shortcut deep link (`?voice=`) predates that and sends one plain transcript,
 * so anything that isn't JSON is treated as the pain answer alone.
 */
export function parsePendingVoiceEntry(value: string): PendingVoiceEntry | null {
  let note = value;
  let started = '';
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'note' in parsed) {
      const p = parsed as Record<string, unknown>;
      // "Anything else" is more of the same free text, so it just joins the
      // pain answer — the parser reads the whole sentence either way.
      note = [p.note, p.extras].filter((s) => typeof s === 'string' && s.trim()).join('. ');
      started = typeof p.started === 'string' ? p.started : '';
    }
  } catch {
    // Not JSON: the deep-link transcript.
  }
  note = note.trim();
  started = started.trim();
  return note || started ? { note, started } : null;
}
