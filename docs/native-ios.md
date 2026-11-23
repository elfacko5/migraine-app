# Native iOS shell (Capacitor)

Extended notes for the Capacitor wrap. Rules are in CLAUDE.md; this file carries the reasoning and history.

## Build-web-assets run-script phase

The Xcode build phase calls `nvm use && npm run build && npx cap copy ios`. It is set to **always run** ("Based on dependency analysis" unchecked) because Xcode has no way to track Vite's dependency graph. If nvm is missing from PATH the phase fails with `nvm: command not found` — the phase sources `~/.nvm/nvm.sh` explicitly.

Pressing **Run** in Xcode rebuilds the web layer automatically. No separate `npm run build && npx cap copy` step is needed unless you want to verify the web build independently.

## Bundle identifier

`capacitor.config.ts` sets `appId: 'com.sunny.migrainetracker2'`. This must match `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project. A mismatch causes Capacitor to create a second app container on the device, losing all localStorage data.

The `2` suffix exists because the original `com.sunny.migrainetracker` was used during early prototyping and burned a provisioning slot.

## Free provisioning

Free (personal team) provisioning means:
- Builds expire **7 days** after install. The app stops launching; reinstall from Xcode.
- First launch on a new device requires trusting the certificate: Settings → General → VPN & Device Management → developer certificate → Trust.
- Maximum 3 app IDs active at once (10 per week rolling).
- No push notifications, no associated domains (deep links work via custom scheme only).

The widget extension (`LiddWidget`) and the App Group (`group.com.sunny.migrainetracker2`) both work under free provisioning — this was verified August 2026.

## CocoaPods

`pod install` requires locale environment variables or it fails on emoji in Podfile.lock:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

## Modifying the Xcode project

**Never hand-edit `project.pbxproj`.** Use the `xcodeproj` Ruby gem to add Swift files, targets, build phases, etc. Hand edits invariably break UUIDs or leave orphan references that cause silent build failures.

The gem is installed via `gem install xcodeproj`. Scripts that use it live in `scripts/`.

## Simulator quirks

- **Trackpad scrolling doesn't work** in the Capacitor WebView on Simulator — the document never scrolls. Touch drags (click-and-drag) work fine. This is a known WebKit-in-Simulator limitation, not a bug in the app.
- **Keyboard plugin** (`@capacitor/keyboard`): `setAccessoryBarVisible` has no effect on Simulator. Test keyboard behaviour on a real device.

## App naming

- `CFBundleDisplayName` = "Lidd" (home screen)
- `CFBundleName` = "Lidd" (Settings, Spotlight)
- `INAlternativeAppNames` carries up to 3 alternatives for Siri (fourth = Siri refuses to install the intent). Currently: "Lidd", "Lid", "Lead" (covering common mis-transcriptions).

## Deployment target

iOS 15.0. This is the floor for App Intents (iOS 16) but the intent code is guarded with `@available(iOS 16, *)`. The 15.0 target keeps the WebView baseline reasonable — WKWebView on 15 supports all JS/CSS features the app uses.
