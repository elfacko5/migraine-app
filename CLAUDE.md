# CLAUDE.md

Rules for working in this codebase. Reasoning behind each rule lives in `docs/`; a rule with no visible justification has one there.

| File | Read before |
|------|-------------|
| [`docs/decisions.md`](docs/decisions.md) | undoing anything here — also carries **the backlog in priority order** |
| [`docs/voice-parsing.md`](docs/voice-parsing.md) | changing any rule in `src/utils/voiceParse.ts` |
| [`docs/viewport-architecture.md`](docs/viewport-architecture.md) | touching the app shell's height, offset, or overlay positioning |
| [`docs/notifications.md`](docs/notifications.md) | changing how a reminder is scheduled, sounded, or answered |
| [`docs/redesign-v3/index.html`](docs/redesign-v3/index.html) | building or changing any v3 screen (supersedes older artboards) |
| [`docs/today-cards.md`](docs/today-cards.md) | restyling `HomeCard` or swapping its artwork |
| [`docs/palette.md`](docs/palette.md) | changing a colour token or adding hardcoded hex |
| [`docs/plan-medication-flows.md`](docs/plan-medication-flows.md) | changing medication add/edit/guides/remove flows or dose matching |
| [`docs/editing-assessment.md`](docs/editing-assessment.md) | building any way to change an existing attack or reading |
| [`docs/widget.md`](docs/widget.md) | touching the WidgetKit extension, its payload, or its layout |
| [`docs/native-ios.md`](docs/native-ios.md) | touching Capacitor config, Xcode build phases, provisioning, or native plugins |
| [`docs/component-rules.md`](docs/component-rules.md) | adding/changing a Sheet, dialog, chip, icon, or shared UI component |
| [`research/migraine-app-research-dossier.md`](research/migraine-app-research-dossier.md) | changing anything clinical, **any user-facing wording** (§9), or the palette/type/attack-mode rules |

**Skill: `.claude/skills/lidd-ui/SKILL.md`.** Invoke *before* building any user-facing UI.

**Reviewer: `.claude/agents/reviewer.md`.** When June says "review" or "check": start the agent with `subagent_type: reviewer` on the last commit. Run it also after any commit that changes stored data, sync, counts or warnings.

## Commands

```bash
source ~/.nvm/nvm.sh && npm run dev        # localhost:5173
source ~/.nvm/nvm.sh && npm run build      # Vite build — does NOT type-check
source ~/.nvm/nvm.sh && npm run typecheck  # tsc --noEmit — the actual type gate
source ~/.nvm/nvm.sh && npm run lint       # must report zero errors
source ~/.nvm/nvm.sh && npm run preview    # serve dist/ locally
source ~/.nvm/nvm.sh && nvm use 22 && npm run ios   # build + cap copy
```

**`typecheck` is the closest thing to a test — run it.** `build` is a bare `vite build` and strips types without checking. **`lint` reports zero; any error is one you introduced.** Each `eslint-disable-next-line` has a reason comment *above* the directive (not through `--`), and exists because the pattern is deliberate.

**Both `.claude/launch.json` configs are `--strictPort`** — `migraine-app` on 5173, `migraine-app-scratch` on 5174. Never go back to `autoPort` — a different port is a different `localStorage` origin and looks like data loss. The scratch server can hold a live Supabase session; **check that the origin is signed out before seeding anything**.

## Stack

Vite 8 + React 19 + TypeScript (strict) + Tailwind CSS v4 + Recharts + `@supabase/supabase-js`. `localStorage` is the source of truth; Supabase provides optional cross-device sync. PWA via `public/manifest.json` + `public/sw.js`.

**Two shipping targets, one codebase.** Browser/PWA *and* native iOS via Capacitor. Where behaviour differs, branch at runtime on `Capacitor.isNativePlatform()`. **Tailwind v4:** configured through `@tailwindcss/vite`; custom tokens in `src/index.css` under `@theme {}`.

## Native iOS shell (Capacitor)

`ios/` is a Xcode project wrapping the Vite build in WKWebView. Key rules:

- The `App` target has a **build-web-assets run-script phase** (always out of date, fails if nvm missing). Pressing Run in Xcode is enough.
- `appId` in `capacitor.config.ts` must match `PRODUCT_BUNDLE_IDENTIFIER` (`com.sunny.migrainetracker2`).
- Deployment target 15.0. Free provisioning — builds expire 7 days. First launch needs certificate trust under Settings → General → VPN & Device Management.
- `pod install` needs `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- Add Swift files via the `xcodeproj` gem, never hand-edit `project.pbxproj`.
- Simulator trackpad scrolling doesn't work (the document never scrolls); touch drags work fine.

## Tone and copy

Spec is **§9 of the research dossier**. Register: *calm, plain, matter-of-fact, validating*.

- **No streaks, badges or congratulation.** Reward the logging habit, never the health outcome.
- **Never imply fault.** No "you forgot", "you missed", "you haven't logged".
- **Never alarmist.** Sync failures are amber, not alarm colour.
- **Plainer the deeper into an attack** (§9.5). One clause, ask a question rather than issue an instruction.
- **"Attack" everywhere in user-facing strings.** Do not use "migraine" in any user-facing string — episode/day word is "attack". Captions may still explain the clinical threshold. Spoken Siri "log a migraine" stays. (A8 decision, 2026-11-22.)
- **Supportive, not diagnostic.** State the count and the guideline, conclude nothing, never read as dosing advice.
- **The FAB menu says "attack"**: Log an attack, Add a past attack, Add an update, End attack.

## Shape roles

Structures take a role from `@theme` in `src/index.css`, **never a raw step**.

| | Role | Instead of |
|---|---|---|
| Radius | `rounded-control` · `rounded-card` · `rounded-sheet` · `rounded-chip` · `rounded-field` · `rounded-segment` · `rounded-badge` | `rounded-xl`, `rounded-2xl`, etc. |
| Size | `size-target` / `min-h-target` (44px) · `size-compact` (36px) | `h-11 w-11`, `h-9 w-9` |
| Padding | `p-card` · `px-control-x` + `py-control-y` · `px-control-compact-x` + `py-control-compact-y` · `px-gutter` + `sm:px-gutter-wide` | `p-4`, `px-4 py-3`, etc. |

`group`, `inset`, `control-sm`, `field-lg`, `badge-sm` are temporary drift tokens — never use in new code.

## Buttons

`.btn-primary` / `.btn-secondary` / `.btn-tertiary` carry their own radius, padding, type and disabled treatment. Call sites should use the bare class and let it inherit.

| | Use | How |
|---|---|---|
| **Default** | Footer action, full width | `btn-primary w-full` |
| **`.btn-compact`** | Action inside a card, hugs text | `btn-primary btn-compact` |
| **`.btn-inline`** | Inline action (52px) | `btn-primary btn-inline` |

- **Outline on pressable controls:** `--color-border-control` (3:1). Hairlines between readable content: `--color-bg-border`.
- **Disabled `btn-primary`/`btn-secondary`:** automatic muted `bg-raised` treatment with dimmed label (a `color-mix`). Never `disabled:opacity-40`.
- **`btn-secondary` outline is a `ring` (inset box-shadow), never a `border`** — a border adds 2px and breaks alignment.
- **Selected state fill:** `--color-selected-fill` token, `text-primary font-semibold` label. Never solid accent (accent = action, selection = state). Defined in `chipStyles.ts` `CHIP_ON`/`CHIP_OFF`. **Landmine:** `theme.css` defines `--color-selected` for an unrelated purpose; grep it before adding any new token.

## Dark-first design, photophobia-aware

Dark is default. `color-scheme: dark` globally. **Never use `dark:` prefixes.** Light palette via manual toggle in Profile (`data-theme="light"`); no `prefers-color-scheme` detection. Attack mode always overrides.

**Palette rules (see [`docs/palette.md`](docs/palette.md) for measured values):**
- No saturated blue. Accent is low-saturation sage. No `#fff`, `#000`, or max-contrast pairing.
- Four surfaces: `bg-base` (page) · `bg-surface` (card) · `bg-raised` (card on card) · `bg-elevated` (reserved, no current call site).
- Key tokens: `--color-bg-base` `#1b1a18` · `--color-text-primary` `#cdc7bb` (deliberately not dossier's `#e4dfd6`) · `--color-accent` `#7fa187` · severity `#8fb096` / `#c39257` / `#c68880`.
- **Check new severity colours against `bg-raised`**, not just the page.
- Three token values deliberately differ from the dossier's — don't "restore" them.
- No purple or blue, no drop shadows.

**Selected chips:** `ChipCheck` glyph (always rendered at `opacity-0` when unselected for stable width). `RadioDot` for pick-one rows (`role="radiogroup"`); `ChipCheck` for pick-any (`aria-pressed`). `.tap-44` for small controls with room; `.tap-44-y` for chips in rows. Both states use `ring`, never `border`.

**SVG/Recharts mirror tokens by hand** — theme-aware functions via `useUiTheme()`. Change a token → change these too: `headDiagram.ts`, `SeverityChart.tsx`, `SeverityBreakdown.tsx`, `HeadHeatmap.tsx`, `StatsView.tsx`, `AreaSeverityPicker.tsx`. Plus `Color.liddSeverity` in the widget extension.

**Type:** Lexend variable (400–700), self-hosted. Emphasis is `font-medium` (500); `font-bold` for headline numbers only. No light/thin weight. Body floor 16px, caption floor 14px (exception: stat tile labels at 12px). Text scale 87.5%–150%. `BottomNav` and `AttackModePill` cap their font sizes. Atkinson Hyperlegible Next is opt-in (`data-font="atkinson"`).

### Attack mode

`data-theme="attack"` on `<html>`, reachable from `AttackModePill` (44px icon-only button, `aria-label="Attack mode"` with `aria-pressed`). Overrides light/dark.

- Darker/warmer tokens: `--color-bg-base` `#14140f`, text `#c9c4b8`.
- Body text floor 20px. All animation cut (`prefers-reduced-motion` honoured for everyone).
- Dim floor 0.35 in `BrightnessOverlay`, **not** written to `hd_brightness`.
- Pill icon: arcs (not rays — sun = light/dark switch, moon = sleep). 24px, fills its box.
- Pill z-45 above scrim z-35. Hero is **not `isolate`**.
- `SunriseIcon` for "Woke up with this migraine" (not emoji — no full-colour glyphs).
- Reduced Today: drops month tiles and overuse paragraph; keeps warning line and last-dose row.

## The snapshot data model

```ts
interface Snapshot {
  time: string;                              // ISO timestamp
  areas: Record<string, number>;            // { 'Temple right': 7 }
  symptoms: string[];
  reliefs: string[];
  medication: { name: string; dose: string; amount?: number } | null;
  note: string | null;
  source: 'manual' | 'notification_yes' | 'notification_no_change';
}

interface Attack {
  id: number;           // Date.now() — notification timer key
  snapshots: Snapshot[];
  end: string | null;   // null = ongoing
  triggers: string[];
  notificationConfig: NotificationConfig;
  updatedAt?: string;   // last-write-wins key for sync
}
```

- `medication.amount`: units at intake, read only through `doseUnits`. Optional, nothing back-filled.
- `notification_no_change`: first-class source for plateau analytics (`longestPlateauMinutes`, `hasMedicationNonResponse`).
- **Stored snapshots are never rewritten.** `AttackDetail`'s timeline is the record of what was logged.

### localStorage keys

| Key | Type | Description |
|-----|------|-------------|
| `hd_attacks` | `Attack[]` | All attack records |
| `hd_triggers` / `hd_symptoms` / `hd_reliefs` | `string[]` | User's lists (seeded from defaults, add-only) |
| `hd_medications` | `{ items, guides, deleted, updatedAt }` | Medication library |
| `hd_hit6` | `{ items, updatedAt }` | HIT-6 questionnaires |
| `hd_notification_default` | `NotificationConfig` | Saved notification preference |
| `hd_text_scale` / `hd_theme` / `hd_attack_mode` / `hd_brightness` / `hd_font` | settings | UI preferences |
| `hd_attack_mode_auto` / `hd_system_text` | `boolean` | Auto attack mode / follow iPhone text size |

All reads/writes through hooks (`useAttacks`, `useUserPrefs`, `useMedications`, `useSettings`). **`RETIRED_ENTRIES`** (`src/utils/retired.ts`) is the only way to remove a junk entry — applied on every list path including post-union sync, and in stats aggregates. Stored snapshots are never rewritten. Export/import via `src/utils/backup.ts`.

## Cross-device sync (Supabase, optional)

`localStorage` authoritative for all reads. When signed in, every local write best-effort pushed to Supabase. Failure never blocks or rolls back. `SyncIndicator` surfaces errors.

- `supabase.ts` exports `null` if env unset (the flag every sync-aware hook checks).
- Email-only auth with OTP code fallback (iOS Safari opens magic links in Safari, not the PWA).
- Sync on mount **and** on `visibilitychange`/`focus` (iOS keeps backgrounded PWA alive in memory).
- Attacks: per-id `updatedAt` last-write-wins. Lists: plain union. Medications/HIT-6: whole-list last-write-wins.
- **New `Attack`/`Snapshot` fields pushed to Supabase need `alter table`** on existing tables.
- Pull-on-foreground, not realtime.

## Notification architecture

Two backends chosen at runtime: native (`@capacitor/local-notifications`) and web (service worker `setTimeout`).

**Key rules:**
- `onNotificationAction` carries no data — don't route payloads through it.
- `notifId()` folds `Date.now()` to 32-bit safe range.
- Register actions before first schedule. `sound` must name a real bundled file (`ios/App/App/reminder.wav` at bundle root) or the reminder is silent.
- Only "Something changed" sets `foreground: true`.
- Handler must update `cap_schedule` and write `nextAt` to `cap_extra`.
- Body text frozen at schedule time — use `formatTime`, never `formatElapsed`.
- Adaptive: +1h first, +2h subsequent. Dose brings reminder forward to dose + 2h (re-times existing, doesn't add second). 10-min catch-up for late doses within `FOLLOW_UP_MAX_MS`.

**Answering:** All answers queued in Swift (`pendingNotificationActions` in UserDefaults), drained by `consumePendingActions` on mount/foreground. Entry carries tap time (not "now"). Native handler schedules follow-up using `followUpMs` from `extra`. Web queues through same key. `addSnapshots` (plural) for batch drain. Skips ended/deleted attacks.

## Voice logging

Two entry points (Siri App Intent + Shortcut deep link), both landing in `App.tsx` → `LogForm` or `QuickUpdateForm`. Nothing auto-submits.

**Handoff:** Intent writes `CapacitorStorage.pendingVoiceEntry` to UserDefaults; `consumePendingVoiceEntry()` reads it. Key duplicated in Swift and TS. Web layer **waits** (`awaitPendingVoiceEntry`) rather than reading once. Three answers handed as JSON, stay separate — `started` parsed only by `parseStartOffset`.

**Intent rules:** Four required questions (optional = never prompted). Fourth is third asked twice. App Intents need iOS 16. `CFBundleDisplayName` and `CFBundleName` both "Lidd". `INAlternativeAppNames` max 3 (fourth = refuse to install). `voiceHandledRef` releases when sheet closes.

**Voice parse rules** (each exists because a real transcript broke):
- Needles < 4 chars: exact word match. Longer: 4-char prefix. Soundex for mis-transcribed areas (guarded: whole word 3+ chars AND number within 15 chars). Literally-claimed words never sound-matched.
- `AREA_SYNONYMS` matched before anatomical terms. Relief phrases blanked before area extraction (`maskPhrases`).
- Severity per area. `DEFAULT_SEVERITY` (5) tracked by `severityHeard`/`severityHeardFor`. Review screen must use `severityHeardFor`.
- Side-less mention selects both sides. "Nearest" biased forward.
- Start times checked after relative phrases. Bare hour refused. Every dose is its own reading. Meds match `recentMeds` first.

## Home-screen widget (WidgetKit)

`ios/App/LiddWidget/`. Key rules:

- Widget never reads the diary — `widgetSnapshot.ts` builds the payload; extension only draws.
- Uses `LiddWidgetPlugin` + App Group `group.com.sunny.migrainetracker2` (not `@capacitor/preferences`).
- Write + `reloadAllTimelines()` in one call.
- `LiddBridgeViewController` registers plugin with `registerPluginInstance` (not Type). `Main.storyboard` must point to this subclass.
- `useWidgetSnapshot` watches data, not writers. Publish on `hidden` is load-bearing.
- `LiddWidgetShared.swift` compiled into both targets (shared contract).
- Payload v2: `series` array. `LiddWidgetShared.supportedVersion` must match `WIDGET_SNAPSHOT_VERSION`.
- Lexend as 3 static instances (400/500/600) via fontTools instancer. Registered through `UIAppFonts`.
- `App.xcscheme` checked in under `xcshareddata/xcschemes`. Run `App` scheme, never `LiddWidget`.
- No monthly figures on widget (§9.2). Content top-left anchored, mark bottom-right in every state. `prominent` for lone figures only (ongoing never qualifies). Palette mirrored by hand.
- Timeline entries at wording-change moments. Views must never read the clock — use `entryDate`.
- "No change" button was built and removed — notification handles this better.

## Insights — clinical metrics

Period control in top bar (`SegmentedControl`, labels `7d / 30d / 3m / All`). Every section answers the period. Default 30 days.

- Header collapses: `h1` + control at top → control alone when scrolled (via `useScrolledFromTop`). Period control inside header, not sticky on its own.
- `InsightSection`: heading + content + note (note below content). Inner surface only when note exists (outline, not fill).
- Blocks 32px apart. Section card padding `p-card`. Stat tile labels 12px (sole exception to 14px floor).
- Order: period control → stat tiles → monthly sections → rest.
- `MigraineDaysChart`: counts days not attacks (`attackDayKeys`). 15-day ICHD line. Period narrows months shown, never the counting. Under 7d draws week strip (dots, not cells). Month in progress named in caption.
- `MedicationInsights`: days + response in same window (`medicationDaysInWindow`). Filtered on snapshot time. Overuse gated on `monthScale` (7/30 only). `guideForName` is the only threshold source. Response: severity halved or ≤3 at dose + 2h. Unmeasured doses shown not hidden. Wording never concludes — supportive, not diagnostic.
- Logs filter: `LogsFilterPanel.tsx` + `logFilters.ts`. Pain-area filter is now a Side filter. Logs open on all time.

## Settings tab (internally `profile`)

Labelled "Settings" with gear. Six rows in two groups → sub-pages via `ProfileSubPage` (owns top bar + scroll). **Sub-pages are drill-downs** (enter from right, back chevron) — not modals. Sheets live in `App.tsx`, not `ProfileView`.

### HIT-6

Six questions, scored 36–78. One per screen, no auto-advance. Prompts on Today when due; "Not now" writes `hd_hit6_dismissed` (durable, own key, not synced). Not shown in attack mode. Entries can't be edited (deleting offered instead). Scored values stored. Five responses not evenly spaced (6/8/10/11/13). Sync: whole-list last-write-wins, own columns. Licensed instrument — public release needs permission.

## Medications

`Medication` type in `src/types/index.ts`. Four flows from Settings → My medications: Overview, Monthly guides, Add (`AddMedicationWizard`), Edit (`EditMedicationForm`).

**Core rules:**
- `dose` is derived, never typed. Nothing may assume `strength`/`quantity` exist.
- Form and unit are fixed choices. Leaflet limits never pre-filled.
- Type: `T` triptan, `C` combination, `P` painkiller, `G` gepant, `?` not sure. Gepant has no guideline.
- A write is one write (`updateMedications` applies several edits under one stamp). Exact twins refused at write time.
- Remove deletes entry only, never snapshots. `deleted` list keeps name out of chips/warnings while no entry has it.
- Preventive: no longer offered in UI. `kind` kept in data.
- `recentMeds`: library-acute-first, then history. Passed to `parseVoiceEntry`.
- Merge: whole-list last-write-wins (not union like trigger/symptom/relief lists).
- Keyboard: `useKeyboardFlow` sets plugin to `'none'`, always restores `'native'`. Never `scrollIntoView` — lifts own footer.

### Guardrails

`src/utils/medGuardrails.ts` — `doseUnits` / `unitsInWindow` / `lastDoseAt` / `checkDose` / `guideFor` / `guideForName`.

- Numbers come from user. Never infer, never block save, never phrase as instruction.
- `doseUnits` fallback parse deliberately narrow — unrecognised = 1. Don't widen.
- `guideFor` is the only overuse threshold source: stored guide else ICHD (10 triptan/combination, 15 simple). 70% warning on Today.
- Clock read inside the util, not by caller. Wizard last-entry caption computes its own gap (not through `checkDose`).
- Counts come only from doses logged inside an attack.

## App shell

`App.tsx` owns sheet/modal state and routes notifications. Four tabs (Today/Logs/Insights/Settings), no router. **Nav at capacity** — new destinations go inside a tab. Lucide paths at stroke 1.8: `calendar`, `list`, `line-chart`, `settings`. FAB (58px) in the bar.

- Today renders no `TopBar` while hero is on screen. First-run title is "Hello".
- `TopBar` has no bottom border. Tab titles 34px in `rem`. `TopBar` **must stay inside the scroll div**.
- Bottom clearance: `calc(7rem + env(safe-area-inset-bottom))`.
- Header padding: `calc(2rem + env(safe-area-inset-top))`.

### Viewport architecture

**Don't revert to `position: fixed`.**

Root: `position: relative`, `height: var(--app-height, 100dvh)`, `translateY(var(--app-offset, 0px))`, `overflow-hidden`. Everything floating is `position: absolute` against the root. Scrolling in nested `h-full overflow-y-auto` div. `html`/`body`: `overflow: hidden; height: 100%`.

Invariants: `--app-height` tracks real viewport (trusts `window.screen` on cold PWA relaunch). `--app-offset` pins shell when keyboard is up (both height and offset required). **Never `position: fixed`** for shell-anchored elements. Root transform is plain `translateY` (not `will-change: transform`).

### iOS form-field quirks

- Focus zoom: viewport meta has `maximum-scale=1, user-scalable=no` (only Capacitor WebView honours these).
- Date/time inputs: `appearance: none` in `index.css` drops native sizing.

### FAB menu

`FabMenu` in `BottomNav`, WAI-ARIA menu-button. No ongoing: Log an attack / Add a past attack. Ongoing: Add an update / End attack. Accessible name: "Log or update an attack". The ongoing/not-ongoing split prevents concurrent ongoing attacks.

### Today below the hero

Every block is borderless 20px `TODAY_CARD`, 14px apart, **last 30 days** (never "this month"). Order: impact question → week card (2+ attacks in 7d) → 2h check-in → dose card → overuse banners (at 70%) → days and attacks tiles. Attack mode keeps reduced branch + check-in.

Attack-free: `AttackFreeCard` with greeting + "X days / since your last attack". No "attack-free for" (reads as score). `greeting()` reads clock inside util. `useNowTick` for all live durations — never bare `setInterval` (iOS suspends background timers).

### Today hero cards

`HomeCard` — full-bleed hero, drawn artwork (`heroArt.tsx`). Rules:

- Gradients from `bg-bg-base` to `bg-bg-base/0` (never `transparent`). Horizontal stop past image's left edge (40% for 36% image start).
- Art box 40px + inset below top. Text centred against artwork, `max-w-[64%]`.
- Ongoing: Add update + End attack (`btn-secondary btn-compact`). Neither promoted to primary.
- Attack mode button top-left z-45. Hero not `isolate`.
- Headline 44px semibold. Ongoing = elapsed time + trajectory + severity text (never colour-coded on illustration).

### Sheet

`Sheet.tsx`: full-screen, `flush` / `bareHeader` modes. Topmost open sheet makes everything behind it `inert`/`aria-hidden` (`syncModal` — DOM order, not open order). `data-modal-exempt` for toast. Focus moves in on open, back to opener on close (`recentPress`).

## Logs list

Row: **duration** headline + **peak** (shaded via `peakShade`) + **side** head glyph + day/start time + drug type badges with `VerdictMark` (✓/–/?) + ICHD symptom icons. Date headers by date sort. No triggers on card (triggers are speculative, §4).

- Average is **time-weighted** (`attackAvgSeverity`). Location is a **side** (`attackSide` in `laterality.ts`), never a zone list. `null` = no laterality data (sideless zones or pre-rename keys).
- Impact renders only when answered (`undefined` not 0).
- Severity colour from shared ramp in `src/utils/severity.ts` (`sevTextClass`/`sevBadgeClass`). **All call sites must agree** — import, never copy.
- Sparkline: y-domain pinned 0–10, colour from `sevFill` at peak.

## Severity breakdown (`SeverityBreakdown.tsx`)

One row per area: name, sparkline, peak, now. Rows sorted by peak descending. Missing = short rule (not dot). Dashed spans never coloured. `SideGlyph` from head SVG. All `aria-hidden`.

## Attack detail (`AttackDetail.tsx`)

Drill-down (enter from right, back chevron). Tiles for duration/peak/side, span, pain-over-time chart, drug cards with timing + outcome, where-it-hurt areas, symptom tiles, last 3 updates, impact/triggers/woke-with.

- Footer: ongoing = End + Update; ended = Edit + Update. "Add update" offered on past attacks too.
- **Edit is metadata-only** (`updateAttackDetails`): `wokeWithMigraine`, `end`, `triggers`. **`impact` excluded** — asked once within 24h via `ImpactPrompt` on Today (`attackAwaitingImpact`), session-only dismissal. `setImpact` for already-ended attacks, must remove key to clear (never write 0).
- `ConfirmDialog` for delete. `EndAttackDialog` reused (Just now / Earlier presets, minute-precision clamping).

## Pain areas

20 zones in `PAIN_AREAS` (`useUserPrefs.ts`). **Zone-name strings must stay stable** (rename orphans stored data). Front mirrored (11 zones), back not mirrored (9). Shared viewBox 332×513, aligned on crown.

- Disabled = texture (hatch + recess fill), not just tone. Paint order: disabled ground → selectable body → dividers → selected fills → details.
- Dividers = `zones.map(z => z.path)`. Selected fill stroke 3 to cover dashes. `DIVIDER_COLOR` 3.15:1 (WCAG 1.4.11).
- Features quietest → inert → silhouette → dividers → fills (loudest).
- Focused zone outline: `sevStroke(severity)`, never accent.
- Front/Back labels via `SideLabel` (equal-width grid cell).

## Log-attack flow (`LogForm.tsx`)

5 steps: **When → Pain areas → Medication → Anything else (symptoms + reliefs) → Triggers**. `Sheet flush bareHeader`. Pain areas required. "Finish now" from step 1 (disabled until area selected).

- Voice draft opens step 0 (review screen). Finish-now disabled when severity was invented.
- Dose-time card: Just now / 30m ago / 1h ago / When it started / Pick a time. Dose outside [start, end-or-now] not offered. Non-start dose creates its own reading.
- Past attacks get "about 2 hours after?" question (optional severity at dose + 2h).
- "Woke up with it" is a flag, not a start time. Review shows "Woke up with it" with note.

## Quick-update flow (`QuickUpdateForm.tsx`)

4 steps: **Update time → Pain areas → Medication → Anything else**. Opens straight to wizard. Fields start blank (not pre-filled from previous snapshot). Update time defaults to sheet-open moment.

- Blank form → confirm dialog → saves previous severities as `notification_no_change` (not an empty reading).
- Pain areas required. No triggers (attack-level metadata only).
- For past attacks too (backfilling). `addSnapshot` skips reminder scheduling when attack has `end`.

## Shared components

- **`ChipSelector`**: pill toggles with "Add custom…". States from `chipStyles.ts`.
- **`MedicationInput`**: chip row first (from `recentMeds`), free-text behind ghost button. Quantity quick-pick outside collapsible. Radio groups with `RadioDot`. Dose-time card in new-attack wizard only.
- **`DateTimeField`**: two fields (time + combined date-time). Native `UIDatePicker` plugin on iOS (`LiddDatePickerPlugin`). Time bounds day-scoped. Auto-open opens time half.
- **`NotificationSettings`**: real toggle switch (`role="switch"`). `BellIcon`, not emoji.
- **`SnapshotRow`**: card on continuous rail. Timestamp knocks gap in line (bg matches parent surface). Pain areas first, sections named and separated by hairlines. `no_change` renders as "No change" (severities carried forward but not repeated; symptoms/reliefs not carried forward).
- **Icons** (`drawnIcons.tsx`): `svg()` helper 24×24, `currentColor` stroke 1.5. Med forms at 1.75. **No emoji ever.** Lucide for UI affordances; hand-drawn for domain marks. Triggers have icons too. `MedIcon` shared by all readers. `MedIcon` call sites at `h-4`.
- **`InlineNote`/`Toast`/`ValueSheet`**: medication flows' shared parts. Toast z-60, 5s minimum.

## Decision log → `docs/decisions.md`

The canonical record of why each rule exists and what was tried. Read before undoing anything.
