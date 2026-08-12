# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

It exists for two things a PWA structurally cannot do: **reminders that survive the app being force-quit** (the OS owns the timer — see the notification section) and, eventually, **real Siri App Intents** rather than the Shortcut deep link.

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

## Dark-first design

The app is always dark. `color-scheme: dark` is set globally; `bg-slate-950` is the page background. Never use `dark:` prefixes — dark styles are just the base styles.

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
| `hd_notification_default` | `NotificationConfig` | Saved notification preference |
| `hd_text_scale` | `TextScale` | UI text-size setting |
| `hd_brightness` | `number` | Brightness-overlay setting |

All reads/writes go through the hooks (`useAttacks`, `useUserPrefs`, `useSettings`) — no direct `localStorage` calls elsewhere except `src/utils/backup.ts`.

The trigger/symptom/relief lists are **add-only** (no removal UI). `loadList` in `useUserPrefs` merges any newly-added built-in defaults into a user's stored list, so new built-ins (e.g. adding to `DEFAULT_RELIEFS`) propagate to existing users.

**Export / import:** `src/utils/backup.ts` serialises every `hd_` key to a JSON file (Settings → Data → **Export backup**) and restores it (**Import backup** → confirm → reload). This predates Supabase sync and still works standalone (no sign-in needed) — it's the only cross-device path for a user who doesn't want to create an account.

## Cross-device sync (Supabase, optional)

Sync is opt-in and additive: `localStorage` stays authoritative for all reads (instant, works offline), and when signed in, every local write is *also* best-effort pushed to Supabase. A push failure is `console.error`'d and never blocks or rolls back the local write — but it also surfaces to the user (see the sync indicator below), so a failure like the missing-table incident in the gotchas doesn't go unnoticed again.

- **`src/lib/supabase.ts`** — creates the client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; exports `null` if either is unset, which is the single flag every sync-aware hook checks to no-op.
- **`src/hooks/useAuth.ts`** — session state via `supabase.auth`. Email-only, no passwords: `signInWithEmail` sends a magic link (`signInWithOtp`); `verifyEmailCode` completes sign-in from a typed 6-digit code instead. The code path exists specifically because iOS Safari always opens Mail links in Safari itself, never in a standalone home-screen PWA — there's no way to make the magic link land back in the installed app, so the OTP code (same email, `{{ .Token }}`) is the only way to sign in from inside the PWA.
- **`src/lib/sync.ts`** — `pullAttacks`/`pushAttacks`/`deleteAttackRemote` and `pullUserPrefs`/`pushUserPrefs`; maps between the local `Attack`/`Snapshot` shape and the `attacks`/`user_prefs` table rows (snake_case columns, e.g. `end_time`, `notification_config`).
- **`src/hooks/useAttacks.ts`** and **`useUserPrefs.ts`** each take `userId: string | null` and run their own `sync()`, merge, and re-push on mount/sign-in **and again on every `visibilitychange`/`focus` event** — not just once — because iOS keeps a backgrounded PWA's page alive in memory rather than reloading it, so a mount-only sync would go stale indefinitely once the app is reopened from the background. Each hook also exposes `syncStatus: 'idle' | 'syncing' | 'synced' | 'error'` and `lastSyncedAt`, set both by the periodic `sync()` and by every individual fire-and-forget push (via a shared `trackPush` wrapper in each hook).
- **Merge strategy differs by data shape:** attacks merge per-id by comparing `updatedAt` (last-write-wins — true concurrent edits to the *same* attack from two devices at once aren't handled specially). Trigger/symptom/relief lists merge as a plain union (`useUserPrefs.ts`'s `union()`), since those lists are add-only everywhere already — there's no real conflict to resolve.
- **`supabase/schema.sql`** — run once in the Supabase SQL editor to create `attacks` + `user_prefs`, both with RLS policies scoped to `auth.uid() = user_id`. Snapshots stay a `jsonb` array column rather than their own table, since they're always read/written whole with their parent attack. **Adding a new `Attack`/`Snapshot` field that gets pushed to Supabase (e.g. `wokeWithMigraine` → `woke_with_migraine`) requires an `alter table ... add column` on any already-created table** — `create table if not exists` in schema.sql only helps fresh installs; an existing table silently rejects every push with an unknown-column error until migrated (schema.sql has the exact statement commented above the `attacks` table).
- Settings → **Account & sync** (`SettingsView.tsx`) renders only when `supabase` is non-null, with the magic-link form and the OTP code-entry fallback. When signed in, `App.tsx` combines the two hooks' `syncStatus`/`lastSyncedAt` (error takes priority over syncing, which takes priority over the most recent successful sync) into one `SyncIndicator` line — a colored dot + "Synced 3m ago" / "Syncing…" / "Sync failed — will retry automatically" / "Waiting to sync…" — so a silent push failure is visible instead of only reaching the console.
- No realtime subscription — sync is pull-on-foreground, not push-based, so a change on device A won't reach device B until B is foregrounded or reloaded. Acceptable for personal use; worth knowing if debugging "why hasn't this shown up yet."

**Supabase project gotchas** (email deliverability, redirect URLs, RLS) live in the Supabase dashboard, not in code — see Authentication → Email Templates (the magic-link template must include `{{ .Token }}` for the OTP fallback to work) and Authentication → URL Configuration (both a `/**` wildcard *and* the exact bare-origin URL need to be in the Redirect URLs allowlist; the Site URL field is a separate fallback Supabase silently uses if nothing in Redirect URLs matches).

## Notification architecture

Two backends, chosen at runtime in `src/utils/notifications.ts` by `Capacitor.isNativePlatform()`. `scheduleNotification` / `cancelNotification` keep one signature across both, so `useAttacks` never branches on platform.

- **Native (iOS)** — `@capacitor/local-notifications`. The OS owns the timer, so a reminder still fires after the app is force-quit. This is the reason the native shell exists.
- **Web (browser + installed PWA)** — the original service worker (`public/sw.js`), which keeps a `Map<attackId, timerId>` of pending `setTimeout` calls. Survives tab navigation but **not** a browser restart.

Flow: `startAttack` / `addSnapshot` → `scheduleNotification()` → (native) `LocalNotifications.schedule` / (web) `SCHEDULE_NOTIFICATION` to the SW → reminder fires → user taps an action → `onNotificationAction()` hands `{ action, attackId }` to `App.tsx`, which calls `addSnapshot(..., 'notification_no_change')` or opens the update sheet.

Things that will bite when touching this:

- **`onNotificationAction` is the only subscription point.** It hides which backend delivered the event and absorbs `snooze` itself (rescheduled natively, handled in the SW on web), so callers only see actions that change data. Don't re-add a `snooze` branch in `App.tsx`.
- **Notification ids are folded.** Attack ids are `Date.now()`, which overflows the 32-bit int the plugin wants, so `notifId()` maps them into a safe range. It's deterministic, so `cancel` derives the same id `schedule` used and re-scheduling replaces rather than stacks.
- **Action buttons must be registered before the first schedule** (`registerNotificationActions()`, called from `useNotifications` on mount) or iOS renders the notification with no buttons.
- **Every action sets `foreground: true`, and must.** It maps to `UNNotificationAction`'s `.foreground` and defaults to `false`, which runs the action *without* opening the app. All three actions are handled in JavaScript inside the WebView, so with the app evicted from memory there is nothing alive to handle them: on device, tapping "Something changed" on a reminder that arrived 30 minutes later dismissed the notification and did nothing. The cost is that "No change" and "Snooze" now open the app instead of resolving silently — worth it, since a reminder is most likely answered exactly when the app *has* been evicted, and a tap that silently drops a reading is worse than one that opens the app. Making those two resolve without opening the app means handling them natively in Swift.
- **The body text is frozen at schedule time but read at fire time**, so nothing relative belongs in it. `formatElapsed` produced "Started just now" on a reminder that arrived 30 minutes after the attack began; it uses `formatTime` (an absolute clock time) instead, which stays true however long the notification sits unread.
- **Tapping the notification body** reports `actionId: 'tap'` on iOS; that maps to `update`, matching the SW's default click.
- `useNotifications` requests permission through the plugin on native and `Notification.requestPermission()` on web, normalising both onto `'default' | 'granted' | 'denied'`.

Adaptive schedule: +1h after first snapshot, +2h after any subsequent snapshot. Notifications are not scheduled if `attack.end` is already set (retrospective logs).

**Permission is requested before anything is scheduled** (`handleLogSave` awaits it). iOS accepts a request made while permission is undecided but never delivers it if the user then declines, which would leave an attack looking like it had a reminder queued when it had none. The request is wrapped so a failure can't cost the user the log entry.

**Verified in the simulator:** a notification scheduled through the plugin is delivered by the OS and appears in Notification Center with the right title/body/icon; permission is prompted before `hd_attacks` is written, and denying still stores the attack. **Not verified:** the action buttons round-tripping back into `addSnapshot` — synthetic taps on Simulator notifications don't activate them, so that needs a real device.

## Voice logging

Two entry points, both landing in the same handler in `App.tsx`, which parses the transcript and opens the matching sheet prefilled — `LogForm` for a new attack, `QuickUpdateForm` when one is ongoing (the same routing the FAB uses). Nothing auto-submits; the wizard still walks every step.

- **Siri App Intent** (native) — `ios/App/App/LogMigraineIntent.swift`. "Hey Siri, log a migraine", no user setup.
- **Siri Shortcut deep link** (`?voice=<transcript>`) — the original path, still the only option on the PWA, since Siri App Intents are native-only and iOS Safari doesn't implement the Web Speech API (an in-app mic button would silently do nothing there).

**The intent cannot write an attack itself.** Attacks live in `localStorage` inside the WebView, which native code can't reach — so it captures what was said and hands it over, exactly as the Shortcut did.

The handoff deliberately avoids a custom native bridge: `@capacitor/preferences` on iOS stores to `UserDefaults.standard` with keys prefixed `CapacitorStorage.`, so the intent writes `CapacitorStorage.pendingVoiceEntry` directly and `consumePendingVoiceEntry()` (`src/utils/pendingVoice.ts`) reads it with a plain `Preferences.get`. **The key name is duplicated in Swift and TS — change one, change the other.** It's read on mount *and* on every foreground, because the intent may have written it before the web layer started or while the app was backgrounded, and it's cleared on read so it fires once.

- **App Intents need iOS 16**; the deployment target is 15, so the intent is availability-gated. On iOS 15 there's simply no Siri support.
- **`voiceHandledRef` releases when the sheet closes.** It guards against double-firing within one delivery, but the intent (unlike a URL param consumed once per load) can run again at any time — latching it for the page's lifetime made Siri work exactly once per app session.
- Adding a Swift file to the target should be scripted with the `xcodeproj` gem (ships with CocoaPods) rather than hand-editing `project.pbxproj`.

`src/utils/voiceParse.ts` is deliberately low-precision — substring/prefix matching against the user's own chip lists, not NLP:

- Needle words under 4 characters need an exact word match; longer ones need a 4-character shared prefix. An earlier 5-char-stem rule let filler words ("a", "me", "my") match unrelated entries — a test sentence produced "Aura", "Alcohol" and "Menstruation" from a transcript containing none of them.
- A side-less mention ("my forehead is killing me") selects **both** sides rather than guessing.
- Medications only match against `recentMeds` (names already in the user's history), so a drug named for the first time by voice won't be picked up — it survives in the note.
- The raw transcript is always kept verbatim as the note, so nothing said is lost when the structured parse misses, and the prefill banner lists exactly what was recognised so a wrong guess is visible rather than silently saved.

`src/utils/voiceParse.ts` is deliberately low-precision — substring/prefix matching against the user's own chip lists, not NLP:

- Needle words under 4 characters need an exact word match; longer ones need a 4-character shared prefix. An earlier 5-char-stem rule let filler words ("a", "me", "my") match unrelated entries — a test sentence produced "Aura", "Alcohol" and "Menstruation" from a transcript containing none of them.
- A side-less mention ("my forehead is killing me") selects **both** sides rather than guessing.
- The raw transcript is always kept verbatim as the note, so nothing said is lost when the structured parse misses, and the prefill banner lists exactly what was recognised so a wrong guess is visible rather than silently saved.

## App shell

`App.tsx` owns all sheet/modal open state and routes notification actions. Four tabs — Today (`log`), Logs (`history`), Insights (`stats`), Settings — rendered conditionally in one `div`, no router. `TopBar` and the tab content live inside a nested `overflow-y-auto` scroll div; `BottomNav` and the floating pills are positioned outside it (see below). All of them pad for the iOS safe-area insets (`env(safe-area-inset-*)`), needed because the app uses `viewport-fit=cover` + a translucent status bar.

**`TopBar` must stay *inside* the scroll div.** It sat outside once, as a sibling ahead of it: since the scroll div is `h-full` (100% of the root) but `TopBar` also took space in normal flow, the two together overflowed the fixed-height root and its `overflow-hidden` silently clipped a `TopBar`'s worth of content off the bottom of **every** tab. It also made scrolling seize up, because the scroll box's real geometry disagreed with what was painted — leaving and re-entering a tab reset it, which is what made it look intermittent. Nesting it also restores its `sticky top-0`, which is inert without a scrolling parent.

**Bottom clearance uses `calc(7rem + env(safe-area-inset-bottom))`, not a flat `pb-28`.** `BottomNav`'s height grows with the home-indicator inset, so a fixed reserve tuned against a zero-inset preview leaves the last card behind the nav on a real device.

### Viewport-height architecture (don't revert to `position: fixed` + `min-h-dvh`)

The app root (`App.tsx`'s outer `div`) is `position: relative`, sized explicitly with `height: var(--app-height, 100dvh)`, translated by `translateY(var(--app-offset, 0px))`, and `overflow-hidden` — it never scrolls itself. `BottomNav`, `TextScalePill`, `BrightnessOverlay`'s dim layer + pill, and `Sheet`'s wrapper are all `position: absolute` (not `fixed`), anchored to this root. The actual page scrolling happens in a nested `h-full overflow-y-auto` div wrapping `TopBar` + the tab content.

`html` and `body` are `overflow: hidden; height: 100%`. The document must never scroll at page level — the shell owns its own nested scroll region — and this stops a page-level scroll from being possible if the shell and viewport ever disagree.

This exists because of a real, confirmed-on-device iOS bug, found only after several failed fix attempts based on screenshots alone (see git log around commits `5bf13a4`…`a25b2fa` for the full trail):

- **`--app-height`** (`src/hooks/useViewportHeight.ts`) tracks the real viewport height into a CSS var. After a **cold PWA relaunch** (force-quit from the app switcher, then reopened from the home-screen icon — not just backgrounded/resumed), WebKit can report `visualViewport.height`/`innerHeight` as if the translucent status bar were opaque reserved space rather than an overlay — a stable, self-consistent wrong number, not a stale one, so simply re-measuring later doesn't fix it. Below a ~100px shortfall the hook trusts `window.screen`'s physical dimensions instead of the browser's own figure.
- **That threshold alone can't identify the status-bar bug** — the original "a keyboard is always 200px+" reasoning was wrong. The keyboard's *input accessory bar* alone takes ~68px, squarely inside the sub-100px band. So the workaround is additionally gated on `isKeyboardOpen()` (a focused `input`/`textarea`, or a non-zero `visualViewport.offsetTop`): focus, not magnitude, tells the two cases apart. Date/time inputs count — they raise a picker rather than a keyboard, but offset the viewport identically.
- **Even with `--app-height` correct, `position: fixed` elements were still broken.** Confirmed via live Safari Web Inspector (USB-connected iPhone, `Develop` menu → device → page) on the real device, not just theory: in this broken state WebKit **hard-clips** `position: fixed` content to its own short native viewport — e.g. `BottomNav`'s icons rendered but its labels (further down in the same fixed box) didn't, no matter what `top`/`bottom`/`transform` values were used to try to reposition it. No CSS offset on a `fixed` element can escape that clip. The only fix was to stop using `position: fixed` for these elements entirely and anchor them to a correctly-sized, non-scrolling `position: relative` ancestor instead (`position: absolute`), which isn't subject to the same clip.
- **`--app-offset` pins the shell to the *visible* region when the keyboard is up.** WebKit does not shorten the layout viewport for the keyboard: it keeps the layout viewport full height and describes what's actually on screen as `[visualViewport.offsetTop, + visualViewport.height]`. Two failure modes follow, and both were shipped and reverted before the current fix:
  - Sizing the shell to `visualViewport.height` alone **subtracts the keyboard twice** when WebKit *has* offset — the shell ends where the keyboard starts *and* is shifted up by the same amount again, stranding `BottomNav` mid-screen with a gap beneath it.
  - Keeping the shell at full height and relying on WebKit's offset fails when it *hasn't* offset — it only scrolls when it must reveal the focused field, so focusing an already-visible field leaves `offsetTop` at 0 and the nav underneath the keyboard, until an unrelated scroll makes it snap into place.
  
  The shell therefore takes its height from `visualViewport.height` **and** translates by `visualViewport.offsetTop`, covering the visible region either way. `focusin`/`focusout` are observed directly, because the viewport resize can land before `activeElement` settles.
- The root's `transform` is a plain `translateY`, deliberately **not** the `will-change: transform` containing-block trick that once broke `Sheet` entirely. Every overlay is already `absolute` against the root, so nothing depends on it not establishing a containing block — but verify `Sheet` still covers the full shell if you touch this.
- If you ever need to add another floating/overlay element (another pill, another full-screen layer), give it `absolute` relative to this root — **not** `fixed` — or it will silently reintroduce this bug on the next cold launch.
- This structure reproduces a distinct, confirmed **Chromium desktop preview** bug (a scrollable sibling's `getBoundingClientRect()` disagreeing with its own `offsetTop`/`offsetParent` after a tab switch) that does **not** occur on real Safari — irrelevant in production, since every shipping target (installed PWA, native iOS build) is WebKit, but don't mistake it for a regression if you see it while testing in the sandboxed preview browser or desktop Chrome.
- **Debugging method note:** screenshots alone were not enough to diagnose this — several fixes shipped, verified only by reasoning + screenshots, and made things worse (a `will-change: transform` containing-block trick broke `Sheet`'s overlay behavior entirely; a `top` + `translateY(-100%)` anchoring attempt overshot past the true edge). What actually cracked it was connecting the real iPhone to a Mac via Safari's Web Inspector (`Settings → Safari → Advanced → Web Inspector` on the phone, `Develop` menu in Safari on the Mac) and running diagnostic JS directly against the live, broken DOM. If this class of bug resurfaces, reach for that first rather than iterating blind. The keyboard-offset work above repeated the same lesson: two wrong fixes shipped from reasoning about screenshots, and only measuring `visualViewport.height`/`offsetTop` against the shell's own rect settled it.
- **Measuring inside the native app without Web Inspector.** For the Capacitor build there's a cheap offline channel: inject a probe `<script>` into `public/index.html` *inside the installed simulator bundle* (`xcrun simctl get_app_container <udid> <bundle-id>`), have it write numbers to `localStorage`, relaunch, then read them straight off disk with `sqlite3` from `…/Library/WebKit/**/localstorage.sqlite3` (values are UTF-16). No rebuild per iteration, and it works when the app renders nothing at all. Reinstall the app afterwards to drop the probe.

### iOS form-field quirks (native build only)

Both of these are invisible in a desktop browser and only surfaced on device/simulator:

- **Focus zoom.** WKWebView zooms to a focused field whose font-size is under 16px — `ChipSelector`'s custom-entry input is `text-sm` *and* autofocuses, so tapping "Add custom…" zoomed instantly. Because the shell is a fixed-height non-scrolling root, that zoom shifted it up under the status bar, pushed its right edge off screen, and did not undo itself. `index.html`'s viewport meta therefore carries `maximum-scale=1, user-scalable=no`. iOS Safari has ignored both since iOS 10, so **the PWA keeps pinch-zoom and loses no accessibility** — only the Capacitor WebView honours them. The app's own text-size control is the intended way to enlarge type.
- **Date/time inputs ignore the author box model.** iOS renders `datetime-local`/`date`/`time` as native controls and sizes them itself: on device one reported `box-sizing: content-box` and `min-width: 149px` *even with `border-box` and `min-width: 0` declared and matching*, giving a 396px border box inside a 370px container and hanging ~10px off screen. `appearance: none` (in `src/index.css`) drops the native control so the box model applies; the system picker still opens on tap.

**FAB routing:** the central FAB opens `LogForm` ("Log an attack") only when there's no ongoing attack; if one is already in progress it opens `QuickUpdateForm` ("Add update") instead. This is enforced only at the FAB (`App.tsx`'s `onAdd`) — `AttackFreeCard`'s "Start logging" and the first-run empty-state button are already gated on `!ongoingAttack` by where they render, so the FAB was the only path that could create a second concurrent ongoing attack. Don't reintroduce an unconditional "open LogForm" entry point.

When no attack is ongoing, the Today tab shows `AttackFreeCard` (time since the most recent attack `end`, ticking each minute) or a "no attacks yet" prompt.

`Sheet.tsx` is the reusable full-screen bottom sheet (backdrop/Escape close, body scroll lock, children mounted only when open). It has two opt-in modes: `flush` (non-scrolling flex body, so a child owns its own scroll region — needed because sticky footers were unreliable in iOS PWA scroll containers) and `bareHeader` (Sheet renders no header of its own; the child provides its full top app bar). `LogForm` and `QuickUpdateForm` both use `flush bareHeader` since their top bar shows a live step count and a "Finish now" quick-exit that the generic Sheet header can't express.

`ConfirmDialog.tsx` is the in-app confirm/alert modal that replaces native `confirm()` (Delete attack, Import backup) — it deliberately does **not** lock body scroll so it can stack on top of a `Sheet` without leaving the page unscrollable. Ending an attack has its own dialog, `EndAttackDialog.tsx`, since it needs inline time-picker state: **Just now** / **Earlier** presets (the latter opens a native `datetime-local` picker, min-bounded to the attack's last snapshot time and max-bounded to now). The picker is minute-precision but snapshots are second-precision, so the confirm handler clamps the chosen end time up to `minTime` if picking the exact minimum would otherwise land a few seconds before the last update.

## Pain areas

The canonical list lives in `src/hooks/useUserPrefs.ts` as `PAIN_AREAS` (17 zones). There is no single global severity field — `snapshot.areas` maps each selected zone name to its severity (1–10), and `maxSeverity(snapshot)` in `stats.ts` returns `Math.max(...Object.values(snapshot.areas))` as the effective severity.

The picker (`AreaSeverityPicker`) and the stats heatmap (`HeadHeatmap`) share geometry from `src/components/headDiagram.ts`, which **inlines the user's exported SVG artwork** (`Face front - 1.svg`, `Head back - 1.svg`, in the repo root) as two `DiagramView` configs in the `VIEWS` array. Each view holds a closed `path` per selectable zone plus `disabled` regions (the front jaw + neck, filled `#7d8599`, non-selectable) and a `details` stroke (the lips). Selected zones are filled by `sevFill(severity)` (same low/mid/high thresholds and colors as the `--color-severity-*` CSS tokens: ≤3 green, ≤7 orange, >7 red) so a zone's own color reflects its own severity — not a flat accent fill. The focused zone (the one the slider controls) gets an additional bright outline ring on top.

- **Front (mirrored — screen-left = subject's right), 11 zones:** `Forehead/Temple/Eye/Cheek/Jaw left+right` + `Nose`.
- **Back (not mirrored — screen-left = subject's left), 6 zones:** `Crown/Occiput/Nape left+right`.

A Front/Back toggle switches views (each shows a per-view selected count). Tapping a zone selects + focuses it; a **single** severity slider follows the focused zone (tapping the focused zone again deselects it). Each selected zone shows its score as a badge on the diagram.

Renaming zones or editing `PAIN_AREAS` strands existing `snapshot.areas` data (which stores the exact strings) — keep the zone-name strings stable. If the user re-exports SVGs, re-inline the path data into the matching `DiagramView`.

`HeadHeatmap` (Insights → Pain area frequency) skips rendering a view entirely when none of its zones have any count in the selected period — e.g. an all-front history hides the Back illustration rather than showing an empty head. `AreaSeverityPicker` (the logging picker) always shows both views regardless, since the user picks a view to select in, not to review data.

## Log-attack flow (`LogForm.tsx`)

A single-step-at-a-time wizard, own top app bar (close / step count / **Finish now**), rendered via `Sheet`'s `flush bareHeader` mode. Steps, in order: **When** → **Pain areas** → **Medication** → **Relief methods** → **Symptoms** → **Triggers** → **Note** → **Reminders** (Reminders only shown when the attack is still ongoing — `totalSteps` is 8 or 7). Each non-time step's section header is an `<h2>` title + a sentence-case instruction line, with the text-size stepper (`TextScaleControl`) pinned to its right — no per-step progress bar, no all-caps step labels.

Pain areas is the only required step (`nextDisabled` / the red `*`). Every step after it is optional enrichment, so once at least one area is selected, a **"Finish now"** link appears in the top-right of the app bar (replacing the step counter there) letting the user save and skip the rest — it disappears again on the final step, where the primary button already reads "Log attack". This exists because migraine sufferers often want to log only the pain and stop (e.g. deliberately not logging medication because they're trying to avoid taking it).

Symptoms, Triggers, and Relief methods all use the same `ChipSelector` (pill toggles) for consistency — do not reintroduce `ListSelector` (checkbox rows); it was deleted because having reliefs on pills and symptoms/triggers on checkboxes read as inconsistent.

The **When** step's Start-time card also has a **"Woke up with this migraine"** toggle (`Attack.wokeWithMigraine`, default `false`) — an onset flag independent of the start-time preset chosen (you can wake up with it *and* backdate the exact time via "Other"). Shown in `AttackDetail`'s header when set. `QuickUpdateForm` has no equivalent since it only ever adds snapshots to an attack that already has this decided at creation.

## Quick-update flow (`QuickUpdateForm.tsx`)

Opened via the FAB or `OngoingAttackBanner` for the ongoing attack, **or via "Add update" on any past attack's `AttackDetail`** — updates aren't limited to the live attack; a retrospectively-logged past attack can be backfilled with as many readings as it actually had, not just the one snapshot from `LogForm`. `App.tsx` tracks this as `updateAttackId: number | null` (looked up fresh from `attacks` each render, not a stashed object) rather than a boolean sheet-open flag, so the same sheet/state serves both cases. Two phases:

1. **Choice screen** (`step === 0`) — shows the same context as the Logs detail view (header with date/ongoing-or-duration/max-severity/triggers, `SeverityChart` once there are 2+ snapshots, and the full `SnapshotRow` timeline) so the user has enough information to confidently choose **Nothing changed — log no change** vs **Log what changed**. The "Nothing changed" option is hidden for a past attack (`attack.end !== null`) since it logs against "right now," which doesn't mean anything for an attack that already ended — a past attack always needs an explicit time via the wizard instead.
2. **Wizard** (steps 1–6: Update time → Pain areas → Medication → Relief methods → Symptoms → Note) — every field starts **blank**, never pre-filled from the previous snapshot, because an update is a new reading, not an edit of the last one. Instead, each step shows a small non-interactive caption below its picker referencing the last entry (e.g. *"At last entry (20:36), pain was severity 8 — Forehead 8, Temple left 6"*, *"Took Sumatriptan 1 tablet at 20:36 (last entry)"*) — only rendered when the last snapshot actually had something for that field. Same "Finish now" pattern as `LogForm` (available from step 1 onward since nothing here is required). The Update-time picker is bounded `min` (the attack's last snapshot) to `max` (the attack's `end`, or now if still ongoing) — submit clamps into that range too, for the same minute-vs-second-precision gap `EndAttackDialog` already handles. `useAttacks.ts`'s `addSnapshot` only schedules a reminder notification when the target attack has no `end`, since backfilling a past attack must never queue one.

## Shared step-content components

- **`ChipSelector`** — pill multi-select with inline "Add custom…" (reliefs, symptoms, triggers everywhere).
- **`MedicationInput`** — name + dose text inputs, a quantity quick-pick (`1/2/3 tablets`), and a **"Previously used"** chip row *below* the inputs sourced from `recentMeds` (built in `App.tsx` by scanning all attacks' snapshots for medication, most-recently-used first, deduped by name) — tapping a chip fills both name and dose in one action. This is deliberately below the inputs, not above, since a returning user's own meds are the primary path and typing is the fallback.
- **`NotificationSettings`** — the enable control is a real toggle switch (`role="switch"`, sliding thumb), not a checkbox, and is always rendered expanded (no accordion) since it only ever appears on its own dedicated wizard step now. If you touch the toggle's markup: the thumb needs an explicit `left-0.5` (a `<button>`'s default UA `text-align: center` skews the "static position" fallback an absolutely-positioned child with no explicit `left` would otherwise get), the track needs `overflow-hidden` (a `rounded-full` container does not clip an absolutely-positioned child to its curved corners on its own), and the "on" translate distance must leave the same 2px inset as the other three sides (`translate-x-5`, not a value calibrated for a `left-0` base).
- **`openPicker`** (`src/utils/openPicker.ts`) — shared helper that calls `showPicker()` on a `datetime-local` input (falling back to `.focus()`), used by `LogForm`'s start/end time "Other" option and `EndAttackDialog`'s "Earlier" option so the native picker opens on the same tap that reveals the field.
- **`SnapshotRow`** (`AttackDetail` timeline and `QuickUpdateForm`'s choice-screen timeline) — the time itself is a pill marker on the timeline stem (same neutral style for every row, including "Attack start" and `AttackDetail`'s "Attack ended" line — those two anchors are highlighted via bold accent-colored *label text* next to the pill, not the pill itself, which stays muted so it doesn't compete with the pain-area colors) instead of a plain dot. The stem column has a fixed width (`w-16`) so the connecting line's x-position — and every pill's center — lines up exactly regardless of whether the time is 4 or 5 characters (e.g. "9:09" vs "11:03"); the line itself is one continuous absolutely-positioned element per row (spanning the row's full height) rather than a short segment below the pill, so it reads as unbroken down the column. The pain-area+severity chips are the row's first line, since that's the one thing worth scanning for, with the source label (`Attack start` / `(no change)` / `(via notification)`) demoted to a small caption under it — there's no generic "Update" label. Medication lines get a per-name deterministic color (hash into a fixed palette) and a best-effort form icon (`MED_ICON_RULES` in `SnapshotRow.tsx` — 🫧 for soluble/effervescent tablets like Treo, 💉 injections, 💨 sprays, etc., defaulting to 💊); it's pattern-matching on the name/dose text, not a real drug database, so extend the rules list as new forms come up rather than expecting it to know an arbitrary medication's form.
