# Today — the design calls

`CLAUDE.md` carries the constraints a change has to respect. This is the reasoning behind them: the 2026-08-14 rebuild, the device pass after it, and the v3 redesign of 2026-10-26 (built from `docs/today-v3-handoff.md`, which holds the full spec and the prototype's measurements).

## The hero

- **The artwork is drawn, not shipped as a picture** (v3). `heroArt.tsx` holds two inline SVGs: sun, leaf and hill between attacks, still concentric rings during one. They are filled from two tokens, `--color-ill-1` (warm clay) and `--color-ill-2` (sage), defined in all three palettes. The two JPEGs they replaced were night-toned and composed for the dark page: in light mode they read as a dark rectangle, and the CSS filter that softened them was a stopgap. The source illustrations stay in `illustrations/`; nothing ships from there.
- **The art has no background plate**, so the old caveat about a replacement image needing dark, warm edges no longer applies. Every shape sits straight on the page.
- **The hero is not a card, as of 2026-08-25.** It was a rounded `bg-bg-surface` panel inset in the page padding: a hard-edged image box inside a hard-edged card, two frames around the one thing on Today that should read as the top of the screen. It bleeds past the page padding (`-mx-4 sm:-mx-6`) and up to the top of the scroll region (`-mt-5`), and **Today renders no `TopBar` while a hero is on screen**. The hero's label and headline are the page's heading in that state; the first-run state has no hero and keeps the bar.
- **The blend works because the hero has no background of its own.** All three fades start from `bg-bg-base`, the page colour, so the artwork dissolves into the page instead of into a card tone. They fade to `bg-bg-base/0`, never `transparent`: interpolating to `rgba(0,0,0,0)` greys the mid-stops. Tune the stops, not the art; this is read mid-migraine.
- **Three fades, one per edge the art box has.** Across (`from-bg-base from-40%`) covers its left edge; down from the top and up from the bottom cover the rest. The right needs nothing, since the box reaches the viewport.
- **The across fade's opaque stop must sit past the art box's left edge.** The box is `w-[64%]`, right-aligned, so it starts at 36%; the opaque stop is 40%. Move the box and the stops move with it, or a seam runs down the screen.
- **The vertical fades are long and carry a mid stop.** A short linear fade finishes with a visible kink, which the eye reads as an edge.
- **The art box starts 40px below the hero's top edge, on top of the safe-area inset** (`calc(2.5rem + env(safe-area-inset-top))`), so the clock and battery never sit on the picture. The inset is added, never substituted: it reads as 0 in the browser preview.
- **The hero's min-height is what sizes the art.** `xMaxYMid slice` covers the box the way `object-cover` did, so with the box taller than it is wide the height drives the scale. Currently `20rem` (320px). `xMaxYMid` keeps the right edge, which both pieces are composed against, so there is no per-card anchor any more.
- **The text block is centred against the art** (`items-center` on the hero), with 24px sides and bottom and a top padding that clears the attack mode button: `calc(6.875rem + inset)`.
- **Type, to the v3 spec, all in rem so the text-size control scales it.** Kicker 16px medium, `text-secondary`, 4px above the headline. Headline 44px semibold, line-height 1.05, `whitespace-nowrap`. Detail 17px `text-primary`, 16px below the headline, or 8px below the trajectory when there is one. Action row 24px below.
- **The headline overflows the 64% text width on purpose.** It is the one line that has to land at a glance. Checked at the 150% setting: it stays on one line and clears the screen edge. **Contrast over the art**, measured from the tokens: at least 7.2:1 where a long headline actually ends (about 60% across, where the fade still lays ~65% page colour over the art) in every theme. In the theoretical worst case, directly over the 0.85-opacity sun disc with no fade, it is 3.24:1 dark, 3.18:1 attack and 6.0:1 light, still AA for text this large.
- **The detail line may wrap now.** It was `whitespace-nowrap` because a date and a time broke after the comma and read as two facts. Neither hero carries a date any more, and at 150% a nowrap line would run off the screen.
- **Layers carry explicit z-indices, and the hero is deliberately not `isolate`.** Art and fades are z-0, the text z-1, the attack mode button z-45. That button must sit above the attack-mode dim scrim (z-35 on the shell root), because it is the control that turns attack mode off. Inside an isolated hero no z-index can reach the root's stacking context. Sheets (z-50) still cover it.

### Attack-free

- **"Good evening / 4 days / since your last attack"** (v3). The greeting is the kicker and the three lines read as one sentence. It replaced "Attack-free for", which read as a score to keep up, the thing §9.2 rules out. The wording follows the Insights tile's "Days since · last attack".
- **Still no date.** "Since Thu 20 Aug, 10:40" under "8 minutes" was the headline's own figure said a second way. The exact end time is on the attack in `AttackDetail`.
- **It carries no action.** "Log an attack" was the FAB's action in a second, louder place. The first-run empty state keeps its labelled button: a bare plus is a weak first affordance.

### Ongoing

- **The headline is the elapsed time alone**, "2h 14m" (v3). "Started 2h 14m" said "started" under a label that already says the attack is ongoing. `useNowTick` keeps it honest.
- **Under it, the attack's trajectory** (`HeroSparkline`), when there are two or more readings: one point per reading's max severity, oldest first, evenly spaced, y pinned to 0…10 like the Logs sparkline and the widget. Accent with an end dot, over a `bg-border` baseline. The headline answers "how long"; the line answers "is it getting better", the question someone opens the app with mid-attack. The old detail line gave two numbers with no direction. VoiceOver reads it as "Pain readings so far: 5, 7, 8".
- **Accent, not the severity ramp, for the line.** The ramp is right on the Logs row and the widget, which sit on flat ground; here the line sits over illustration, the same reason the numbers beside it are plain text.
- **Detail: "7 now · peak 8 · left side".** Both figures are named so an eased attack never announces its peak in the present tense; peak drops on a single reading; side comes from `attackSide` and is left out when `null`, which must never render as "both".
- **`End attack` stays `btn-secondary btn-compact`**, the one action the FAB can't express. Promoting it to primary would rebuild the two-accent-targets problem.
- **The text block is the route to `AttackDetail`** (`onOpenDetail`). A whole-card target stops working once a button lives inside it.

### The attack mode button

- **On Today it lives in the hero's top-right corner** (v3), `calc(0.75rem + inset)` from the top and 16px from the right. On Logs, Insights and Profile the floating pill stays exactly as it was (Sunny's call: Today only), with its scroll-collapse.
- **The off state is new** (a `bg-surface` pill with a quiet `bg-border` ring, 44px tall, 15px label, 18px mark); **the on state is the floating pill's own pressed treatment**, since attack mode's look is being redesigned separately. Behaviour is identical: the same toggle, `aria-pressed` and label.
- **It keeps `AttackModeIcon`, not the prototype's crescent.** `MoonIcon` already means sleep, as a relief and a trigger; one symbol, one meaning.
- **First run, with no hero, it sits in `TopBar`'s control slot**, so attack mode is reachable before anything is logged. Known limit: `TopBar` is its own stacking context (sticky, z-30), so in that one state the button sits under the dim scrim. It stays tappable, since the scrim is `pointer-events-none`.
- **Today's bottom reserve is 7rem + inset**, down from 10rem, because nothing floats over Today's content any more. Measured: the last card ends ~30px above the FAB's top edge. The other tabs keep 10rem for the pill.

## Below the hero

- **Every block is the v3 card** (`TODAY_CARD` in `utils/todayCard.ts`): `bg-surface`, 20px radius, 16px padding, **no border and no ring**. It replaced the bordered `bg-raised/60` tiles and rows, which read as a grid of outlined boxes under a hero with no frame at all. **Today only, for now:** Insights keeps its bordered tiles until it gets the same pass (Sunny's call), so the two pages differ on purpose. `ImpactPrompt` and `Hit6Prompt` are unchanged. Blocks are 14px apart.
- **Order:** hero → impact question → week card → two-hour check-in → the ongoing dose → overuse warnings → the two tiles → the medication card → HIT-6. Roughly "what bears on the next hour" first. In attack mode only the hero, the impact question, the check-in and the dose rows survive; that branch of `TodaySummary` keeps its old shape and is being redesigned separately.
- **Every figure is "last 30 days"** (v3). "This month" read 1 on the 1st after a bad 31st and reset to zero for no reason the reader could see. A rolling window says the same thing every day. Insights keeps calendar months, because that is the unit the 15-day line is stated in.

### The week card

- **Shown only when two or more attacks overlap the last seven days** (`attacksInLastSevenDays`). The week used to sit on Today permanently, and most weeks it was seven empty marks. Now it appears when there is a cluster worth noticing, titled with the count.
- **The trigger counts attacks, the strip marks days** (Sunny's call). One 28-hour attack never shows the card on its own, but when the card is shown, an attack past midnight marks both days.
- **Filled circles, reversing the 2026-09-02 dots call on Today only** (Sunny's call). That call replaced cells with dots because rounded fills read as tappable. Here the card is static, with no press, hover or focus state. A migraine day is an accent circle **with a `bg-base` diamond**, so the state is never colour alone. Today carries a `text-primary` ring. Insights keeps its dots.
- **VoiceOver reads the days, not the picture:** "Migraine on Wednesday 22 and Friday 24". Hidden in attack mode.

### The two-hour check-in

- **Shown during an attack once the last dose is 1h 55m old**, until a reading lands in the follow-up window or the dose turns 4h. `doseCheckIn` in `stats.ts` uses `medicationResponse`'s own constants and its closest-to-two-hours pick, so the card and Insights can never disagree about whether a dose was checked.
- **A tint plus a 2px accent ring, never solid accent**, which means *press this* and belongs to the FAB. It opens the ordinary Add update flow.
- **Answered, it becomes one quiet line** ("At 2 hours: pain 3") for the rest of the attack: a fact, not a card.
- **It and the reminder ask the same question, and whichever is answered first ends both.** The card reads the snapshots. On the reminder side, `medCheckInDelay` returns the normal cadence once `doseCheckIn` says "answered". Before that it re-timed from the last dose regardless, so a reading logged at 2h05m was followed ten minutes later by a catch-up reminder asking again.
- **Shown in attack mode too**: it bears on the next hour, the reason `ImpactPrompt` shows there.

### The dose card, warnings, tiles and medication card

- **The ongoing dose** is a card headed by a 36px class badge (the drug's form icon if it has no type): the name, then the amount, when it was taken, the 24-hour position against the user's own limit, and the next-dose line by the user's own gap, a statement of their number, never an instruction. If an overuse warning applies to *that* drug or its class, it sits inside the card under a divider, as the bold count alone.
- **Overuse warnings are a banner** (severity-mid tint, triangle, bold first sentence) in plain words: "**8 of 10 triptan days in the last 30 days.** Frequent use can sometimes lead to more headaches. Maybe worth a chat with your doctor." They name the **class** when they come from a class bar. A drug with its **own** entered limit keeps the old wording, naming the drug and quoting the limit back. An untyped drug, which no bar counts, keeps a per-drug warning against the default 10.
- **Two number tiles: migraine days and attacks.** The prototype pairs migraine days with headache days, but the app has no headache-day record (Sunny's call). Attacks is the other figure Today can state plainly, and seeing the two side by side is what explains "7 attacks, 11 days". One 14px label under each figure, no uppercase kicker. Both open Insights.
- **The medication card counts days per class, not per drug.** Triptan (10), combination painkiller (10) and simple painkiller (15), the ICHD-3 reference points, each a row with a `ClassBadge`, its label from the editor's own `CLASSES`, "4 of 10" and an 8px bar. Two triptans on one day are one triptan day. A row shows for each class with an acute medication in the library or a dose in the window; with none, the card is hidden.
- **"Any of these"** against 10 (ICHD-3 8.2.6, mixed use), only when two or more classes were taken; with one it would repeat that row.
- **At 70% a bar turns amber and gains a triangle before the figure**: never colour alone. VoiceOver reads "Triptan days, 7 of 10, close to the guideline".
- **A drug with no type is named under the bars** ("Rizatriptan has no type set, so it isn't counted here.") with a "Set type" link to My medications. The link sits outside the card's button, since a button can't hold another. The rest of the card opens Insights.
- **A user-entered `maxDaysPerMonth` never moves a class bar.** It belongs to that drug's own warning.
