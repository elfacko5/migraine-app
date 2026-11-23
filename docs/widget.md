# Home-screen widget (WidgetKit)

Extended notes for the LiddWidget extension. Rules are in CLAUDE.md; this file carries the reasoning, history, and debugging notes.

## Architecture: web → extension

The widget **never reads the diary directly**. The data flow is:

1. `widgetSnapshot.ts` (web layer) computes the widget payload from localStorage.
2. `useWidgetSnapshot` hook watches attack/medication/settings data and calls `LiddWidgetPlugin.setSnapshot()` whenever anything changes.
3. The plugin writes the JSON payload to the App Group container (`group.com.sunny.migrainetracker2`).
4. `reloadAllTimelines()` tells WidgetKit to re-render.
5. The Swift extension (`LiddWidget/`) reads the App Group container and draws.

The extension computes nothing — no date math, no severity aggregation, no string formatting beyond what `entryDate` provides. All logic lives in the web layer.

## Why LiddWidgetPlugin, not @capacitor/preferences

`@capacitor/preferences` stores to `UserDefaults.standard`, which is **not** accessible from an extension. The widget needs an App Group suite (`group.com.sunny.migrainetracker2`). `LiddWidgetPlugin` writes to `UserDefaults(suiteName:)` for that group.

## LiddBridgeViewController

`Main.storyboard`'s initial view controller must point to `LiddBridgeViewController` (a subclass of Capacitor's `CAPBridgeViewController`). This subclass calls `registerPluginInstance` — not the Type-based `registerPlugin` — because the plugin instance holds a reference to the App Group suite.

If `Main.storyboard` points to the base `CAPBridgeViewController`, the plugin silently doesn't register and `setSnapshot()` becomes a no-op.

## Payload versioning

The payload uses v2 format with a `series` array (array of daily entries for the sparkline). `LiddWidgetShared.supportedVersion` in the Swift shared code must match `WIDGET_SNAPSHOT_VERSION` in the TS code. A version mismatch causes the extension to show a "Please open Lidd" placeholder.

`LiddWidgetShared.swift` is compiled into **both** the App target and the LiddWidget target (via target membership). It's the shared contract between web-layer output and extension input.

## Typography

Lexend is included as **3 static instances** (400/500/600) generated via fontTools instancer from the variable font. WidgetKit doesn't support variable fonts. The instances are registered through `UIAppFonts` in the extension's Info.plist.

## Timeline entries

WidgetKit calls the provider's `timeline(in:completion:)` to get entries. The provider puts an entry at each **wording-change moment** — e.g. when "2 hours ago" should become "3 hours ago", or when an ongoing attack's elapsed time text changes.

**Views must never read the clock.** Use `entryDate` for all time-relative text. Reading `Date()` in a widget view produces stale values (WidgetKit caches views and replays them).

## Content layout rules

- Content **top-left anchored**, mark (the Lidd logo/icon) **bottom-right** in every widget family/state.
- `prominent` text style only for a **lone figure** (e.g. "3 days" on a no-attack widget). An ongoing attack never qualifies — it has too many elements.
- No monthly figures on the widget (§9.2 of the research dossier).
- Palette is mirrored by hand from the web layer's CSS tokens — there's no shared source. Change a token → change the Swift `Color.liddSeverity` / `Color.liddAccent` etc.

## "No change" button — built and removed

A "No change" button was built into the widget (tapping it would log a `notification_no_change` snapshot). It was removed because:
1. WidgetKit button actions are unreliable on older iOS versions.
2. The notification-based "No change" flow is more discoverable and handles the reminder rescheduling.
3. A widget button that writes data needs the app to be running (or to wake it via deep link), adding latency.

The notification flow handles this better — the user taps "No change" on the notification itself.

## Deep links

Deep links from the widget are **not built**. The widget is display-only. If ever added, they'd use Capacitor's custom URL scheme handler.

## Build and run

- `App.xcscheme` is checked in under `xcshareddata/xcschemes`. Always run the **App** scheme, never `LiddWidget` — the widget scheme builds only the extension, which can't launch standalone.
- Free provisioning works for the widget + App Group (verified August 2026).
- To preview a specific widget state during development, write to the App Group container plist (not `defaults write`, which targets the wrong domain).

## Publish on hidden

`useWidgetSnapshot` publishes the payload on the `visibilitychange` → `hidden` event. This is **load-bearing**: iOS fires `hidden` when the user switches away from the app, ensuring the widget has fresh data for when the home screen is visible. Without this, the widget could show stale data for hours.
