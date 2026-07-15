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

To test on a phone on the same Wi-Fi, expose the dev server on the LAN with `npm run dev -- --host`, then open `http://<mac-LAN-ip>:5173` (the `.claude/launch.json` preview config already passes `--host`). HMR doesn't reliably push over Wi-Fi — reload the phone manually after changes. Each device has its own `localStorage`, so data does not sync between desktop and phone.

## Stack

Vite 8 + React 19 + TypeScript (strict) + Tailwind CSS v4 + Recharts. No backend, no auth — all data lives in `localStorage`. PWA via `public/manifest.json` + `public/sw.js`.

**Tailwind v4 note:** configured through the `@tailwindcss/vite` plugin — there is no `tailwind.config.js`. Custom theme tokens go in `src/index.css` under `@theme {}`.

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

**Export / import:** there is no backend or sync. `src/utils/backup.ts` serialises every `hd_` key to a JSON file (Settings → Data → **Export backup**) and restores it (**Import backup** → confirm → reload) — the only cross-device path.

## Notification architecture

Notifications are scheduled entirely client-side via `postMessage` to the service worker (`public/sw.js`). The SW keeps a `Map<attackId, timerId>` of pending `setTimeout` calls. This works while the browser is open but does not survive a browser restart.

Flow: `startAttack` / `addSnapshot` → `scheduleNotification()` posts `SCHEDULE_NOTIFICATION` to SW → SW fires `showNotification` after delay → user taps action button → SW posts `NOTIFICATION_ACTION` back to the page → `App.tsx` message handler calls `addSnapshot(..., 'notification_no_change')` or opens the update sheet.

Adaptive schedule: +1h after first snapshot, +2h after any subsequent snapshot. Notifications are not scheduled if `attack.end` is already set (retrospective logs).

## App shell

`App.tsx` owns all sheet/modal open state and routes SW messages. Four tabs — Today (`log`), Logs (`history`), Insights (`stats`), Settings — rendered conditionally in one `div`, no router. `TopBar` is a sticky per-tab title bar; `BottomNav` is the fixed bottom bar. Both pad for the iOS safe-area insets (`env(safe-area-inset-*)`), needed because the PWA uses `viewport-fit=cover` + a translucent status bar.

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

## Log-attack flow (`LogForm.tsx`)

A single-step-at-a-time wizard, own top app bar (close / step count / **Finish now**), rendered via `Sheet`'s `flush bareHeader` mode. Steps, in order: **When** → **Pain areas** → **Medication** → **Relief methods** → **Symptoms** → **Triggers** → **Note** → **Reminders** (Reminders only shown when the attack is still ongoing — `totalSteps` is 8 or 7). Each non-time step's section header is an `<h2>` title + a sentence-case instruction line, with the text-size stepper (`TextScaleControl`) pinned to its right — no per-step progress bar, no all-caps step labels.

Pain areas is the only required step (`nextDisabled` / the red `*`). Every step after it is optional enrichment, so once at least one area is selected, a **"Finish now"** link appears in the top-right of the app bar (replacing the step counter there) letting the user save and skip the rest — it disappears again on the final step, where the primary button already reads "Log attack". This exists because migraine sufferers often want to log only the pain and stop (e.g. deliberately not logging medication because they're trying to avoid taking it).

Symptoms, Triggers, and Relief methods all use the same `ChipSelector` (pill toggles) for consistency — do not reintroduce `ListSelector` (checkbox rows); it was deleted because having reliefs on pills and symptoms/triggers on checkboxes read as inconsistent.

## Quick-update flow (`QuickUpdateForm.tsx`)

Opened via the FAB when an attack is ongoing, or via "Add update" on `OngoingAttackBanner`. Two phases:

1. **Choice screen** (`step === 0`) — shows the same context as the Logs detail view (header with date/ongoing/max-severity/triggers, `SeverityChart` once there are 2+ snapshots, and the full `SnapshotRow` timeline) so the user has enough information to confidently choose **Nothing changed — log no change** vs **Log what changed**. This is deliberately NOT shown during the wizard steps below (see next point) — it only needs to exist once, up front.
2. **Wizard** (steps 1–6: Update time → Pain areas → Medication → Relief methods → Symptoms → Note) — every field starts **blank**, never pre-filled from the previous snapshot, because an update is a new reading, not an edit of the last one. Instead, each step shows a small non-interactive caption below its picker referencing the last entry (e.g. *"At last entry (20:36), pain was severity 8 — Forehead 8, Temple left 6"*, *"Took Sumatriptan 1 tablet at 20:36 (last entry)"*) — only rendered when the last snapshot actually had something for that field. Same "Finish now" pattern as `LogForm` (available from step 1 onward since nothing here is required).

## Shared step-content components

- **`ChipSelector`** — pill multi-select with inline "Add custom…" (reliefs, symptoms, triggers everywhere).
- **`MedicationInput`** — name + dose text inputs, a quantity quick-pick (`1/2/3 tablets`), and a **"Previously used"** chip row *below* the inputs sourced from `recentMeds` (built in `App.tsx` by scanning all attacks' snapshots for medication, most-recently-used first, deduped by name) — tapping a chip fills both name and dose in one action. This is deliberately below the inputs, not above, since a returning user's own meds are the primary path and typing is the fallback.
- **`NotificationSettings`** — the enable control is a real toggle switch (`role="switch"`, sliding thumb), not a checkbox, and is always rendered expanded (no accordion) since it only ever appears on its own dedicated wizard step now. If you touch the toggle's markup: the thumb needs an explicit `left-0.5` (a `<button>`'s default UA `text-align: center` skews the "static position" fallback an absolutely-positioned child with no explicit `left` would otherwise get), the track needs `overflow-hidden` (a `rounded-full` container does not clip an absolutely-positioned child to its curved corners on its own), and the "on" translate distance must leave the same 2px inset as the other three sides (`translate-x-5`, not a value calibrated for a `left-0` base).
- **`openPicker`** (`src/utils/openPicker.ts`) — shared helper that calls `showPicker()` on a `datetime-local` input (falling back to `.focus()`), used by `LogForm`'s start/end time "Other" option and `EndAttackDialog`'s "Earlier" option so the native picker opens on the same tap that reveals the field.
