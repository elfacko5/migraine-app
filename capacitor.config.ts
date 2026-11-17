import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match PRODUCT_BUNDLE_IDENTIFIER in the Xcode project. The original
  // com.sunny.migrainetracker could not be registered for free provisioning,
  // so the Xcode target moved to ...tracker2 and this follows it.
  appId: 'com.sunny.migrainetracker2',
  appName: 'Lidd',
  webDir: 'dist',
  ios: {
    // Stops Capacitor installing itself as the UNUserNotificationCenter
    // delegate, so `NotificationActionHandler` can — it has to be set before
    // launch finishes, and Capacitor sets it later than that. The handler
    // forwards everything the web layer still needs back to Capacitor's
    // router. Setting this back to true disables the native handling of the
    // "No change" and "Snooze" reminder buttons.
    handleApplicationNotifications: false,
  },
  plugins: {
    Keyboard: {
      // 'native': the plugin shortens the webview by the keyboard's height, so
      // everything below the field can be scrolled into view. 'none' was tried
      // after 'native' (to stop the Save button sliding in about a second late)
      // and rejected on the phone: the page is not told the keyboard is up
      // (innerHeight and visualViewport do not move), so a low field is covered
      // and cannot be scrolled to. The slide is the known cost of 'native'. The
      // plugin is also here for the keyboard's own bar (src/utils/keyboardBar.ts).
      // Reasons and June's words: docs/decisions.md, "Back to 'native'".
      resize: 'native',
    },
  },
};

export default config;
