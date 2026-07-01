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

`App.tsx` owns all sheet/modal open state and routes SW messages. Four tabs — Today (`log`), Logs (`history`), Insights (`stats`), Settings — rendered conditionally in one `div`, no router. `TopBar` is a sticky per-tab title bar; `BottomNav` is the fixed bottom bar whose central FAB always opens the log sheet. Both pad for the iOS safe-area insets (`env(safe-area-inset-*)`), needed because the PWA uses `viewport-fit=cover` + a translucent status bar.

When no attack is ongoing, the Today tab shows `AttackFreeCard` (time since the most recent attack `end`, ticking each minute) or a "no attacks yet" prompt.

`Sheet.tsx` is the reusable full-screen bottom sheet (backdrop/Escape close, body scroll lock, children mounted only when open). `ConfirmDialog.tsx` is the in-app confirm/alert modal that replaces native `confirm()` (End attack, Delete attack, Import backup) — it deliberately does **not** lock body scroll so it can stack on top of a `Sheet` without leaving the page unscrollable.

## Pain areas

The canonical list lives in `src/hooks/useUserPrefs.ts` as `PAIN_AREAS` (17 zones). There is no single global severity field — `snapshot.areas` maps each selected zone name to its severity (1–10), and `maxSeverity(snapshot)` in `stats.ts` returns `Math.max(...Object.values(snapshot.areas))` as the effective severity.

The picker (`AreaSeverityPicker`) and the stats heatmap (`HeadHeatmap`) share geometry from `src/components/headDiagram.ts`, which **inlines the user's exported SVG artwork** (`Face front - 1.svg`, `Head back - 1.svg`, in the repo root) as two `DiagramView` configs in the `VIEWS` array. Each view holds a closed `path` per selectable zone plus `disabled` regions (the front jaw + neck, filled `#7d8599`, non-selectable) and a `details` stroke (the lips). Selected zones fill with the accent `#5a9e7a`.

- **Front (mirrored — screen-left = subject's right), 11 zones:** `Forehead/Temple/Eye/Cheek/Jaw left+right` + `Nose`.
- **Back (not mirrored — screen-left = subject's left), 6 zones:** `Crown/Occiput/Nape left+right`.

A Front/Back toggle switches views (each shows a per-view selected count). Tapping a zone selects + focuses it; a **single** severity slider follows the focused zone (tapping the focused zone again deselects it). Each selected zone shows its score as a badge on the diagram.

Renaming zones or editing `PAIN_AREAS` strands existing `snapshot.areas` data (which stores the exact strings) — keep the zone-name strings stable. If the user re-exports SVGs, re-inline the path data into the matching `DiagramView`.
