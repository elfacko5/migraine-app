import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match PRODUCT_BUNDLE_IDENTIFIER in the Xcode project. The original
  // com.sunny.migrainetracker could not be registered for free provisioning,
  // so the Xcode target moved to ...tracker2 and this follows it.
  appId: 'com.sunny.migrainetracker2',
  appName: 'Migraine Tracker',
  webDir: 'dist',
};

export default config;
