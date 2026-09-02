import { Capacitor, registerPlugin } from '@capacitor/core';

// The native date/time wheel, presented by `LiddDatePickerPlugin` in the app
// target. See that file for why it exists: WebKit draws a "Reset" button and a
// blue checkmark above its own picker, no CSS or WKWebView API reaches them,
// and the only way to a bare wheel is not to use a native input at all.
//
// **The plugin lives in the app target, so it is registered by hand** in
// `LiddBridgeViewController` — Capacitor auto-registers only npm packages.
// If that registration is ever lost, every call here rejects `UNIMPLEMENTED`,
// which is why the caller falls back to the HTML input rather than leaving the
// field dead.

export type NativePickerMode = 'time' | 'datetime';

interface PresentOptions {
  mode: NativePickerMode;
  /** Local-input form, `YYYY-MM-DDTHH:mm` — the same shape `isoToLocalInput`
   *  produces, so neither side has to convert. */
  value: string;
  min?: string;
  max?: string;
}

interface LiddDatePickerPlugin {
  present(options: PresentOptions): Promise<{ value: string }>;
}

const plugin = registerPlugin<LiddDatePickerPlugin>('LiddDatePicker');

/** Whether to prefer the native wheel over the browser's own control. */
export const hasNativeDatePicker = () => Capacitor.isNativePlatform();

/**
 * Resolves to the chosen value, or `null` if the plugin isn't there — the
 * caller should then fall back to the HTML input for the rest of the session
 * rather than leaving a field that does nothing.
 */
export async function presentNativeDatePicker(options: PresentOptions): Promise<string | null> {
  try {
    const { value } = await plugin.present(options);
    return value ?? null;
  } catch (err) {
    console.error('Native date picker unavailable', err);
    return null;
  }
}
