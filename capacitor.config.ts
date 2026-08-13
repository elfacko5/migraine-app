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
};

export default config;
