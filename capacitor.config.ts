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
      // 'none': the webview is not resized, and the package's AppRoot alone
      // follows the visible area (frame height and offset), as it did before
      // the plugin. 'native' was tried first and made the Save button slide in
      // about a second late on the phone, where the build without the plugin
      // was perfectly still. The plugin is here for the keyboard's own bar
      // (see src/utils/keyboardBar.ts), not for resizing. Reasons and June's
      // words: docs/decisions.md, "Keyboard plugin: resize 'none'". To revert,
      // `git revert` that commit.
      resize: 'none',
    },
  },
};

export default config;
