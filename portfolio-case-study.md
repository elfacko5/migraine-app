# Lidd — a migraine tracker built for the moment you can't think straight

> **This file is a source brief, not the finished case study.** It's written to be handed
> to someone writing the portfolio piece: the facts, the decisions worth defending, and
> the reasoning behind them, in more detail than the published version will need. Cut it
> down; don't pad it out.

**Role:** design + engineering (solo) · **Timeline:** Jun 26 – Aug 20 2026, 187 commits ·
**Scale:** ~12,700 lines of TypeScript across 74 files, plus a Swift notification handler
and Siri App Intent · **Stack:** React 19, TypeScript (strict), Tailwind v4, Vite 8,
Recharts, Supabase, Capacitor + Swift

**Status:** shipping on two targets (installed PWA and a native iOS build running on a
real device). Personal-use, not publicly released — which is a live constraint on two
decisions below, not an excuse.

---

## The problem

Migraine tracking apps ask you to fill in a form. That's the wrong interaction for the
condition: the person logging is photophobic, nauseous, and often can't hold a thought
long enough to finish a multi-field entry. Worse, most apps model an attack as *one
record with one severity number* — which throws away what a neurologist actually asks
for: how the pain moved, where it spread, how long it ran, and whether the medication
did anything.

Lidd is built on two bets: **an attack is a time series, not a row**, and **every path
out of the app has to work at three severity levels of "can't cope."**

## What it does

- **Snapshot data model.** An attack is an ordered array of snapshots, each holding the
  full state — per-area severities, symptoms, reliefs, medication, note, and the *source*
  of the reading — at a point in time. Severity isn't a field; it's a map of 17 head
  zones to 1–10 scores, so "forehead 8, left temple 6" is a first-class reading.
- **Anatomical pain picker.** A front/back head diagram built from hand-drawn SVG
  artwork, each zone filling with its own severity colour. The same geometry powers the
  Insights heatmap — the picker and the analysis view are literally the same drawing.
- **Adaptive follow-up reminders.** After logging, the app asks how the migraine is at
  +1h, then +2h. The two most common answers — *no change* and *snooze* — are resolved
  from the notification itself and never open the app. A logged dose pulls the next
  reminder forward to dose + 2h, the standard trial endpoint for acute treatment.
- **Voice logging via a real Siri App Intent.** "Hey Siri, log a migraine." Siri asks
  four short questions; a hand-written parser turns the transcript into a prefilled draft
  the user reviews before anything is saved.
- **Clinical Insights.** Migraine *days* per month against the ICHD-3 chronic line,
  medication days against each drug's own overuse threshold, whether a dose worked
  (severity halved or ≤3 at the 2-hour endpoint), a per-preventive before/after readout
  against the 50% trial endpoint, a pain-area heatmap, and plateau / non-response
  analytics derived from the snapshot chain.
- **HIT-6.** The six-question, four-week-recall impact instrument, scored and tracked
  over time — because the 2026 REFORM finding is that diary counts and impact
  questionnaires disagree about treatment response, so a diary alone answers half the
  question.
- **A medication library with the prescription's own guardrails.** Acute and preventive
  drugs, each optionally carrying the limits transcribed off its label — max per intake,
  max per rolling 24 hours, minimum gap, max days a month.
- **Offline-first with optional sync.** `localStorage` is the source of truth for every
  read. Sign-in (magic link *or* 6-digit code) adds best-effort Supabase push/pull on
  top. No account is ever required; a JSON export/import path exists for people who don't
  want one.
- **Built for photophobia.** Dark-only, warm charcoal rather than blue-leaning slate,
  no pure black or white, no saturated blue anywhere. Plus its own text-size control, a
  brightness overlay, and an **attack mode** — a third theme that dims, warms, raises the
  body-text floor to 20px, cuts all animation, and *removes content from the Today
  screen* rather than just restyling it.

## Design decisions worth defending

**No streaks, no badges, no congratulation.** The Insights page shipped with "Attack
streak" and "Pain-free streak" tiles — so a migraine broke a run and a pain-free day was
a score. That's the sharpest rule in the chronic-illness content-design literature and
the app broke it. The figures survive as plain observations ("Days in a row · with a
migraine"); the game is gone, including the word `currentPainFreeStreak` in the stats
module, because a function with that name invites the label straight back. **Reward the
logging habit, never the health outcome.**

**Never present a default as though it were stated.** Three instances of one rule. If
voice parsing couldn't hear a severity, the review screen labels that area *"no severity
heard"* and disables the one-tap save, forcing a look at the pain step. The "Woke up with
it" toggle answers *whether*, not *when*, so the review screen says exactly that instead
of quietly claiming the attack started "just now." And in the medication editor, the
guideline number for a drug's class is a **placeholder** on "maximum days a month", never
a filled-in value — a figure the app invented must not end up stored as though it came
off the label.

**"Finish now" is visible before it's usable.** The logging wizard has eight steps and
only one is required. A "Finish now" link sits in the app bar from step one — *disabled,
with a tooltip explaining why*, rather than hidden until its precondition is met. A
control that materialises only once it's valid gives no hint it exists, so nobody goes
looking for it. This exists because people often want to log the pain and stop —
sometimes deliberately not logging medication, because they're trying not to take any.

**An update is a new reading, not an edit of the last one.** Every field in the
quick-update flow starts blank. Each step instead shows a quiet, non-interactive
reference to the previous entry ("At last entry (20:36), pain was severity 8 — Forehead
8, Temple left 6"). Pre-filling would make "nothing changed" the path of least resistance
and silently flatten the trend line. The corollary: finishing a blank form opens a
confirm dialog naming what it's about to write, because that tap is equally a real answer
and a mis-tap.

**Two questions that expire, handled opposite ways.** *Impact* — how much the attack
stopped you doing things — is asked once, on the Today screen, inside a 24-hour window,
and then never again. Expiry is silent and leaves it unanswered, because a **late answer
is the bad outcome, not the missing one**: a day later it's reconstruction, and a badly
remembered "2" counts in the disability figures where an absent answer doesn't. HIT-6 is
the mirror image — it asks about the last four weeks, so it doesn't decay, so dismissing
it has to *last* (four more weeks, on that device only) rather than reappearing every
launch. Same surface, opposite decay, opposite mechanics.

**Skipping a question must never read as answering it.** `impact` is *absent* when
unanswered, never `0` — so "not answered" can't be counted as "no impact". That
invariant reaches the sync layer (null maps back to absent), the filters (unanswered
attacks are excluded, not folded in), and the detail view (hidden, not shown as zero).

**The guardrails never give advice.** The numbers come from the user's own label. The app
counts, states the number, and stops: *"You entered a 2-hour gap between doses — the next
one falls at 23:32"*, never *"do not take this yet."* It never blocks a save either — if
four tablets were taken, the diary has to be able to say four, and a tracker that refuses
the truth stops being a record. And a breach note points at **the number, not the dose**,
because a breach is far more often a limit typed wrong than a limit crossed.

**A summary that drops the diagnostic signal isn't a summary.** The Logs row used to show
a pain-area count ("4 areas"). ICHD-3's criterion B wants two of four pain features and
one of them is *unilateral* — so left/right/both is half a diagnostic criterion, where a
count is the one summary that keeps the noise and throws away the signal. It's now a
side, read across the whole attack (one that starts left and spreads is bilateral), and
it returns *null* rather than guessing when nothing recorded says.

**Colour has to carry one meaning.** Solid accent means *action* everywhere; a selected
chip is a *state*, so selection is a tint, never a fill — caught when a dialog showed a
solid time preset competing with tinted impact pills for the same eye. Same rule killed a
per-drug colour system on the timeline card (a second colour scheme beside the severity
ramp) and the accent-tinted medication chips on the Logs row.

**It's a menu or it isn't.** The Profile tab's first draft had one row sitting above
three loose sections; it read as an accident rather than a choice, so all five became
rows. The bottom nav is capped at four tabs plus the action button — anything new goes
*inside* a tab, never beside it.

## Engineering the hard parts

**A WebKit viewport bug that screenshots couldn't find.** After a cold PWA launch, iOS
reported a stable, self-consistently wrong viewport height and hard-clipped every
`position: fixed` element to its own short native viewport — a visible gap under the
bottom nav that no `top`/`bottom`/`transform` value could escape. The fix was structural:
the app root is a fixed-height, non-scrolling `position: relative` shell with its own
nested scroll region, and every floating layer is `absolute` against it. Height comes
from a hook that distrusts the browser's figure below a threshold *and* cross-checks
whether the keyboard is open — because **focus, not magnitude, is what tells the two
cases apart** (the keyboard's accessory bar alone is ~68px, squarely inside the same
band). Safari Web Inspector against the physical device is what finally cracked it, after
several confident, wrong fixes reasoned from screenshots.

**Notifications that survive a force-quit — which meant writing Swift.** A service
worker's `setTimeout` dies with the browser, so the app got a Capacitor shell where the
OS owns the timer. Then the action buttons silently failed on device, twice, when routed
through the JS bridge: iOS launches the app in the *background* to deliver a
non-foreground action, so there may be no WebView to receive it. Every answer now goes
through a queue written in Swift to `UserDefaults` that the web layer drains on mount and
on every foreground — including the one action that *does* foreground the app, because a
single code path is worth more than a live event. The queued entry carries the **tap
time**, not "now": the app might not be opened for hours, and a reading stamped on read
would be a lie about when the severity held. The native handler also schedules the next
reminder itself, or the chain stalls until someone opens the app.

Adjacent, and the kind of thing only device testing finds: the reminder is **delivered
silently** unless `sound` names a real file bundled at the app's root — and silent on iOS
means no tone, no vibration, and no tap on a paired Watch. The plugin's documented
fallback to a default sound doesn't happen.

**A voice parser with no NLP.** ~850 lines of deliberately low-precision substring
matching against the user's *own* chip lists, plus `soundex` for mis-transcribed anatomy
(double-guarded, because "neck" and "nose" share a code). Every rule exists because a
real transcript broke without it: severity is per-area with a forward-biased side-word
search (English puts the side word first), the severity window stops where the medication
clause starts (numbers after "took" are quantities), a bare spoken hour is refused rather
than guessed, and a side-less mention selects *both* sides rather than picking one. The
raw transcript is always kept verbatim and the review screen lists exactly what was
recognised — so a wrong guess is visible, not silently saved.

The Siri half has its own failure mode worth telling: one open-ended question produced an
answer long enough that dictation cut it off, and severity — asked last — was what got
lost. It's now four short required questions, with the medication one asked **twice**,
because "two tablets of X last night at ten and then one this morning at seven" is the
longest thing anyone says and kept getting truncated.

**A chart that measurement said couldn't work.** The attack detail view had a multi-line
severity chart, one categorical hue per pain area — 17 zones against a perceptual ceiling
of about 8. Measured with a dataviz validator, the worst adjacent pair came out at
**ΔE 4.5 in normal vision** (the floor is 15) and 2.3 under protanopia: two lines nobody
could tell apart, colour-vision deficiency or not. That isn't fixable with better hues,
it needs a different encoding. It's now one row per area, where colour carries
*magnitude* and identity is carried by a label. The rebuild also fixed a width problem
the chart had — a column per reading stops fitting a 375px screen at about five readings,
and an overnight attack on 2-hourly reminders produces many more than five.

**Accessibility values that were measured, not copied.** The design spec's own literal
text colour measured 13.1:1 against the page — near max contrast, and it read as glare on
device, which is the thing the spec exists to prevent. Three token values deliberately
diverge from the spec and each was re-measured in place. The severity colours were the
worst case: as specified they measured 4.8 / 3.7 / **2.7**:1, so the higher the severity
the dimmer it rendered, putting a 9 or a 10 below the AA floor on the one line the
timeline exists to be scanned for.

**Two shipping targets, one codebase.** The same build runs as an installed PWA and as a
native iOS app; nothing is forked per platform, and where behaviour must differ it
branches at runtime. Sign-in offers a 6-digit code as well as a magic link, because iOS
Safari always opens mail links in Safari — there is genuinely no way to land a magic link
back inside an installed PWA.

## What I'd tell you about the process

The repo's `CLAUDE.md` and `docs/` are a **decision log, not documentation** — roughly
1,800 lines of *why*, each entry paid for with a round of device testing. Several rules
in it look redundant until you read the failure that produced them, which is exactly why
they're written down. Building solo across web and native, the expensive mistakes weren't
the ones I couldn't solve; they were the ones I solved **twice**, because I'd forgotten
the constraint.

The clearest example: buttons. The shared button classes originally set colour only, with
a comment telling each call site to add "size, radius, font" — so a bare `btn-primary`
was silently *half a button* and nothing failed. A whole screen shipped looking like a
different app. The fix wasn't to restyle that screen; it was to make the classes carry
their own shape, name the two sizes explicitly, and add a checklist that gets read
*before* new UI is built rather than after. Most "new" UI in this app is an existing
pattern applied again, and the recurring failure was building from first principles
instead.

There's also a research dossier the whole app is evidenced against — ICHD-3 field
definitions, medication-overuse thresholds, the MIDAS/HIT-6 comparison, the photophobia
colour science, the accessibility targets. Where the app diverges from it, the divergence
is written down with its measurement, so nobody later "restores" a value as a spec
correction.

**Divergences I'd defend, and one I wouldn't ship publicly.** The text-size range runs
87.5–150%, where WCAG 1.4.4 asks for 200%. It shipped at 200%, and on device that left
the app at four words to a line — worse, for its actual user, than a lower ceiling. That
holds *only* because this is a single-user app. A public release claiming accessibility
as its thesis cannot ship a 150% ceiling while citing 1.4.4, and it's written down as
such. (HIT-6 is a licensed instrument too — fine for a personal diary, needs permission
for a release.)

**Parked deliberately, with reasons attached:** preventive-medication adherence and daily
reminders (the notification ID space and the native action queue are both typed around
attacks — a real migration, not a feature toggle); editing an existing *reading* (a
written assessment came first; metadata-only editing shipped, and the invariant that a
snapshot is never rewritten stays); a warm light theme (the photophobia spec gives no
light-mode values, so they'd have to be derived and contrast-measured the way the dark
ones were, not inverted); and reducing the logging wizard in attack mode (deciding which
fields disappear mid-attack changes what gets recorded, which is a product call with a
data cost).

**Known gap, stated plainly:** aura isn't captured. ICHD-3 1.2 covers roughly a third of
patients and needs its own fields — visual/sensory/speech, gradual spread ≥5 min,
duration 5–60 min, headache within 60 min. That's a data-model gap, not a UI one.

---

## Notes for whoever writes this up

- **Screenshots** live in `portfolio-screenshots/`. The three PNGs there date from
  **2026-08-07 and are stale** — they predate the Today hero redesign, the Logs card
  rework, the Insights restructure, the drawn icon set, and the button system.
  `portfolio-screenshots/capture.mjs` is the reusable half: a Playwright script that
  seeds two fixed attacks (relative timestamps, so they always fall inside the filter)
  and captures Attack detail, Insights and the Pain areas step at 430×932 @3x, dark. Its
  `BASE` points at port 5180 while the dev server defaults to 5173 — set `PORT=5180` or
  edit the constant. **Regenerate before publishing.**
- **Strongest three visuals**, if the piece only has room for three: the head picker with
  several zones lit at different severities, the Insights medication section (days + does
  it work), and the Today screen in attack mode beside the same screen normally.
- **Best single hook**, if the piece needs one line: *the streak counter it shipped with,
  and why deleting it was the right call.* It's short, it's about judgement rather than
  code, and it's the decision least like every other tracker's.
- **Don't claim** public release, user numbers, or clinical validation — none exist. The
  honest frame is a solo build for one user, evidenced against clinical literature, with
  the release-blockers named.
- **Source material** if more depth is needed: `CLAUDE.md` (the rules),
  `docs/decisions.md` (what was tried and rejected, dated), `docs/viewport-architecture.md`,
  `docs/voice-parsing.md`, `docs/editing-assessment.md`, and
  `research/migraine-app-research-dossier.md` (the clinical evidence base).
