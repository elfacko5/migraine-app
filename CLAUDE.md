# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file holds the **rules** — what a change has to respect. The **reasoning** behind them lives in `docs/`, so it can be read when it's relevant instead of on every task:

| File | Read it before |
|------|----------------|
| [`docs/decisions.md`](docs/decisions.md) | undoing anything here that looks redundant or over-careful |
| [`docs/voice-parsing.md`](docs/voice-parsing.md) | changing any rule in `src/utils/voiceParse.ts` |
| [`docs/viewport-architecture.md`](docs/viewport-architecture.md) | touching the app shell's height, offset, or overlay positioning |
| [`docs/notifications.md`](docs/notifications.md) | changing how a reminder is scheduled, sounded, or answered |
| [`docs/today-cards.md`](docs/today-cards.md) | restyling `HomeCard` or swapping its artwork |

Nearly every rule in both places was paid for with a round of device testing. A rule with no visible justification has one — it's in `docs/`.

## Commands

`npm` is not on the default PATH — source nvm first:

```bash
source ~/.nvm/nvm.sh && npm run dev      # start dev server (localhost:5173)
source ~/.nvm/nvm.sh && npm run build    # TypeScript compile + Vite production build
source ~/.nvm/nvm.sh && npm run lint     # ESLint (typescript-eslint rules)
source ~/.nvm/nvm.sh && npm run preview  # serve the dist/ build locally
```

There are no tests. Type-checking is part of `build` (Vite runs `tsc --noEmit` via tsconfig project references).

`npm run lint` currently reports ~6 pre-existing errors (`setState` called synchronously in an effect, `Date.now()` during render). They're the established pattern in this codebase for sync-on-mount and period filtering — don't treat a non-zero lint count as a regression you caused; compare against `git stash`ed output first.

To test on a phone on the same Wi-Fi, expose the dev server on the LAN with `npm run dev -- --host`, then open `http://<mac-hostname>.local:5173` (the `.claude/launch.json` preview config already passes `--host`) — use the Mac's mDNS hostname (`scutil --get LocalHostName`, e.g. `Sunnys-MacBook-Neo.local`), not its LAN IP, since DHCP can reassign the IP at any time and a phone PWA added to the home screen at an IP silently breaks the next time that happens (Vite's `server.allowedHosts` in `vite.config.ts` explicitly allows `.local` for this reason — a `Blocked request` error means a fresh clone or a reset config lost that setting). HMR doesn't reliably push over Wi-Fi — reload the phone manually after changes. Each device has its own `localStorage`; data only matches across desktop/phone if both are signed in to the same account via Supabase sync (see below) — otherwise they're independent.

If working on sync, copy `.env.local.example` to `.env.local` and fill in a Supabase project's URL/anon key (Project Settings → API). `.env.local` is gitignored. Without it, `src/lib/supabase.ts` exports `null` and the app runs local-only — this is the default for a fresh clone.

## Stack

Vite 8 + React 19 + TypeScript (strict) + Tailwind CSS v4 + Recharts + `@supabase/supabase-js`. `localStorage` is the source of truth for all reads; Supabase provides optional, opt-in cross-device sync (see below) — there's no backend requirement to use the app. PWA via `public/manifest.json` + `public/sw.js`.

**Two shipping targets, one codebase.** The same build runs as a browser/installed PWA *and*, since the Capacitor wrap, as a native iOS app (see "Native iOS shell" below). Nothing is forked per platform: where behaviour has to differ it branches at runtime on `Capacitor.isNativePlatform()`. Keep it that way — the web build is still how the app is developed and how the browser preview tooling exercises it.

**Tailwind v4 note:** configured through the `@tailwindcss/vite` plugin — there is no `tailwind.config.js`. Custom theme tokens go in `src/index.css` under `@theme {}`.

## Native iOS shell (Capacitor)

`ios/` is a real Xcode project that loads the Vite build in a `WKWebView`. No application code is platform-specific: `dist/` is copied into the bundle at build time, so every hook, component and utility runs unchanged.

It exists for two things a PWA structurally cannot do, both now in place: **reminders that survive the app being force-quit** (the OS owns the timer — see the notification section) and **real Siri App Intents** rather than a hand-built Shortcut (see voice logging).

```bash
source ~/.nvm/nvm.sh && nvm use 22            # the Capacitor CLI needs Node >= 22; the repo default is 20
npx cap copy ios                              # rebuild dist/ first, then copy web assets into the bundle
npx cap sync ios                              # copy + install native deps (run after adding a plugin)
```

- **`npm run build` before any `cap copy`/`cap sync`** — Capacitor copies `dist/`, it does not build it. A web change that "didn't take effect" in the app is almost always a skipped build.
- **`pod install` needs a UTF-8 locale.** Without `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` it dies in Ruby's Unicode normalisation. `cap sync` runs pod install, so it inherits this.
- **`appId` in `capacitor.config.ts` must match `PRODUCT_BUNDLE_IDENTIFIER`** in the Xcode project (currently `com.sunny.migrainetracker2`). iOS takes its identity from the Xcode project, so a mismatch fails silently until a plugin resolves the appId from Capacitor's config and gets an id that doesn't exist on the device.
- **Deployment target is 15.0**, which `@capacitor/ios` 8's podspec requires. The generated project defaults to 14.0 and `pod install` refuses.

### Running on a physical device

Free provisioning works and covers everything worth testing on device — local notifications need no entitlement (only *remote* push does). Builds expire after 7 days; re-run to renew.

If Xcode's UI fails to register the bundle identifier, build once from the CLI with `-allowProvisioningUpdates` — it registers the App ID and issues the profile where the UI wouldn't:

```bash
xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -destination 'platform=iOS,id=<device-udid>' -allowProvisioningUpdates -configuration Debug build
xcrun devicectl device install app --device <device-udid> <path-to-App.app>
```

First launch on a device is refused until the certificate is trusted under **Settings → General → VPN & Device Management** — that's expected, not a signing fault. Signing will also raise a macOS keychain prompt asking for the **login (Mac account) password**, not the Apple ID password.

**Simulator caveat:** trackpad scrolling doesn't scroll the app. The document never scrolls (see the viewport section) — only nested containers do — and the Simulator delivers trackpad input to the WebView's own scroll view, which has nothing to scroll. Touch drags work, and a real device only ever produces touch, so this is a Simulator artefact and not worth "fixing".

## Dark-first design, photophobia-aware

The app is always dark. `color-scheme: dark` is set globally. Never use `dark:` prefixes — dark styles are just the base styles.

The palette follows a photophobia spec (2026-08-18): wavelength matters, not just brightness, so **saturated blue is avoided everywhere** and the accent is a low-saturation sage. The old palette was blue-leaning slate through every surface; it is now warm charcoal. **Neither end of the contrast range is pure** — no `#fff`, no `#000`, no max-contrast pairing — contrast lands at WCAG AA with both ends pulled inward on purpose.

- **Tokens live in `src/index.css` under `@theme`.** `--color-bg-base` `#1b1a18` · `--color-text-primary` `#e4dfd6` · `--color-accent` `#7fa187` · severity low/mid/high `#7fa187` / `#b07a3c` (muted amber) / `#a65a52` (desaturated terracotta).
- **Also still true** (`cf621be`): no purple or blue, no drop shadows.
- **SVG and Recharts mirror the tokens by hand** (`headDiagram.ts`, `SeverityChart.tsx`, `HeadHeatmap.tsx`, `StatsView.tsx`, `medDisplay.ts`, `AreaSeverityPicker.tsx`) — a presentation attribute can't read `var()`. Change a token and these need changing with it. The fixed zone colours are now `#a39d92` (disabled) and `#7fa187` (selected).
- **Type**: `Atkinson Hyperlegible Next`, self-hosted from `src/assets/fonts/` (SIL Open Font License, latin subset, one 34KB **variable** file, 400–700) — a CDN is ruled out by the offline bundle and the CSP. **Variable specifically so 500 is a real weight**: this shipped first as static 400 + 700, and CSS weight matching sent every `font-semibold` (600) up to 700, which made every button label in the app read as slabbed. Emphasis is `font-medium` (500) throughout; `font-bold` is reserved for headline numbers. **No light or thin weight anywhere** — thin strokes shimmer for light-sensitive eyes.
- **Type scale floors**: body never below 16px, captions never below 14px — so `text-xs` is `0.875rem` and `text-sm` is `1rem`, both with a **1.5 line-height** that every step preserves.
- **Text scale runs 87.5%–150%** (`[data-scale]` on `<html>`: 14 / 15 / 16 / 22 / 24px). It briefly went to 200% for WCAG 1.4.4, and 200% made the app four words to a line — a worse accessibility outcome than a lower ceiling, on an app whose whole job is to be usable mid-attack. **`BottomNav` and `AttackModePill` still cap their own font and icon sizes** (`min(0.875rem, 16px)` and friends); that was found at 200%, where the unclamped nav pushed Insights into a clip and Profile off screen entirely — a whole tab unreachable — and it costs nothing at 150%. Anything added to the persistent chrome needs the same treatment.

### Attack mode

A third theme, not a filter: `data-theme="attack"` on `<html>` (`useSettings`, persisted to `hd_attack_mode`). Reachable in one tap from **`AttackModePill`**, the floating pill on every screen, and from Profile → Accessibility.

- Darker, warmer, lower-contrast tokens (`--color-bg-base` `#14140f`, text `#c9c4b8`).
- **Body text floor of 20px** — `[data-theme="attack"][data-scale="xs"|"sm"|"md"]` — but never drags a larger choice back down.
- **All animation is cut** (and `prefers-reduced-motion` is honoured for everyone, attack mode or not — movement is itself a trigger).
- **A dim floor of 0.35 applied at render**, in `BrightnessOverlay`, *not* written back to `hd_brightness`: turning attack mode off has to restore exactly the brightness the user chose. The scrim is warm (`rgba(20,20,15,…)`) rather than neutral black, which would pull the UI back toward blue.
- **The pill's icon is a half-filled circle, not a crescent moon** — the moon already means "woke up with this migraine" on the attack header, and it's drawn as a stroke SVG in `currentColor` so the control isn't the brightest thing on a screen designed to be easy on the eyes. Its bottom offset is `calc(4.5rem + 1rem + env(safe-area-inset-bottom))`: measured off the nav's real height and growing with the inset, because a flat offset sat directly on top of the nav on device.
- **The pill sits at `z-45`, above the dim scrim at `z-35`.** It is the control that turns attack mode *off*, so it is the one thing the scrim must not dim. The brightness pill hides while attack mode is on — same screen position, and the dim isn't the user's setting in that state.
- **Not done: "fewer elements per screen."** The spec asks for a reduced UI in attack mode; that means redesigning each screen's content, not restyling it, and nothing here attempts it.

## The snapshot data model

This is the core concept. A migraine `Attack` is not a single record — it is an ordered array of `Snapshot`s, each representing the full state at a point in time:

```ts
// src/types/index.ts
interface Snapshot {
  time: string;                              // ISO timestamp
  areas: Record<string, number>;            // { 'Right temple': 7, 'Left eye': 4 }
  symptoms: string[];
  reliefs: string[];
  medication: { name: string; dose: string } | null;
  note: string | null;
  source: 'manual' | 'notification_yes' | 'notification_no_change';
}

interface Attack {
  id: number;           // Date.now() — used as the notification timer key
  snapshots: Snapshot[];
  end: string | null;   // null means ongoing
  triggers: string[];
  notificationConfig: NotificationConfig;
  updatedAt?: string;   // ISO timestamp — last-write-wins conflict key for sync (see below)
}
```

`notification_no_change` is a first-class source value, not just a label. The stats utilities in `src/utils/stats.ts` use it specifically for plateau analytics (e.g. `longestPlateauMinutes` tracks consecutive `no_change` runs; `hasMedicationNonResponse` looks for 2+ consecutive `no_change` snapshots after a medication event). When adding new analytics, treat `no_change` as "severity held" — each snapshot represents state held until the *next* snapshot's timestamp.

## localStorage keys

| Key | Type | Description |
|-----|------|-------------|
| `hd_attacks` | `Attack[]` | All attack records |
| `hd_triggers` | `string[]` | User's trigger list (seeded from `DEFAULT_TRIGGERS`) |
| `hd_symptoms` | `string[]` | User's symptom list (seeded from `DEFAULT_SYMPTOMS`) |
| `hd_reliefs` | `string[]` | User's relief-method list (seeded from `DEFAULT_RELIEFS`) |
| `hd_medications` | `{ items: Medication[]; updatedAt: string }` | The user's medication library (acute + preventive) |
| `hd_notification_default` | `NotificationConfig` | Saved notification preference |
| `hd_text_scale` | `TextScale` | UI text-size setting (87.5%–150%) |
| `hd_attack_mode` | `boolean` | Attack-mode theme on/off |
| `hd_brightness` | `number` | Brightness-overlay setting |

All reads/writes go through the hooks (`useAttacks`, `useUserPrefs`, `useMedications`, `useSettings`) — no direct `localStorage` calls elsewhere except `src/utils/backup.ts`.

The trigger/symptom/relief lists are **add-only** (no removal UI). `loadList` in `useUserPrefs` merges any newly-added built-in defaults into a user's stored list, so new built-ins (e.g. adding to `DEFAULT_RELIEFS`) propagate to existing users.

**Export / import:** `src/utils/backup.ts` serialises every `hd_` key to a JSON file (Profile → Data → **Export backup**) and restores it (**Import backup** → confirm → reload). This predates Supabase sync and still works standalone (no sign-in needed) — it's the only cross-device path for a user who doesn't want to create an account.

## Cross-device sync (Supabase, optional)

Sync is opt-in and additive: `localStorage` stays authoritative for all reads (instant, works offline), and when signed in, every local write is *also* best-effort pushed to Supabase. A push failure is `console.error`'d and never blocks or rolls back the local write — but it also surfaces to the user (see the sync indicator below), so a failure like the missing-table incident in the gotchas doesn't go unnoticed again.

- **`src/lib/supabase.ts`** — creates the client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; exports `null` if either is unset, which is the single flag every sync-aware hook checks to no-op.
- **`src/hooks/useAuth.ts`** — session state via `supabase.auth`. Email-only, no passwords: `signInWithEmail` sends a magic link (`signInWithOtp`); `verifyEmailCode` completes sign-in from a typed 6-digit code instead. The code path exists specifically because iOS Safari always opens Mail links in Safari itself, never in a standalone home-screen PWA — there's no way to make the magic link land back in the installed app, so the OTP code (same email, `{{ .Token }}`) is the only way to sign in from inside the PWA.
- **`src/lib/sync.ts`** — `pullAttacks`/`pushAttacks`/`deleteAttackRemote` and `pullUserPrefs`/`pushUserPrefs`; maps between the local `Attack`/`Snapshot` shape and the `attacks`/`user_prefs` table rows (snake_case columns, e.g. `end_time`, `notification_config`).
- **`src/hooks/useAttacks.ts`** and **`useUserPrefs.ts`** each take `userId: string | null` and run their own `sync()`, merge, and re-push on mount/sign-in **and again on every `visibilitychange`/`focus` event** — not just once — because iOS keeps a backgrounded PWA's page alive in memory rather than reloading it, so a mount-only sync would go stale indefinitely once the app is reopened from the background. Each hook also exposes `syncStatus: 'idle' | 'syncing' | 'synced' | 'error'` and `lastSyncedAt`, set both by the periodic `sync()` and by every individual fire-and-forget push (via a shared `trackPush` wrapper in each hook).
- **Merge strategy differs by data shape:** attacks merge per-id by comparing `updatedAt` (last-write-wins — true concurrent edits to the *same* attack from two devices at once aren't handled specially). Trigger/symptom/relief lists merge as a plain union (`useUserPrefs.ts`'s `union()`), since those lists are add-only everywhere already — there's no real conflict to resolve.
- **`supabase/schema.sql`** — run once in the Supabase SQL editor to create `attacks` + `user_prefs`, both with RLS policies scoped to `auth.uid() = user_id`. Snapshots stay a `jsonb` array column rather than their own table, since they're always read/written whole with their parent attack. **Adding a new `Attack`/`Snapshot` field that gets pushed to Supabase (e.g. `wokeWithMigraine` → `woke_with_migraine`) requires an `alter table ... add column` on any already-created table** — `create table if not exists` in schema.sql only helps fresh installs; an existing table silently rejects every push with an unknown-column error until migrated (schema.sql has the exact statement commented above the `attacks` table).
- Profile → **Account & sync** (`ProfileView.tsx`) renders only when `supabase` is non-null, with the magic-link form and the OTP code-entry fallback. When signed in, `App.tsx` combines the three hooks' `syncStatus`/`lastSyncedAt` (error takes priority over syncing, which takes priority over the most recent successful sync) into one `SyncIndicator` line — a colored dot + "Synced 3m ago" / "Syncing…" / "Sync failed — will retry automatically" / "Waiting to sync…" — so a silent push failure is visible instead of only reaching the console.
- No realtime subscription — sync is pull-on-foreground, not push-based, so a change on device A won't reach device B until B is foregrounded or reloaded. Acceptable for personal use; worth knowing if debugging "why hasn't this shown up yet."

**Supabase project gotchas** (email deliverability, redirect URLs, RLS) live in the Supabase dashboard, not in code — see Authentication → Email Templates (the magic-link template must include `{{ .Token }}` for the OTP fallback to work) and Authentication → URL Configuration (both a `/**` wildcard *and* the exact bare-origin URL need to be in the Redirect URLs allowlist; the Site URL field is a separate fallback Supabase silently uses if nothing in Redirect URLs matches).

## Notification architecture

Two backends, chosen at runtime in `src/utils/notifications.ts` by `Capacitor.isNativePlatform()`. `scheduleNotification` / `cancelNotification` keep one signature across both, so `useAttacks` never branches on platform.

- **Native (iOS)** — `@capacitor/local-notifications`. The OS owns the timer, so a reminder still fires after the app is force-quit. This is the reason the native shell exists.
- **Web (browser + installed PWA)** — the original service worker (`public/sw.js`), which keeps a `Map<attackId, timerId>` of pending `setTimeout` calls. Survives tab navigation but **not** a browser restart.

Flow: `startAttack` / `addSnapshot` → `scheduleNotification()` → (native) `LocalNotifications.schedule` / (web) `SCHEDULE_NOTIFICATION` to the SW → reminder fires → user taps an action → **"Something changed" opens the update sheet; "No change" and "Snooze" are resolved without opening the app** (see below).

Things that will bite when touching this:

- **`onNotificationAction` carries no data and nothing may depend on it firing.** Its callback takes no arguments and means only *"an answer is waiting — drain the queue"*. Every answer travels through the pending queue instead (see below). Don't route an action's payload back through this listener; that is precisely what failed on device, twice.
- **Notification ids are folded.** Attack ids are `Date.now()`, which overflows the 32-bit int the plugin wants, so `notifId()` maps them into a safe range. It's deterministic, so `cancel` derives the same id `schedule` used and re-scheduling replaces rather than stacks. The native handler re-uses the *delivered* request's identifier for the same reason.
- **Action buttons must be registered before the first schedule** (`registerNotificationActions()`, called from `useNotifications` on mount) or iOS renders the notification with no buttons.
- **`sound` must name a real bundled file or the reminder is delivered silently** — and silent on iOS means no tone, *no vibration, and no tap on a paired Apple Watch*. The plugin takes a filename only and cannot express `UNNotificationSound.default`; **its documented fallback is wrong** (an unresolvable name is silent, not default). The app bundles `ios/App/App/reminder.wav`, which must sit at the **bundle root** — `UNNotificationSound(named:)` does not search subfolders. Re-schedules inherit it by copying the delivered content; don't substitute `.default`. **If reminders ever go quiet, check this first.**
- **Only "Something changed" sets `foreground: true`**, because it opens the wizard. The other two are `false` and handled in Swift — as JavaScript inside the WebView they did nothing at all once the app had been evicted from memory, which is exactly when a reminder is most likely to be answered.
- **The body text is frozen at schedule time but read at fire time**, so nothing relative belongs in it. `formatElapsed` produced "Started just now" on a reminder that arrived 30 minutes after the attack began; it uses `formatTime` (an absolute clock time) instead, which stays true however long the notification sits unread. It's also why both re-scheduling paths can safely re-use the delivered notification's own content.
- **Tapping the notification body** reports `actionId: 'tap'` on iOS; that maps to `update`, matching the SW's default click.
- `useNotifications` requests permission through the plugin on native and `Notification.requestPermission()` on web, normalising both onto `'default' | 'granted' | 'denied'`.

Adaptive schedule: +1h after first snapshot, +2h after any subsequent snapshot. Notifications are not scheduled if `attack.end` is already set (retrospective logs).

### Answering a reminder

`ios/App/App/NotificationActionHandler.swift` receives every reminder response in Swift. iOS launches the app in the *background* to deliver a non-foreground action, so this runs whether or not a WebView exists.

**Every answer is written to a queue in Swift and applied later by the web layer — including "Something changed",** which foregrounds the app and could in principle be delivered live. It was, through Capacitor's `localNotificationActionPerformed` listener, and it silently failed on device twice. **Don't reintroduce a live-event dependency for any action.**

The break is past the point that can be measured without a device (our delegate *is* installed at launch, `willPresent` *is* dispatched to it, and the router is non-nil by `applicationDidBecomeActive` — all confirmed with `NSLog` probes). That is the reason for not depending on it at all rather than fixing it.

- **It owns the `UNUserNotificationCenter` delegate, and has to.** Apple requires the delegate be set before launch finishes; Capacitor installs its router later, from `CAPBridgeViewController.loadView()`. So `ios.handleApplicationNotifications: false` keeps Capacitor off it, `AppDelegate` installs the handler during launch, and the handler forwards `willPresent` and every response back to Capacitor's router by hand. **Removing that config flag silently disables all of this** — and so does a stale bundle, since `ios/App/App/capacitor.config.json` is gitignored and a fresh clone needs a `cap copy` first.
- **A response that arrives before the bridge exists is held and flushed** from `applicationDidBecomeActive`. A cold launch straight from a reminder can land ahead of the WebView.
- **Native code can't write the reading.** Attacks live in `localStorage` inside the WebView. So the answer is *queued* — `CapacitorStorage.pendingNotificationActions` in `UserDefaults`, the same `@capacitor/preferences` handoff the Siri intent uses — and `consumePendingActions()` (`src/utils/pendingActions.ts`) drains it on mount and on every foreground. **The key is duplicated in Swift and TS.** Entries are `no_change` (append a reading) or `update` (open the wizard).
- **The queued entry carries the tap time**, and the drain uses it rather than "now". The app may not be opened for hours; a reading stamped when it was finally read would be a lie about when severity held.
- **The native handler schedules the follow-up reminder itself**, or the chain stalls until the app is next opened. It can't compute the interval (that needs `notificationConfig` and the snapshot count), so `scheduleNotification` puts `followUpMs` in the notification's `extra` — the delay that will apply once the no-change reading lands, i.e. one more snapshot than the attack has now. The entry records `rescheduled: true` so the drain doesn't schedule a *second*, later one; web entries record `false` and are scheduled normally.
- **The web build queues through the same key** rather than acting on the action directly, so `App.tsx` has one code path. `@capacitor/preferences` is what makes that work: `UserDefaults` on iOS, `localStorage` with the same `CapacitorStorage.` prefix on web. (A service worker can't reach `localStorage`, so on web the *page* queues on receiving the SW message — which means a web answer given with no tab open is still lost, as it was before.)
- **The drain applies readings before opening the wizard**, so "Something changed" opens onto an attack that already includes any no-change readings queued ahead of it.
- **`useAttacks.addSnapshots` exists for the drain**, because the queue can hold several answers. Calling `addSnapshot` in a loop drops all but the last: each call maps over the `attacks` captured in the current render.
- **The drain skips answers for an attack that has ended or been deleted**, and cancels its reminder. `cancelNotification` only drops *pending* reminders — one already sitting in Notification Center keeps working buttons.

**Permission is requested before anything is scheduled** (`handleLogSave` awaits it). iOS accepts a request made while permission is undecided but never delivers it if the user then declines, which would leave an attack looking like it had a reminder queued when it had none. The request is wrapped so a failure can't cost the user the log entry.

**Verified in the simulator:** a notification scheduled through the plugin is delivered by the OS and appears in Notification Center with the right title/body/icon; permission is prompted before `hd_attacks` is written, and denying still stores the attack. **Not verified:** the action buttons round-tripping back into `addSnapshot` — synthetic taps on Simulator notifications don't activate them, so that needs a real device.

## Voice logging

Two entry points, both landing in the same handler in `App.tsx`, which parses the transcript and opens the matching sheet prefilled — `LogForm` for a new attack, `QuickUpdateForm` when one is ongoing (the same routing the FAB uses). Nothing auto-submits; the wizard still walks every step.

- **Siri App Intent** (native) — `ios/App/App/LogMigraineIntent.swift`. "Hey Siri, log a migraine", no user setup.
- **Siri Shortcut deep link** (`?voice=<transcript>`) — the original path, still the only option on the PWA, since Siri App Intents are native-only and iOS Safari doesn't implement the Web Speech API (an in-app mic button would silently do nothing there).

**The intent cannot write an attack itself.** Attacks live in `localStorage` inside the WebView, which native code can't reach — so it captures what was said and hands it over, exactly as the Shortcut did.

The handoff deliberately avoids a custom native bridge: `@capacitor/preferences` on iOS stores to `UserDefaults.standard` with keys prefixed `CapacitorStorage.`, so the intent writes `CapacitorStorage.pendingVoiceEntry` directly and `consumePendingVoiceEntry()` (`src/utils/pendingVoice.ts`) reads it with a plain `Preferences.get`. **The key name is duplicated in Swift and TS — change one, change the other.** It's read on mount *and* on every foreground, because the intent may have written it before the web layer started or while the app was backgrounded, and it's cleared on read so it fires once.

- **Siri asks four short questions, not one open one** — where/how bad, when it started, anything else, and *anything more*. Each fits inside the dictation window Siri allows, where a single open-ended question produced a long answer that got cut off part-way (and severity, coming last, was what got lost). **All four parameters are required**, because optional ones are never prompted for at all; "nothing"/"no"/"skip"/"that's everything" is how a question gets declined out loud, and `perform()` maps those to an empty answer.
- **The fourth question is the third one asked twice, and it is asked unconditionally.** Medication is the longest thing anyone says ("two tablets of X last night at ten and then one this morning at seven") and Siri kept ending dictation mid-sentence on it even as its own separate question, so the answer gets a second window. `perform()` joins `extras` and `extrasMore` with ". " before handing over, so a sentence finished in the second half parses as the single sentence it was meant to be. Asking only when the third question got an answer would be better, and is what a `requestValue` inside `perform()` is for — but that silently fails to prompt once `openAppWhenRun` is set (it's how this intent once ran with no text at all), and a required parameter is the only prompt that reliably happens. One extra one-word answer is the accepted cost.
- **The web layer waits for the handoff rather than reading once** (`awaitPendingVoiceEntry`). The intent writes from its own process and then asks iOS to open the app, and the app's first read can happen before that write is visible to it — with the app already foregrounded, no `visibilitychange` follows to retry on. The symptom was the app opening on the Today tab as if nothing had been said, with the draft appearing only after a manual close and reopen. `synchronize()` on the writing side is not enough.
- **The three answers are handed over as JSON and stay separate.** "An hour ago" contains a number, and running it through the pain parser would record a severity of one — so `started` is parsed only by `parseStartOffset`, while `note` and `extras` are concatenated for everything else. `parsePendingVoiceEntry` falls back to treating a non-JSON value as a plain transcript, which is what the Shortcut deep link still sends.
- **App Intents need iOS 16**; the deployment target is 15, so the intent is availability-gated. On iOS 15 there's simply no Siri support.
- **The app's two names must agree.** `CFBundleDisplayName` and `CFBundleName` are both set to `Lidd` in `Info.plist`; the latter defaulted to `$(PRODUCT_NAME)`, which is the Xcode *target* name — `App`. Phrases interpolate `${applicationName}`, so a disagreement means the phrase Siri expects may not be the name on the home screen.
- **`INAlternativeAppNames` accepts at most three.** "Lidd" is an invented one-syllable word and dictation renders it as "lid" or "lead", so the plist lists alternatives (with a pronunciation hint) — but a fourth entry doesn't warn, it makes the app **refuse to install**, with the count in the installd error. The old name is deliberately one of the three: it's what muscle memory reaches for, and it doubles as a diagnostic (if the old name works and the new one doesn't, phrase registration is healthy and the problem is recognition).
- **`voiceHandledRef` releases when the sheet closes.** It guards against double-firing within one delivery, but the intent (unlike a URL param consumed once per load) can run again at any time — latching it for the page's lifetime made Siri work exactly once per app session.
- Adding a Swift file to the target should be scripted with the `xcodeproj` gem (ships with CocoaPods) rather than hand-editing `project.pbxproj`.

`src/utils/voiceParse.ts` is deliberately low-precision — substring/prefix matching against the user's own chip lists, not NLP. The raw transcript is always kept verbatim as the note, and the prefill banner lists exactly what was recognised, so a wrong guess is visible rather than silently saved.

Every rule below exists because a real transcript broke without it. The worked examples are in [`docs/voice-parsing.md`](docs/voice-parsing.md) — **read it before changing any of these**; each looks arbitrary until you see the sentence that caused it.

*Matching*

- Needle words under 4 characters need an exact word match; longer ones need a 4-character shared prefix.
- Mis-transcribed area names are matched by `soundex`, guarded twice: a whole word of 3+ characters, **and** a number within 15 characters.
- A word another area already claimed literally is never sound-matched (`neck`/`nose` share code N200).
- `AREA_SYNONYMS` maps everyday phrasings to the anatomical zone names, and is matched *before* the anatomical terms so a phrase is claimed whole.
- "top of my ___" takes whatever word follows; "back of my ___" excludes only a literal "neck". The exclusion is a plain string check (not a regex lookahead, which backtracks past "my") and strips trailing punctuation.
- "write" and "rite" count as "right".

*Severity*

- Severity is per area: each mention takes the first number after it and before the next mention. Digits and spelled-out words both count.
- A number said before any area, or a single trailing one, is shared across every mention that has none of its own.
- If any mention carries its own number, the sentence-wide fallback switches off — one area's number is never borrowed by another.
- A severity window stops where the medication clause starts; numbers after "took"/"had" are quantities.
- `DEFAULT_SEVERITY` (5) fills a gap, but `severityHeard` records that it was invented and the banner says so. **`severityHeard` is all-areas, `severityHeardFor` is per-area — the review screen must use the second**, or one unrated area labels every row "no severity heard". Only the one-tap save gates on the all-areas flag.

*Sides*

- Every occurrence of an area term is its own reading, and each "left"/"right" belongs to the mention it is nearest.
- "Nearest" is biased forward, because English puts the side word first (`BACKWARD_PENALTY` ≥ `SIDE_RANGE`, so any in-range forward candidate wins).
- A side-less mention selects **both** sides rather than guessing.

*Times and doses*

- Start times accept relative and clock forms, checked *after* the relative phrases so they can't steal the number out of "two hours ago". A spoken hour requires a part of day; a bare hour is refused, never guessed, and shown verbatim with a note.
- The day and the half of the day are read once, for every clock branch — an explicit `am`/`pm` still wins over an inferred one.
- Every dose is its own reading, in spoken order; `LogForm` turns each *timed* dose into its own snapshot. An untimed dose stays on the initial reading, and one earlier than the stated start is clamped to it — the first dose must never appear in both places.
- A dose's bare hour is disambiguated against the attack window, and left blank if that doesn't leave exactly one candidate. This is why `startMinutesAgo` is parsed before the doses.
- Quantity + form make a dose; the name is optional and shows as *Unnamed*. `at` joins a form to a name as often as `of` does.
- A rejected name must not swallow the time after it — `DOSE_PATTERN` carries the `d` flag so the time window restarts at the end of the form group.
- A dose whose name dictation dropped doesn't outrank one that kept it: take the first *named* dose.
- A number word between the form and the drug name is skipped.
- Medications match `recentMeds` first (which brings the usual dose), then phrasing; a dose said out loud beats the remembered one. `NOT_A_MED` holds number and time words. Names are only ever corrected against the user's own history.

## Profile tab

Four rows, each opening a full-screen sub-page: **My medications** · **Accessibility** (text size + brightness) · **Account & sync** (hidden unless `supabase` is non-null) · **Data** (export/import). `ProfileView.tsx` holds the menu and exports `AccessibilityPanel` / `AccountPanel` / `DataPanel`; `MedicationsView.tsx` is the fourth. Every panel wraps itself in **`ProfileSubPage`**, which owns the top bar and the scroll region — so a new sub-page never re-derives the safe-area padding or the close button.

**The Sheets live in `App.tsx`, not inside `ProfileView`.** `Sheet` is `absolute inset-0` against the app root; rendered from inside the tab's scroll container it would anchor to the wrong ancestor and reintroduce exactly the clipping the viewport architecture exists to avoid. One `Sheet` switches its contents on `profileSheet: ProfileSection | null`.

**It's a menu or it isn't.** A first version kept these flat and gave only medications a row, which left one row sitting above three loose sections — it read as an accident rather than a choice. If a fifth group is added, it gets a row too.

## Medications (Profile → My medications)

The user's own medication library, in two kinds. `Medication` (`src/types/index.ts`) is `{ id, name, dose, kind: 'acute' | 'preventive', createdAt }`, stored under `hd_medications` and owned by `src/hooks/useMedications.ts`.

- **Acute** — taken to treat an attack. These feed the logging wizard.
- **Preventive** — taken daily, *including on attack days*. Deliberately **never offered in the wizard**: the Medication step records what was taken *for this attack*, and a dose taken daily regardless is not that. It would also inflate any future medication-overuse figure, which applies to acute treatment only.

**`recentMeds` (`App.tsx`) is library-acute-first, then history.** It scans the library for `kind === 'acute'` in the user's own order, then appends any medication name found in attack history that isn't already there, deduped by name. Both halves are load-bearing: the history scan is why someone who never opens this page still gets chips with no setup, and the library half is why a newly-added medication appears *before it has ever been logged*. The same list is passed to `parseVoiceEntry`, so a library entry also corrects that drug's name in a Siri transcript from first use.

**The merge strategy is not the one the other lists use.** Triggers/symptoms/reliefs are add-only and merge by `union()`. Medications are editable and deletable, so a union would resurrect every removed row on the next sync — the list is **whole-list last-write-wins** on its own `updatedAt`, the rule `Attack` already uses, applied to the list rather than per item.

`pushMedications` in `src/lib/sync.ts` writes `medications` + `medications_updated_at` on `user_prefs` as its own upsert, separate from `pushUserPrefs`, so neither hook clobbers columns it doesn't own. **An already-created `user_prefs` table needs the `alter table` statements** in `supabase/schema.sql` before any push succeeds — the documented unknown-column failure.

`medIcon`/`medColor` live in `src/utils/medDisplay.ts`, shared with `SnapshotRow` so a drug can't render as 🫧 on the timeline and 💊 in the library.

**Parked, by decision:** adherence (recording that a preventive dose was actually taken) and daily preventive reminders. `kind` ships now so both bolt on without a migration. Reminders are the harder half: `notifId()` folds attack ids into the plugin's 32-bit range and a repeating reminder needs a provably non-colliding id space, and `NotificationActionHandler.swift` plus the `pendingNotificationActions` queue are typed entirely around attack answers (`no_change` / `update` + attack id), so a "Taken" response needs a discriminator threaded through both.

## App shell

`App.tsx` owns all sheet/modal open state and routes notification actions. Four tabs — Today (`log`), Logs (`history`), Insights (`stats`), Profile (`profile`) — rendered conditionally in one `div`, no router. **The nav is at capacity**: four tabs plus the FAB is the ceiling for thumb reach, so a new destination goes *inside* a tab (as My medications did), never beside them. The Today tab's `TopBar` title is **"Hello"**, a greeting rather than the app's name: the user knows which app they opened, and it's the one tab that isn't a list of something to name itself after. `TopBar` has **no bottom border** — the content below is the same base colour, and a divider under the greeting made the bar read as a strip of chrome instead of the top of the page (it keeps its `backdrop-blur`, so content scrolling under it still separates). All four tab titles render at **34px — written `text-[2.125rem]`, not `text-[34px]`**, so the app's own text-size control still scales them (46.75px at `xl`); the row is `min-h-14` rather than a fixed `h-14` so it grows instead of clipping at the larger scales. The header's `padding-top` is `calc(2rem + env(safe-area-inset-top))` — the 32px is added *on top of* the inset, never instead of it, since the inset reads as 0 in the browser preview and a flat value tuned there would collide with the status bar on device. The wizard's own step headings (`LogForm`/`QuickUpdateForm`, including the voice review screen) were deliberately left at their existing size. `TopBar` and the tab content live inside a nested `overflow-y-auto` scroll div; `BottomNav` and the floating pills are positioned outside it (see below). All of them pad for the iOS safe-area insets (`env(safe-area-inset-*)`), needed because the app uses `viewport-fit=cover` + a translucent status bar.

**`TopBar` must stay *inside* the scroll div.** It sat outside once, as a sibling ahead of it: since the scroll div is `h-full` (100% of the root) but `TopBar` also took space in normal flow, the two together overflowed the fixed-height root and its `overflow-hidden` silently clipped a `TopBar`'s worth of content off the bottom of **every** tab. It also made scrolling seize up, because the scroll box's real geometry disagreed with what was painted — leaving and re-entering a tab reset it, which is what made it look intermittent. Nesting it also restores its `sticky top-0`, which is inert without a scrolling parent.

**Bottom clearance uses `calc(7rem + env(safe-area-inset-bottom))`, not a flat `pb-28`.** `BottomNav`'s height grows with the home-indicator inset, so a fixed reserve tuned against a zero-inset preview leaves the last card behind the nav on a real device.

### Viewport-height architecture (don't revert to `position: fixed` + `min-h-dvh`)

The app root (`App.tsx`'s outer `div`) is `position: relative`, sized explicitly with `height: var(--app-height, 100dvh)`, translated by `translateY(var(--app-offset, 0px))`, and `overflow-hidden` — it never scrolls itself. `BottomNav`, `TextScalePill`, `BrightnessOverlay`'s dim layer + pill, and `Sheet`'s wrapper are all `position: absolute` (not `fixed`), anchored to this root. The actual page scrolling happens in a nested `h-full overflow-y-auto` div wrapping `TopBar` + the tab content.

`html` and `body` are `overflow: hidden; height: 100%`. The document must never scroll at page level — the shell owns its own nested scroll region — and this stops a page-level scroll from being possible if the shell and viewport ever disagree.

This is not a style choice — it works around a confirmed-on-device iOS bug, and several plausible-looking reverts have re-broken it. The full account is in [`docs/viewport-architecture.md`](docs/viewport-architecture.md); the invariants are:

- **`--app-height`** (`src/hooks/useViewportHeight.ts`) tracks the real viewport height. Below a ~100px shortfall the hook trusts `window.screen`'s physical dimensions over the browser's own figure, because after a cold PWA relaunch WebKit reports a *stable, self-consistently wrong* height — re-measuring later doesn't fix it.
- **That threshold alone can't identify the bug**, so it's additionally gated on `isKeyboardOpen()`. Focus, not magnitude, tells the two cases apart: the keyboard's input accessory bar alone is ~68px, squarely inside the same band. Date/time inputs count — they offset the viewport identically.
- **`--app-offset` pins the shell to the visible region when the keyboard is up.** The shell takes its height from `visualViewport.height` **and** translates by `visualViewport.offsetTop`. Both halves are required; either one alone is a shipped-and-reverted bug. `focusin`/`focusout` are observed directly, because the resize can land before `activeElement` settles.
- **Never `position: fixed` for anything anchored to the shell.** In the broken state WebKit hard-clips fixed content to its own short native viewport, and no `top`/`bottom`/`transform` value escapes that clip. Any new floating pill or full-screen layer gets `absolute` against the root, or it silently reintroduces the bug on the next cold launch.
- The root's `transform` is a plain `translateY`, deliberately **not** the `will-change: transform` containing-block trick — that once broke `Sheet` entirely. Verify `Sheet` still covers the full shell if you touch this.
- A distinct **Chromium desktop preview** bug reproduces against this structure (a scrollable sibling's `getBoundingClientRect()` disagreeing with its own `offsetTop` after a tab switch) and does **not** occur on real Safari. Every shipping target is WebKit — don't mistake it for a regression while testing in the preview browser.
- **Measure, don't reason from screenshots.** Safari Web Inspector against the real device is what cracked this after several wrong fixes; `docs/viewport-architecture.md` also records a `localStorage` + `sqlite3` probe for the native build when Web Inspector isn't to hand.
### iOS form-field quirks (native build only)

Both of these are invisible in a desktop browser and only surfaced on device/simulator:

- **Focus zoom.** WKWebView zooms to a focused field whose font-size is under 16px — `ChipSelector`'s custom-entry input is `text-sm` *and* autofocuses, so tapping "Add custom…" zoomed instantly. Because the shell is a fixed-height non-scrolling root, that zoom shifted it up under the status bar, pushed its right edge off screen, and did not undo itself. `index.html`'s viewport meta therefore carries `maximum-scale=1, user-scalable=no`. iOS Safari has ignored both since iOS 10, so **the PWA keeps pinch-zoom and loses no accessibility** — only the Capacitor WebView honours them. The app's own text-size control is the intended way to enlarge type.
- **Date/time inputs ignore the author box model.** iOS renders `datetime-local`/`date`/`time` as native controls and sizes them itself: on device one reported `box-sizing: content-box` and `min-width: 149px` *even with `border-box` and `min-width: 0` declared and matching*, giving a 396px border box inside a 370px container and hanging ~10px off screen. `appearance: none` (in `src/index.css`) drops the native control so the box model applies; the system picker still opens on tap.

**FAB routing:** the central FAB opens `LogForm` ("Log an attack") only when there's no ongoing attack; if one is already in progress it opens `QuickUpdateForm` ("Add update") instead. This is enforced only at the FAB (`App.tsx`'s `onAdd`) — `AttackFreeCard`'s "Start logging" and the first-run empty-state button are already gated on `!ongoingAttack` by where they render, so the FAB was the only path that could create a second concurrent ongoing attack. Don't reintroduce an unconditional "open LogForm" entry point.

When no attack is ongoing, the Today tab shows `AttackFreeCard` (time since the most recent attack `end`, ticking each minute) or a "no attacks yet" prompt.

**Anything showing a live duration must use `useNowTick` (`src/hooks/useNowTick.ts`), not a bare `setInterval`.** A value derived from `Date.now()` during render is only as fresh as the last render, and an interval alone does not guarantee one: iOS keeps a backgrounded PWA/WKWebView page alive in memory rather than reloading it, and suspends its timers while it's there. On resume the component paints whatever it computed *before* backgrounding, until some unrelated state change re-renders it. Seen on device — the Today card read "Started 1h" for an attack logged the previous day, and only corrected after a tab switch. The hook adds `visibilitychange` + `focus` on top of the interval (the same pair the sync hooks use). Used by `OngoingAttackBanner`, `AttackFreeCard`, and `AccountPanel`'s "Synced 3m ago" line. Note that only the `visibilitychange` path checks `visibilityState` — `focus` refreshes unconditionally, because some environments hand a page focus while still reporting it hidden (the sandboxed preview browser does exactly this, which is how that branch got found).

### The Today hero cards

`AttackFreeCard` and `OngoingAttackBanner` are both thin wrappers over **`HomeCard`** — artwork bleeding off the right edge, text and buttons on the left, one gradient tying them together. Each is `label` / `headline` / `detail` plus action buttons, so the two read as the same object in two states rather than two different components.

Constraints a change here has to respect — the reasoning is in [`docs/today-cards.md`](docs/today-cards.md):

- **Artwork is imported from `src/assets/`, never `public/`**, so Vite fingerprints it — a `public/` file keeps its name forever and the service worker would serve stale art. Shipped copies are re-encoded to 800px JPEG q65.
- **The gradient's opaque stop must sit past the image's left edge** (currently 53%, for an image starting at 50%). Anywhere it has already begun fading at that edge, a seam runs down the card. Move the image and the stops move with it.
- **Tune the stops, not the image.** This is read mid-migraine: contrast under the headline beats showing more picture.
- **`imageAnchor` is per-card, not global** — which edge survives `object-cover`'s crop depends on where the subject sits in that source. Keeping the *left* edge pushes a centred subject *right*.
- **Only the text block is width-limited (`max-w-[64%]`)**, not the content column — the buttons need full width. The headline is `whitespace-nowrap` and overflows onto the artwork on purpose; it's the one line that must land at a glance.
- **Spacing is to a supplied spec and deliberately uneven:** `px-6 py-8`, then 4px under the label, 16px under the headline, 24px before the buttons. Buttons are `rounded-xl`, left in `rem` so the text-size control scales them.
- **Severity is plain text ("Pain severity: 9"), never colour-coded** — a coloured number on illustration reads as part of the illustration, and plain text keeps both cards structurally identical.
- The image is `alt=""` + `aria-hidden`; every fact is in the text beside it.
- The ongoing card's route to `AttackDetail` is **its text block** (`HomeCard`'s `onOpenDetail`) — the whole card can't be the target once buttons live inside it.
- `formatSinceLong` ("14 days") backs the headline; `formatSince` ("14d") is still right for dense rows elsewhere.

`Sheet.tsx` is the reusable full-screen bottom sheet (backdrop/Escape close, body scroll lock, children mounted only when open). It has two opt-in modes: `flush` (non-scrolling flex body, so a child owns its own scroll region — needed because sticky footers were unreliable in iOS PWA scroll containers) and `bareHeader` (Sheet renders no header of its own; the child provides its full top app bar). `LogForm` and `QuickUpdateForm` both use `flush bareHeader` since their top bar shows a live step count and a "Finish now" quick-exit that the generic Sheet header can't express.

## Attack detail (`AttackDetail.tsx`)

Opened from the Logs list and from the Today card's text block. Rendered through `Sheet`'s **`flush bareHeader`** mode, like the two wizards — it owns its top bar and flex-pins its own footer, because a footer that must sit above the home indicator is more reliable pinned than `sticky` inside an iOS PWA scroll container.

- **Top bar:** Close (leading) · "Attack details" · Delete (trailing), both as circular icon buttons. **Delete lives up here, away from the footer**, so the destructive action isn't adjacent to the primary one — it still routes through `ConfirmDialog`, since it's irreversible.
- **Footer, by state:** an ongoing attack gets **Add update** (primary) + **End attack** (secondary); an ended one gets **Add update** alone.
- **"Add update" is deliberately offered on past attacks too**, so a retrospectively logged attack can be backfilled with the readings it actually had. Only "End attack" is exclusive to a live one.
- **"Edit details" is specified but not built.** The design puts it as the primary action for a past attack with Add update demoted to secondary; it's parked until the scope of editing an existing attack is settled (there is no edit path today, and making snapshots mutable is a data-model decision, not a UI one). Until then Add update holds the primary slot rather than shipping a dead button.
- **End attack reuses `EndAttackDialog`** rather than ending immediately, so the Just now / Earlier presets and the minute-vs-second clamping aren't duplicated. `App.tsx` closes the detail sheet on confirm — otherwise it sits there still offering to end an attack that just ended.

`ConfirmDialog.tsx` is the in-app confirm/alert modal that replaces native `confirm()` (Delete attack, Import backup) — it deliberately does **not** lock body scroll so it can stack on top of a `Sheet` without leaving the page unscrollable. Ending an attack has its own dialog, `EndAttackDialog.tsx`, since it needs inline time-picker state: **Just now** / **Earlier** presets (the latter opens a native `datetime-local` picker, min-bounded to the attack's last snapshot time and max-bounded to now). The picker is minute-precision but snapshots are second-precision, so the confirm handler clamps the chosen end time up to `minTime` if picking the exact minimum would otherwise land a few seconds before the last update.

## Pain areas

The canonical list lives in `src/hooks/useUserPrefs.ts` as `PAIN_AREAS` (17 zones). There is no single global severity field — `snapshot.areas` maps each selected zone name to its severity (1–10), and `maxSeverity(snapshot)` in `stats.ts` returns `Math.max(...Object.values(snapshot.areas))` as the effective severity.

The picker (`AreaSeverityPicker`) and the stats heatmap (`HeadHeatmap`) share geometry from `src/components/headDiagram.ts`, which **inlines the user's exported SVG artwork** (`Face front - 1.svg`, `Head back - 1.svg`, in the repo root) as two `DiagramView` configs in the `VIEWS` array. Each view holds a closed `path` per selectable zone plus `disabled` regions (the front jaw + neck, filled `#7d8599`, non-selectable) and a `details` stroke (the lips). Selected zones are filled by `sevFill(severity)` (same low/mid/high thresholds and colors as the `--color-severity-*` CSS tokens: ≤3 green, ≤7 orange, >7 red) so a zone's own color reflects its own severity — not a flat accent fill. The focused zone (the one the slider controls) gets an additional bright outline ring on top.

- **Front (mirrored — screen-left = subject's right), 11 zones:** `Forehead/Temple/Eye/Cheek/Jaw left+right` + `Nose`.
- **Back (not mirrored — screen-left = subject's left), 6 zones:** `Crown/Occiput/Nape left+right`.

A Front/Back toggle switches views (each shows a per-view selected count). It is sized as a **segmented control — 32px overall**, a 28px segment inside a 2px track: at button height it carried the same weight as the wizard's primary/secondary actions and read as something to press to continue, rather than as a switch between two views of the same step. Tapping a zone selects + focuses it; a **single** severity slider follows the focused zone (tapping the focused zone again deselects it). Each selected zone shows its score as a badge on the diagram.

Renaming zones or editing `PAIN_AREAS` strands existing `snapshot.areas` data (which stores the exact strings) — keep the zone-name strings stable. If the user re-exports SVGs, re-inline the path data into the matching `DiagramView`.

**`Nose` was removed on 2026-08-14 and reinstated the same day** (`060cbd6`, reverted by `03c0f79`) — the user changed their mind, so it is present and selectable exactly as before. Recorded because removing it is not a one-line change and the next person to try will otherwise rediscover the same four places: `PAIN_AREAS`, `FRONT.zones` in `headDiagram.ts`, the `sinuses` synonym plus the sideless-zone special case in `voiceParse.ts`'s `extractAreas`, and `AREA_COLORS` in `SeverityChart.tsx`. It is the only sideless zone, which is why `extractAreas` still carries a branch for a bare, un-sided area name.

`HeadHeatmap` (Insights → Pain area frequency) skips rendering a view entirely when none of its zones have any count in the selected period — e.g. an all-front history hides the Back illustration rather than showing an empty head. `AreaSeverityPicker` (the logging picker) always shows both views regardless, since the user picks a view to select in, not to review data.

## Log-attack flow (`LogForm.tsx`)

A single-step-at-a-time wizard, own top app bar (close / step count / **Finish now**), rendered via `Sheet`'s `flush bareHeader` mode. Steps, in order: **When** → **Pain areas** → **Medication** → **Relief methods** → **Symptoms** → **Triggers** → **Note** → **Reminders** (Reminders only shown when the attack is still ongoing — `totalSteps` is 8 or 7). Each non-time step's section header is an `<h2>` title + a sentence-case instruction line, with the text-size stepper (`TextScaleControl`) pinned to its right — no per-step progress bar, no all-caps step labels.

Pain areas is the only required step (`nextDisabled` / the red `*`). Every step after it is optional enrichment, so a **"Finish now"** link sits in the top-right of the app bar letting the user save and skip the rest — it disappears on the final step, where the primary button already reads "Log attack". It is **rendered from step 1 onward and disabled until an area is selected** (with a title saying so), not hidden until then: a control that only materialises once its precondition is met gives no hint it exists, so nobody goes looking for it. Same call as the voice review screen's disabled save. This exists because migraine sufferers often want to log only the pain and stop (e.g. deliberately not logging medication because they're trying to avoid taking it).

**"Woke up with it" is not a start time.** It answers *whether*, not *when*, and the form's untouched default is "Just now" — so the review screen said the attack started just now, which nobody had said. It now shows "Woke up with it" with a line explaining that no time was given and that saving records it as now. Same rule as the invented severity: never present a default as though it were stated.

**A voice draft opens on step 0, a review screen the wizard has only for that case.** It lists what was heard — pain areas with their own severities, start time, medication/reliefs/symptoms/triggers, and the verbatim transcript — and offers **Make changes** (into the wizard at step 1) or **Finish now**. It replaced a banner crammed above the start/end cards on step 1, where the one thing needing checking was the smallest thing on screen. When a severity was invented, **Finish now is shown but disabled**, with each area marked *"no severity heard"* and a line saying what's missing: hiding the control would leave someone mid-migraine hunting for why they can't save, which is a worse failure than a greyed-out button that explains itself.

**"Finish now" is also available from step 1 for a voice draft, but only when a severity was heard.** A voice entry fills the required step before the user reaches it, so the log is already complete on step 1 — gating the shortcut on `step >= 2` (which for manual logging is just a proxy for "areas can't be set yet") made someone tap through all eight screens to commit an attack they had already described out loud, which defeats logging by voice. The severity condition is the other half: if `severityHeard` is false the number is `DEFAULT_SEVERITY`, and a one-tap save would quietly fill the record with 5s nobody said, so the user is made to pass through the Pain areas step and look at it.

Symptoms, Triggers, and Relief methods all use the same `ChipSelector` (pill toggles) for consistency — do not reintroduce `ListSelector` (checkbox rows); it was deleted because having reliefs on pills and symptoms/triggers on checkboxes read as inconsistent.

The **When** step's Start-time card also has a **"Woke up with this migraine"** toggle (`Attack.wokeWithMigraine`, default `false`) — an onset flag independent of the start-time preset chosen (you can wake up with it *and* backdate the exact time via "Other"). Shown in `AttackDetail`'s header when set. `QuickUpdateForm` has no equivalent since it only ever adds snapshots to an attack that already has this decided at creation.

## Quick-update flow (`QuickUpdateForm.tsx`)

Opened via the FAB or `OngoingAttackBanner` for the ongoing attack, **or via "Add update" on any past attack's `AttackDetail`** — updates aren't limited to the live attack; a retrospectively-logged past attack can be backfilled with as many readings as it actually had, not just the one snapshot from `LogForm`. `App.tsx` tracks this as `updateAttackId: number | null` (looked up fresh from `attacks` each render, not a stashed object) rather than a boolean sheet-open flag, so the same sheet/state serves both cases. Two phases:

1. **Choice screen** (`step === 0`) — shows the same context as the Logs detail view (header with date/ongoing-or-duration/max-severity/triggers, `SeverityChart` once there are 2+ snapshots, and the full `SnapshotRow` timeline) so the user has enough information to confidently choose between three answers: **It's over — end attack**, **Nothing changed — log no change**, and **Log what changed**. The first two are hidden for a past attack (`attack.end !== null`): both act on "right now", which means nothing for an attack that already ended, so a past attack skips the choice screen entirely and goes straight to the wizard, which needs an explicit time.

**"It's over" is here because a reminder asks a question this sheet couldn't answer.** The reminder is "how's your migraine?", and one of the three honest replies is that it has stopped — but the only routes out were to log a no-change reading (which asserts the opposite) or close the sheet, find the attack again and end it from the Today tab. It opens the same `EndAttackDialog` the Today tab uses rather than ending immediately, so the time presets and the minute-vs-second clamping are not duplicated, and confirming closes the update sheet underneath it since there is no longer anything to update. It's styled `btn-tertiary`, above both logging options: least frequent answer, but the only one with no other way out of this sheet.
2. **Wizard** (steps 1–6: Update time → Pain areas → Medication → Relief methods → Symptoms → Note) — every field starts **blank**, never pre-filled from the previous snapshot, because an update is a new reading, not an edit of the last one. Instead, each step shows a small non-interactive note below its picker referencing the last entry, in a quiet bordered box (`bg-bg-raised/50` + `border-bg-border` + a muted icon — deliberately colourless, since a tinted info panel would both break the palette rules and pull the eye to the one thing on the step that isn't actionable) (e.g. *"At last entry (20:36), pain was severity 8 — Forehead 8, Temple left 6"*, *"Took Sumatriptan 1 tablet at 20:36 (last entry)"*) — only rendered when the last snapshot actually had something for that field. Same "Finish now" pattern as `LogForm` (available from step 1 onward since nothing here is required). The Update-time picker **defaults to the moment the sheet was opened**, not to the last reading — seeding it from the previous snapshot meant a first update offered the attack's own start time, so accepting the default recorded a reading hours before it happened. It is captured in the `useState` initialiser so it stays the time the user tapped "Add update" rather than ticking, and clamped into the picker's own bounds: `min` (the attack's last snapshot) to `max` (the attack's `end`, or now if still ongoing). For a past attack "now" is past `max`, so it lands on the end time — which does assert something, but so does every default, and the picker is right there. Submit clamps into the same range, for the minute-vs-second-precision gap `EndAttackDialog` already handles. `useAttacks.ts`'s `addSnapshot` only schedules a reminder notification when the target attack has no `end`, since backfilling a past attack must never queue one.

## Shared step-content components

- **`ChipSelector`** — pill multi-select with inline "Add custom…" (reliefs, symptoms, triggers everywhere).
- **`MedicationInput`** — a **"My medications"** chip row *first*, sourced from `recentMeds` (see the Medications section: the acute library, then anything found in attack history), with the free-text name + dose inputs and the quantity quick-pick (`1/2/3 tablets`) collapsed behind a **ghost button** (`btn-tertiary`, "+ Add a different medication") below it. Tapping a chip fills name and dose in one action; each chip carries its own `medIcon`. Picking from a curated list is the ordinary path now that the library exists, and typing a drug that isn't in it is rare — so the rare thing is the one that costs a tap.
  Three details are load-bearing: the inputs **start open when `recentMeds` is empty** (a first log, where a ghost button would be the only control on the step and would hide the only way forward) **or when `value.name` isn't in the list** (a voice draft naming an unknown drug — it has to stay visible and correctable); **tapping the selected chip again clears it**, since with the inputs collapsed that would otherwise be the one choice on the step that can't be undone; and **collapsing the inputs clears what was typed**, because a value left behind a closed panel would be saved without appearing anywhere on screen. A medication typed here isn't added to the library, but it shows up as a chip next time anyway — `recentMeds` scans history too.
- **`NotificationSettings`** — the enable control is a real toggle switch (`role="switch"`, sliding thumb), not a checkbox, and is always rendered expanded (no accordion) since it only ever appears on its own dedicated wizard step now. If you touch the toggle's markup: the thumb needs an explicit `left-0.5` (a `<button>`'s default UA `text-align: center` skews the "static position" fallback an absolutely-positioned child with no explicit `left` would otherwise get), the track needs `overflow-hidden` (a `rounded-full` container does not clip an absolutely-positioned child to its curved corners on its own), and the "on" translate distance must leave the same 2px inset as the other three sides (`translate-x-5`, not a value calibrated for a `left-0` base).
- **`openPicker`** (`src/utils/openPicker.ts`) — shared helper that calls `showPicker()` on a `datetime-local` input (falling back to `.focus()`), used by `LogForm`'s start/end time "Other" option and `EndAttackDialog`'s "Earlier" option so the native picker opens on the same tap that reveals the field.
- **`SnapshotRow`** (`AttackDetail` timeline and `QuickUpdateForm`'s choice-screen timeline) — each reading is a **card**, with the time as plain text in a fixed-width (`w-14`) stem column and the connecting line on that column's right edge, so it holds its x-position whether the time is 4 or 5 characters ("9:09" vs "11:03"). Inside the card, the pain-area line comes first — `Area: N · Area: N`, each zone coloured by its own severity — because that's what the timeline is scanned for. Everything else is a **named section** (`MEDICATION:` / `RELIEF:` / `SYMPTOMS:` / `NOTE:`) separated by hairlines, rather than bare lines whose meaning had to be inferred from punctuation.
  **There is no "Attack start" label.** The oldest reading is the bottom of a list ordered by time, so the label restated what its position already said. A notification-sourced reading still says `No change` / `Via reminder` — that isn't derivable from anything on screen, and `no_change` specifically means severity *held*, not that nobody looked. `AttackDetail`'s "Attack ended" line is the same card shape in muted text.
  Medication keeps its per-name deterministic colour and best-effort form icon (`medIcon`/`medColor` in `src/utils/medDisplay.ts` — 🫧 soluble, 💉 injection, 💨 spray, defaulting to 💊), now as a tinted icon chip with the name in ordinary body colour. It's pattern-matching on the name/dose text, not a drug database, so extend `MED_ICON_RULES` as new forms come up.

## Decision log → `docs/decisions.md`

Why each of the above is the way it is, what was tried, and what was rejected — platform, distribution, voice, notifications, layout, visual design, config reverted, tooling, known gaps. **Read it before undoing anything in this file that looks redundant or over-careful**; most of it was paid for with a round of device testing.

Two live rules that used to be recorded only there, kept here because they constrain new work:

- **Palette rules**: see "Dark-first design, photophobia-aware" above — the `cf621be` rules still hold, with the values retuned warm on 2026-08-18.
- **App icon and splash** live in `assets/` (`icon.png` 1024², `splash.png`/`splash-dark.png` 2732²); regenerate with `npx @capacitor/assets generate --ios`. **The icon must have no alpha channel** — flatten RGBA to RGB or iOS tooling can reject it.
