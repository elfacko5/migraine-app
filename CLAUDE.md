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
| `hd_notification_default` | `NotificationConfig` | Saved notification preference |

All reads/writes go through the hooks (`useAttacks`, `useUserPrefs`) — no direct `localStorage` calls elsewhere.

## Notification architecture

Notifications are scheduled entirely client-side via `postMessage` to the service worker (`public/sw.js`). The SW keeps a `Map<attackId, timerId>` of pending `setTimeout` calls. This works while the browser is open but does not survive a browser restart.

Flow: `startAttack` / `addSnapshot` → `scheduleNotification()` posts `SCHEDULE_NOTIFICATION` to SW → SW fires `showNotification` after delay → user taps action button → SW posts `NOTIFICATION_ACTION` back to the page → `App.tsx` message handler calls `addSnapshot(..., 'notification_no_change')` or opens the update sheet.

Adaptive schedule: +1h after first snapshot, +2h after any subsequent snapshot. Notifications are not scheduled if `attack.end` is already set (retrospective logs).

## App shell

`App.tsx` owns all sheet/modal open state and routes SW messages. Three tabs (Log, History, Stats) rendered conditionally in one `div` — no router. The central FAB in `BottomNav` always opens the log sheet regardless of active tab.

`Sheet.tsx` is the reusable full-screen bottom sheet: backdrop click + Escape key close, body scroll lock, children only mounted when open.

## Pain areas

The canonical list lives in `src/hooks/useUserPrefs.ts` as `PAIN_AREAS`. Each area gets an individual severity slider (1–10) in `AreaSeverityPicker` — there is no single global severity field. `maxSeverity(snapshot)` in `stats.ts` returns `Math.max(...Object.values(snapshot.areas))` as the effective severity for a snapshot.
