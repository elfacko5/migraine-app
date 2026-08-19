---
name: lidd-ui
description: Build or change any user-facing UI in the Lidd migraine app — a screen, card, button, chip, sheet, icon, form step, or user-facing string. Use BEFORE writing the component, not after. It supplies the established patterns (button sizes, chip states, sheet types, surfaces, icons, copy register) so a new piece of UI matches what already ships instead of inventing a parallel one.
---

# Building UI in this app

This app has settled patterns for almost everything. **Most "new" UI is an
existing pattern applied again.** The failure this skill exists to prevent is
not ugly code — it is a new screen that quietly looks like a different app,
which then costs a review round to spot and a second round to fix.

Every rule below was paid for that way. Read the checklist, then read the
matching section of `CLAUDE.md` for anything you are about to touch.

## Before writing the component

Do these three things first. They take a minute and they are the whole point.

1. **Find the nearest existing thing and read it.** Not something similar in
   spirit — the closest actual component. A card on Today → read
   `OngoingAttackBanner`. A sub-page → read an existing `ProfileSubPage`
   caller. A multi-step flow → read `LogForm`. Copy its structure and class
   choices rather than re-deriving them.
2. **Grep for the primitive before hand-rolling one.** `btn-`, `chipClass`,
   `Sheet`, `ProfileSubPage`, `ConfirmDialog`, `InsightSection`, `HomeCard`,
   `MedIcon`, `sevFill`. If a shared thing exists, a local copy of it is a bug
   in waiting — the severity thresholds and the impact labels both had to be
   rescued from exactly that.
3. **Ask what surface it sits on.** `bg-base` (page) → `bg-surface` (card) →
   `bg-raised` (card on card) → `bg-elevated`. Picking the wrong one is the
   most common reason a new block looks bolted on.

## The patterns most often got wrong

**Buttons.** `.btn-primary` / `.btn-secondary` / `.btn-tertiary` carry their
own radius, padding, type and disabled state — a bare `btn-primary` is
correct. Two sizes, and choosing is explicit:

- an action **inside a card** → `btn-primary btn-compact`, hugging its text in
  a `flex flex-wrap gap-2` row
- a **pinned footer** or a panel's single bottom action → the default, `w-full`

Never `disabled:opacity-40` — the disabled treatment is built in. Never a
`border` for an outline; use a ring (`box-shadow`), or a secondary button
renders 2px taller than the primary beside it.

**Selected states are a tint, never the solid accent.** `chipClass` /
`CHIP_ON` / `CHIP_OFF` from `utils/chipStyles.ts`. Solid accent means *action*
(`btn-primary`, the FAB). Both states carry a ring, never a border.

**Sheets come in two kinds, and the pair must agree.** A drill-down enters
from the right with a **back chevron** (`ProfileSubPage`). Something that
interrupts you enters from the bottom with a **close X** (`AttackDetail`, the
wizards). A right-entering sheet with an X says two things at once.

**Actions that matter are pinned, not scrolled.** `ProfileSubPage` takes a
`footer`; the wizards and `AttackDetail` flex-pin their own. A primary action
below the fold is one the user has to go looking for.

**Icons are drawn and inherit `currentColor`** — `drawnIcons.tsx` (authored in
code) or `icons.tsx` (inlined from `/icons`). **Never an emoji**: it can't
inherit colour, so it becomes the brightest thing on a screen built to be easy
on the eyes.

Need a new one?

- **Generic UI affordance** (chevron, close, calendar, search) → inline the
  path from **Lucide**. It is the same contract as the `svg()` helper — 24×24,
  `fill="none"`, `stroke="currentColor"`, round caps — so it drops in
  unchanged. Never a webfont or CDN.
- **Domain mark** (symptom, relief, medication form) → draw it, schematic, no
  interior detail. **Health Icons was tested and rejected for these**
  (2026-08-19): great artwork, CC0, exactly the right vocabulary, but they are
  48-grid filled illustrations that turn into smudges at the 14–16px these
  render at. The existing domain sets are already complete.

**Anything showing a live duration uses `useNowTick`**, never a bare
`setInterval` — iOS suspends timers in a backgrounded webview.

**Nothing is `position: fixed`.** Floating things are `absolute` against the
app root. See `docs/viewport-architecture.md` before touching shell layout.

## Copy

Read §9 of `research/migraine-app-research-dossier.md` before writing any
user-facing string. The register is calm, plain, matter-of-fact, validating.

- **No streaks, badges or congratulation.** Reward the logging habit, never
  the health outcome.
- **Never imply fault** — no "you forgot", "you missed", "you haven't logged".
- **State the number and the guideline, then stop.** Never conclude, never
  read as dosing advice.
- **One clause, a question rather than an instruction, the words someone would
  say out loud.** "Tap where it hurts", not "Select all affected areas".

## Verifying

`npm run typecheck` and `npm run lint` must both be clean — they are the only
gates; there are no tests, and `build` does not type-check.

Then look at it, at **375px**, and — this is the part that gets skipped —
**with its neighbours in frame**. Verifying that the CSS you changed resolves
correctly is not the same as verifying the screen looks right; a card can be
internally perfect and still not match the card above it. Measure with
`getBoundingClientRect` when comparing two things that should match.

**Never seed data on `localhost:5174` without checking `location.origin` and
that no `sb-` key exists in the same call.** That origin is sync-aware: if it
holds a Supabase session, seeded test data reaches the real diary. It has
happened twice.
