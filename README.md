# Lidd

A migraine diary built around the idea that an attack is a *thing that changes over time*, not a single row in a table. You log it once when it starts, then add readings as it evolves — and the app reminds you to, so the timeline doesn't end up with one entry and a guess.

It ships as one codebase to two targets: an installable PWA, and a native iOS app (Capacitor) that exists for the two things a PWA structurally can't do — reminders that survive a force-quit, and a real Siri App Intent.

## What it does

**Log an attack** — a step-at-a-time wizard: when it started, where it hurts, medication, relief methods, symptoms, triggers, a note, and reminder settings. Only the pain areas are required; once you've marked one, a **Finish now** link appears so you can save and skip the rest. That's deliberate — during an actual migraine, tapping through six more screens is not going to happen.

**Pain areas** — 17 zones on a front and back head diagram, each with its own 1–10 severity. There's no single global severity field; a zone's fill colour reflects its own score.

**Track how it changes** — reminders (adaptive: +1h after the first reading, +2h after each one after that) prompt you for an update. Answer **Nothing changed** and it records a `no_change` reading, which is a real data point, not a skipped one — the stats treat it as "severity held" and use it for plateau and medication-non-response analysis. Past attacks can be backfilled with updates too, so a retrospective log isn't stuck at one reading.

**Voice** — "Hey Siri, log a migraine" (native App Intent), or a Shortcut deep link on the PWA. Both hand the transcript to the same handler, which parses what it can and opens the wizard prefilled with a banner showing exactly what it recognised. Nothing auto-submits, and the raw transcript is always kept verbatim as the note.

**Insights** — filtered by 7 days / 30 days / 3 months / all: attack count, average max severity, attack and pain-free streaks, average time to peak, average time spent at severity ≥5, a severity trend line, a pain-area frequency heatmap on the same head diagrams, and frequency breakdowns for triggers, symptoms, reliefs and medications.

**Built for a migraine, not for a demo** — the app is dark at all times, has a screen-brightness dimmer and a text-size control reachable from anywhere, and everything is one-handed and thumb-reachable.

**Your data stays yours** — `localStorage` is the source of truth, so it works offline and starts empty. Export/import a JSON backup with no account at all, or sign in by email for optional cross-device sync via Supabase.

## Running it

`npm` isn't on the default PATH here — source nvm first:

```bash
source ~/.nvm/nvm.sh && npm install
```

```bash
source ~/.nvm/nvm.sh && npm run dev
```

That serves the app at `localhost:5173`. `npm run build` runs the TypeScript compile plus the Vite production build, `npm run lint` runs ESLint, `npm run preview` serves the built `dist/`.

There are no tests; type-checking runs as part of `build`.

### On a phone

```bash
source ~/.nvm/nvm.sh && npm run dev -- --host
```

Then open `http://<mac-hostname>.local:5173` — use the mDNS hostname (`scutil --get LocalHostName`), not the LAN IP, since DHCP can reassign the IP and a PWA added to the home screen at an IP silently breaks the next time it does.

### Native iOS

`ios/` is a real Xcode project that loads the Vite build in a `WKWebView`. Capacitor copies `dist/`, it does not build it, so build first:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npx cap sync ios
```

Then open `ios/App/App.xcworkspace` in Xcode and run. Free provisioning is enough for everything worth testing on device — local notifications need no entitlement, only remote push does.

### Optional: cross-device sync

Copy `.env.local.example` to `.env.local` and fill in a Supabase project's URL and anon key, then run `supabase/schema.sql` once in that project's SQL editor. Without those env vars the Supabase client is `null` and the app runs local-only — which is the default for a fresh clone, and a fully supported way to use it.

Sign-in is email-only, no passwords: a magic link, or a typed 6-digit code (which exists because iOS Safari always opens Mail links in Safari, never in an installed home-screen PWA).

## How it's built

Vite 8 · React 19 · TypeScript (strict) · Tailwind CSS v4 · Recharts · Capacitor 8 · Supabase.

No router and no state library — `App.tsx` owns the sheet/modal state and switches between four tabs, and every read and write goes through three hooks (`useAttacks`, `useUserPrefs`, `useSettings`).

The core type is worth seeing, because everything else follows from it:

```ts
interface Attack {
  id: number;           // Date.now() — also the notification timer key
  snapshots: Snapshot[];
  end: string | null;   // null means ongoing
  triggers: string[];
  notificationConfig: NotificationConfig;
}

interface Snapshot {
  time: string;                    // ISO timestamp
  areas: Record<string, number>;   // { 'Right temple': 7, 'Left eye': 4 }
  symptoms: string[];
  reliefs: string[];
  medication: { name: string; dose: string } | null;
  note: string | null;
  source: 'manual' | 'notification_yes' | 'notification_no_change';
}
```

An attack is an ordered array of snapshots, each the complete state at a point in time. Each one represents state held until the *next* one's timestamp.

**[CLAUDE.md](CLAUDE.md) is the real architecture document** — the snapshot model, the notification backends, the iOS viewport work, and a decision log recording what was tried and rejected. Read it before changing anything in `src/`; several things in there look arbitrary and are load-bearing.
