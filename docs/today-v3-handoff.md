# Today screen v3: build spec

Source: the Lidd v3 canvas in Claude Design (rows v3.3 and v3.4, hero B "trajectory"). This file is the whole spec. Claude Code can't open the canvas, so everything needed is written here.

**This is a new UI, not only new behaviour.** Today should end up looking like the prototype: its layout, type sizes, card shapes, badges and spacing, as written in the "Visual spec" section below. Where the current Today styling and the visual spec disagree, the visual spec wins. Extend the existing components (`HomeCard`, `OngoingAttackBanner`, `AttackFreeCard`, `TodaySummary`) rather than writing parallel ones, but restyle them. The prototype's colours already match `src/index.css` (dark bg #1b1a18, light bg #f5f2ec, accent #7fa187), so map by token, never by pasting hex.

Sizes below are in px at the default text size. Write them in rem (px ÷ 16) so the app's text-size setting scales them, the same way existing type does.

## Before writing code

1. Invoke the `lidd-ui` skill.
2. Read `docs/today-cards.md` (you will be changing several of its calls), `docs/palette.md`, and dossier §8 and §9.
3. Gates after every section: `npm run typecheck` and `npm run lint` both report zero.
4. Check things on the scratch origin, signed out (see CLAUDE.md).
5. When done, update `docs/today-cards.md` to match and add a dated entry to `docs/decisions.md` saying what changed and why (reasons are given in each section below).

## Visual spec (applies to every section below)

Prototype token to app token: `--bg` = bg-base, `--sf` = bg-surface, `--sf2` = bg-raised, `--bd` = bg-border, `--tx` = text-primary, `--mu` = text-secondary, `--ac` = accent, `--warn` = severity-mid, `--acsoft`/`--acline` = the `CHIP_ON` tint and ring.

**Page.** 16px side padding, 14px vertical gap between everything below the hero. Font Lexend (already the app font).

**Cards on Today.** `bg-surface`, 20px radius, 16px padding, 10px internal gap, **no border and no ring.** This replaces the current `rounded-xl bg-bg-raised/60 border` treatment on Today's tiles and medication rows. Only Today changes. Insights keeps its own tiles for now (see "Decisions to confirm").

**Hero.**
- Bleeds full width (as now), min-height 320px, content vertically centred.
- Art box starts 40px below the hero's top edge (plus the safe-area inset), right-aligned, 64% wide.
- Text block: max-width 64%, padding 110px top (clears the attack mode button), 24px sides, 24px bottom.
- Kicker (greeting or "Ongoing attack"): 16px, weight 500, text-secondary, 4px below it.
- Headline: 44px, weight 600, line-height 1.05, `whitespace-nowrap`.
- Detail line: 17px, text-primary, 16px above it (8px when it follows the sparkline).
- Action row: 24px above it.

**Attack mode button.** A pill: min-height 44px, 22px radius, 14px horizontal padding, `bg-surface` with a 1px `bg-border` ring, 15px weight 500, 8px gap, moon icon 18px stroke 1.8. This is the off state. For the on state reuse whatever pressed treatment `AttackModePill` uses now (attack mode's look is out of scope).

**Letter badge (T / C / P).** 30px square, 10px radius, `bg-base` fill, 1.5px accent ring, letter 14px bold. In the ongoing medication card it is 36px with a 16px letter.

**Number tile.** Figure 34px weight 600, line-height 1.1. Under it, one line at 14px text-secondary: "migraine days · last 30 days". No uppercase label.

**Bar.** Track 8px high, 4px radius, `bg-raised`. Fill accent, same radius. Warning: fill severity-mid plus a 16px warning triangle before the figure.

**Warning banner.** Severity-mid tint background, 14px radius, 12px padding, 10px gap, 15px text. Triangle icon 24px in severity-mid, stroke 2, top-aligned. First sentence bold.

**Small status line** (e.g. "At 2 hours: pain 3"). 15px text-secondary, 20px icon, 8px gap, 4px side inset, no card.

**Icons.** Lucide-style, stroke `currentColor`, 1.8 width, round caps (the app's existing contract).

## Out of scope. Do not change

- **What attack mode looks like or does once it's on.** That is being redesigned separately. Leave the attack theme, `TodaySummary`'s `attackMode` branch, `BrightnessOverlay` and the toggle's state logic alone. Only the button's position changes (section 4).
- A "headache days" tile. The prototype has one, but the app has no headache-day record, so there is nothing to count.
- The post-attack "How do you feel now?" card (see "Phase 2" at the bottom).
- Logs, attack detail, the update flow and the medication screens. These are separate handoffs.

---

## 1. New hero artwork (replaces both JPGs)

Two inline SVGs replace `card-attack-free.jpg` and `card-ongoing.jpg`. They are flat and abstract (sun, leaf and hill when attack-free; calm rings when ongoing), coloured by two new tokens so they follow the theme.

**Tokens.** Add these to each palette block in `src/index.css`:

| token | dark | light | attack |
|---|---|---|---|
| `--color-ill-1` | #8C735E | #C9A98A | #8C735E |
| `--color-ill-2` | #5E7363 | #A9BFAD | #5E7363 |

Attack uses the dark values for now. That palette is being redesigned.

**New file `src/components/heroArt.tsx`** exports `AttackFreeArt` and `OngoingArt`. Both are `aria-hidden`, `focusable="false"`, with `viewBox="0 0 250 268"` and `preserveAspectRatio="xMaxYMid slice"`.

AttackFreeArt:
```svg
<circle cx="140" cy="128" r="74" fill="var(--color-ill-1)" fill-opacity="0.22"/>
<circle cx="140" cy="128" r="42" fill="var(--color-ill-1)" fill-opacity="0.85"/>
<path d="M196 48c26-8 48 10 44 35-3 22-24 27-37 17-13-10-22-43-7-52z" fill="var(--color-ill-2)"/>
<path d="M30 268c14-46 80-74 220-64v64z" fill="var(--color-ill-1)" fill-opacity="0.45"/>
```

OngoingArt:
```svg
<circle cx="150" cy="134" r="112" fill="none" stroke="var(--color-ill-1)" stroke-opacity="0.18" stroke-width="14"/>
<circle cx="150" cy="134" r="80" fill="none" stroke="var(--color-ill-1)" stroke-opacity="0.32" stroke-width="12"/>
<circle cx="150" cy="134" r="50" fill="none" stroke="var(--color-ill-1)" stroke-opacity="0.5" stroke-width="10"/>
<circle cx="150" cy="134" r="24" fill="var(--color-ill-1)" fill-opacity="0.85"/>
<path d="M150 22a112 112 0 0 1 104 70" fill="none" stroke="var(--color-ill-2)" stroke-width="14" stroke-linecap="round"/>
```

**HomeCard changes:**
- `image: string` becomes `art: ReactNode`.
- Drop `imageAnchor`. `xMaxYMid slice` keeps the right edge, which is what both pieces need.
- Keep the box (right-aligned, 64% wide, starting just below the status bar) and all three gradients. The gradients still fade from `bg-bg-base`. The SVGs have no background plate, so the old "dark and warm at the edges" caveat in today-cards.md no longer applies. Delete that bullet.
- Remove the two JPG imports and delete `src/assets/card-*.jpg`. The source files in `illustrations/` stay.
- Check all three themes on device. The art is decorative so it has no contrast target, but the headline sitting over it does: re-measure text-primary over the art where the headline overflows (it is `whitespace-nowrap`).

## 2. Attack-free hero

Top to bottom inside the text block:
- greeting (`greeting()`, small, secondary colour)
- headline: `formatSinceLong(lastEnd)`, e.g. "[4 days]"
- detail line: "since your last attack"

"Attack-free for" goes. The greeting takes the kicker slot and the sentence now reads top to bottom: "Good evening / 4 days / since your last attack". The wording follows the "Days since · last attack" rule in CLAUDE.md; "attack-free" read as a score to keep. Pass it as `detail`, and update the today-cards.md bullet that says this hero has no detail line.

## 3. Ongoing hero (hero B, the trajectory)

- label: "Ongoing attack"
- headline: elapsed time only, `formatElapsed(start)` with no "Started", e.g. "[2h 14m]". The label already says it's ongoing.
- **sparkline** (new) under the headline, only when the attack has 2 or more readings:
  - SVG 200 × 48, `role="img"`, `aria-label="Pain readings so far: [5, 7, 8]"`
  - one point per snapshot, value = `maxSeverity(snapshot)`, oldest first
  - x = `6 + i * (200 - 12) / (n - 1)`; y = `4 + (1 - v / 10) * 38`
  - baseline at y=45 in the border colour, 1.5px
  - path in accent, 2.5px, round caps and joins; end dot r=5 in accent
  - margin-top 14px, then 8px to the detail line
- detail line: "[7] now · peak [8] · left side". Side comes from `attackSide(attack)`, lowercased, and is left out when null.
- `End attack` stays as it is (`btn-secondary btn-compact`), and the text block still opens `AttackDetail`.
- Keep `useNowTick` for the elapsed time.

Why: the headline answers "how long" and the line answers "is it getting better", which is the question someone opens the app with mid-attack. The old detail line gave numbers with no direction.

## 4. Attack mode button moves into the hero

- **Position:** top-right of the hero, `top: calc(env(safe-area-inset-top) + 12px)`, `right: 16px`, above the art and gradients (z-index).
- **Look:** the pill in the visual spec (moon icon plus "Attack mode"). Off state is new; on state keeps the current pressed treatment.
- **Behaviour:** exactly what the floating pill does now. Same `setAttackMode`, same `aria-pressed`. Nothing about attack mode itself changes.
- **Remove the floating `AttackModePill`** and its scroll-collapse wiring (`pillCollapsed`, the scroll watcher if nothing else uses it).
- Recheck the bottom padding reserve in `App.tsx` (`calc(10rem + inset)`). It was sized to clear the floating pill, so it can shrink to whatever clears the nav and the FAB. Test that the last element on every tab still scrolls clear.
- **First-run state (no hero):** put the same button in `TopBar`'s `control` slot on Today, so attack mode stays reachable before the first attack.
- Profile → Accessibility keeps its attack mode switch.

## 5. Week strip on Today, only when it says something

Show a card under the hero **only when 2 or more attacks overlap the last 7 days.** Count attacks, not migraine days: one 28-hour attack covers two calendar days and must not trigger this. Both ongoing and ended attacks count.

- Title: "[2] attacks in the last 7 days"
- Title style: 19px weight 600. Card gap 12px.
- Strip: data from `lastSevenDays()`. Seven columns spread across the card, each 40px wide: a 30px circle, then the day's initial 14px text-secondary 6px below.
  - no migraine: 1.5px `bg-border` ring, empty
  - migraine: solid accent circle with a 9px `bg-base` diamond (a rotated square, 2px radius) in the centre, so it isn't colour alone
  - today: 2px text-primary ring (on top of either state)
- Legend under it, centred, 14px: a 16px migraine marker plus "Migraine". (The prototype's headache marker is dropped with the headache tile.)
- This reverses the 2026-09-02 decision that replaced filled cells with dots because they read as tappable. Record the reversal in decisions.md (see "Decisions to confirm").
- Static `div`, not a button, with an `aria-label` that lists which days had a migraine.
- No headache legend (see out of scope).
- Hidden in attack mode (attack mode's content rules are out of scope, so keep it off there).

Why: the week used to be on Today all the time. It now appears only when it shows a cluster worth noticing.

## 6. 2-hour check-in card (ongoing attack only)

- **Show when:** the ongoing attack's last dose (`lastDoseSnapshot`) is at least 1h 55m old, no reading has been logged since `FOLLOW_UP_MIN_MS` after that dose, and the dose is under `FOLLOW_UP_MAX_MS` (4h) old. Use the existing constants so this measures the same window as `medicationResponse`. Re-evaluate with `useNowTick(60_000)`.
- **Look:** a card (visual spec) with the `CHIP_ON` tint as background and a 2px accent ring, **not** solid accent, because solid accent means the FAB. Row layout, 14px gap: clock icon 30px in accent, then "2-hour check-in" (18px, weight 600) over "How is it after [Sumatriptan]?" (14px text-secondary).
- **Tap:** opens the existing Add update flow (`QuickUpdateForm`) for this attack.
- **After a reading lands in the window:** the card is replaced by a small status line (visual spec), a check-circle icon plus "At 2 hours: pain [3]".
- The scheduled follow-up notification answers the same question. Whichever is answered first, the other must go away: the card does this on its own because it reads the snapshots. Confirm the notification handler doesn't then ask a second time.
- Visible in attack mode too. It bears on the next hour, the same reason `ImpactPrompt` shows there.

## 7. Medication card: last 30 days, T / C / P bars

This replaces the "Medication days · this month" tile.

**Window.** A rolling 30 days ending now (`now - 30 * DAY_MS`). Count distinct local calendar days, from snapshot times, with the same rules as `medicationDaysInWindow` (skip retired names). **Every label on Today says "last 30 days". "This month" goes.** That includes the per-drug overuse warning row, which becomes "on [8] days in the last 30 days".

**Card.** A card (visual spec), whole card is the button, 10px gap. One row per class, then its bar under it:

| badge | label (use `CLASSES` labels from MedicationEditor) | limit |
|---|---|---|
| T | Triptan days | 10 |
| C | Combination painkiller days | 10 |
| P | Simple painkiller days | 15 |

- Row: 30px letter badge, 10px gap, label (16px, flex 1), "[4] of 10" right-aligned (14px text-secondary). Under it, the bar (visual spec). Fill width = days ÷ limit, capped at 100%.
- Above the rows, one caption at 14px text-secondary: "Last 30 days". The prototype has no card title; the rows carry it.
- A day counts for a class when any medication of that class was logged that day. Two triptans on the same day count as **1** triptan day. Don't sum per-drug counts.
- Show a row for each class that has at least one acute medication in the library **or** a dose in the window. Hide the whole card when no row qualifies.
- **Warning state:** at `warnAt(limit)` (the existing 70% rule) the fill turns amber (`severity-mid`) **and** a small warning triangle sits before the figure. Never colour alone.
- **Combined line (mixed use).** "Any of these" with "[9] of 10" and the same bar and warning rule. Count = distinct days with a T, C or P dose. Limit 10, from ICHD-3 8.2.6: overuse across several classes counts at 10 days total even when no single class reaches its own limit. **Only shown when 2 or more classes have days in the window.** With one class it would just repeat that row.
- **Class `other` or unset:** not in any bar. If such a medication was logged in the window, add one line under the bars: "[Rizatriptan] has no type set, so it isn't counted here." with a "Set type" link to My medications.
- A user-entered `maxDaysPerMonth` on one drug stays where it is now, in that drug's warning row, and doesn't move the class bars.
- The whole card is a button to Insights.
- **Letter badge:** new small component (check `drawnIcons.tsx` first in case one exists). 30px square, radius 8px, 1.5px accent ring on `bg-base`, bold letter. It always sits next to the text label, so the letter is never the only cue.
- Add `MOH_DAYS_COMBINATION = 10` and `MOH_DAYS_MIXED = 10` beside the existing constants in `stats.ts`, so the numbers live in one place. Put the 30-day class counting in `stats.ts` too, as one function returning `{ triptan, combination, simple, any }` days, not inline in the component.

**Migraine days** moves to the same 30-day window and takes the number-tile style (visual spec): "[3]" over "migraine days · last 30 days". The prototype has two tiles side by side; the headache tile is out of scope, so put **Attacks** in the second slot: "[2]" over "attacks · last 30 days". Both tiles open Insights.

**Per-drug overuse warning (not in attack mode).** Becomes the warning banner (visual spec), with the prototype's plainer copy: "**[8] of 10 triptan days in the last 30 days.** Frequent use can sometimes lead to more headaches. Maybe worth a chat with your doctor." When the user entered their own limit, keep the current wording about that limit. Name the class, not the drug, when the warning comes from a class bar.

**Ongoing medication card** (replaces the current last-dose `MedRow` look, same data). A card: 36px letter badge, 12px gap, then name (17px, weight 600) over "Taken [14:02] · next dose from [16:02]" (14px text-secondary). Keep the current 24h position and gap wording as that second line. If the overuse warning applies, it sits inside this card under a 1px divider, with the triangle, bold count and no explanation sentence.

## 8. Order on Today

Not in attack mode:
1. hero (with the attack mode button)
2. `ImpactPrompt` (unchanged)
3. week card (only when it qualifies)
4. check-in card or line (ongoing only)
5. last-dose row (ongoing, unchanged)
6. per-drug overuse warning rows (now 30 days)
7. migraine days tile
8. medication card
9. `Hit6Prompt` (unchanged)

In attack mode, keep what shows today and add only the check-in card.

## Acceptance checks

- typecheck 0, lint 0.
- All three themes: art visible, headline readable where it runs over the art.
- Text size at the largest setting: headline stays on one line, the pill doesn't overlap the headline, and bars and figures wrap without clipping.
- VoiceOver: hero reads label, headline and detail in order. Sparkline reads its readings. Week card reads its days. Each bar reads "Triptan days, 4 of 10" with the warning spoken when on.
- One attack spanning midnight plus nothing else: no week card.
- Two triptans on one day: triptan count goes up by 1.
- Triptan only, no other class used: no "Any of these" line.
- Dose logged 2h ago with no reading since: check-in card shows. Log a reading and it turns into the "At 2 hours" line. At 4h with no reading, it disappears.
- Attack mode toggles from the hero exactly as it did from the floating pill.

## Decisions to confirm with June before building

These were filled in to make the spec complete. Ask before building any of them:
1. The floating attack mode pill goes away on **all** tabs, not just Today (sections 4 and 8).
2. The migraine days tile also moves to 30 days, and the second tile shows attacks instead of headache days (section 7).
3. The week card counts attacks, not migraine days (section 5).
4. The week strip uses the prototype's filled circles, reversing the 2026-09-02 dots decision (section 5).
5. Today's cards lose their border and move to 20px radius, so Today will look different from Insights until Insights gets the same pass.

## Phase 2 (don't build yet)

The prototype's post-attack card, "How do you feel now?" (Tired / Foggy / Light-sensitive / Back to normal, multi-select with ✓), needs a new optional field on `Attack` and a Supabase column. It would also share the 24h after-attack window with `ImpactPrompt`, so two cards would ask questions at once. June needs to decide whether to merge them into one card first.
