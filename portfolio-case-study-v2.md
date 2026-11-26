# Lidd case study — rewrite, full copy (draft 2026-11-26)

> Draft copy for the portfolio page, section by section, in page order. `[Visual]` blocks
> say what goes there and give the caption. `[Check]` marks something only you can confirm
> before publishing. The source brief (`portfolio-case-study.md`) is still the long version
> of the facts; this file is the page.

---

## Hero

# Lidd: an attack diary that keeps an honest record when you can't think straight

Solo design and AI-directed build · Personal-use iOS app · 2026 · 6 min read

**Challenge.** A migraine can flare and fade for hours, and logging it mid-attack is the
last thing you want to do. But those logs drive diagnosis and treatment, and every tracker
I tried reduced an attack to one form and one number, filled in once it was over.

**My role.** Everything, end to end: problem definition from my own treatment, the
research-grounded interaction model, artwork, the design system, a review of a 113-board
redesign, and the build (web, native iOS, Supabase), with Claude Code writing the code under
rules I set.

**Impact.** I log every attack with it. Because Lidd stores an attack as a series rather
than a score, the logs showed a medication that never broke the plateau, and my doctor and
I changed my preventive dose. A public release is scoped, and choosing what it leaves out
was a design decision in its own right.

**In numbers.** 5 months · ~500 commits · 113 redesign boards reviewed against the data ·
a 2,600-line decision log of what was tried and rejected.

`[Visual]` Today, Logs and Insights side by side in the current design, with attack mode on
in the third phone.
*Caption: Lidd today. The strip above the tab bar means attack mode is on.*

---

## 1. The insight

### One number can't describe an attack

The clinic's paper diary and every app I tried worked the same way: one form, one severity
score, filled in from memory once the attack is over. A neurologist asks different
questions. How did the pain move? Where did it spread? How long did it hold? Did the
medication do anything?

So Lidd records an attack as a series of readings. Each one needs only three things: the
time, where it hurts (any of twenty head zones), and how bad it is, from 1 to 10. Everything
else is optional. "No change" counts as a reading, and that is what makes a plateau visible.

In the attack below, the first dose didn't move the pain; only the second did. The paper
diary would have recorded one number: the attack at its worst.

`[Visual]` The plateau chart, re-rendered in the current style: one real attack in Lidd
beside the same attack as one paper entry.
*Caption: One real attack in Lidd, and the same attack on paper.*

That single decision about the data model is what produced the clinical result above. The
rest of the project is about protecting it: getting accurate readings from someone in pain,
and never letting the app change what they said.

---

## 2. Designing for someone mid-attack

### The worst time to use a phone

An attack brings light sensitivity, nausea, and trouble holding a thought. It is also the
moment a reading matters most. Three rules shaped everything that is used mid-attack:

- **Ask less, and ask more plainly, the deeper into an attack.** A reading needs three
  answers; the logging flow can be finished from its first step. Reminders space out as
  the attack goes on (one hour, then two), and "No change" can be answered from the
  notification on the lock screen or a paired Apple Watch, without opening the app.
- **An update is a new reading, never an edit of the last one.** Every field starts blank.
  Pre-filling would make "nothing changed" the easiest path and quietly flatten the record.
- **Low glare, measured rather than guessed.** Warm charcoal, low-saturation sage, no pure
  white or black, no saturated blue. Every colour pair was measured against WCAG on every
  surface it sits on. The text colour the research recommended measured 13:1 and read as
  glare on the phone, so it was turned down and re-measured.

### Attack mode, and five tries at one control

Attack mode is a third theme: darker, warmer, body text no smaller than 20px, no animation,
and a Today screen with less on it. You can switch it on yourself, or let it come on when
you log an attack. Not every attack brings light sensitivity, so it is never forced.

The control for turning it on and off went through five versions, which is the clearest
picture of how I iterate:

1. A floating icon button on every screen. Always reachable, but it covered content.
2. Moved into the Today hero only. Cleaner, but you couldn't get out from another tab.
3. A labelled pill when off and a "Turn off" band when on. Clearer, but with every element
   enlarged, the band made the top of the screen very heavy.
4. Four placements at the bottom of the screen, mocked side by side: a floating band on
   Today, the same band on every tab, a chip over the + button, and a strip joined to the
   tab bar.
5. Shipped: the strip joined to the tab bar. It belongs to the navigation rather than
   floating over content, it's there on every tab while attack mode is on, and nothing
   floats anywhere while it's off. Its size is fixed in pixels so it stays on one line at
   150% text size.

`[Visual]` The four bottom placements (A–D) side by side, D circled. Beside them, Today with
attack mode off (the pill) and on (the strip).
*Caption: Four placements for "Attack mode on". The strip joined to the tab bar won.*

---

## 3. A record, never a verdict

### The principle the whole app rests on

A health diary is only useful if it's trusted, and it stops being trusted the first time
it says something you didn't. So one rule settles most design questions in Lidd: **the app
records what you reported and counts it. It never decides on your behalf.**

That rule did more design work than any screen:

- **Whether a dose helped is calculated, never asked.** A redesign proposed a "Did it help?
  Yes / A bit / No" question for every dose. I turned it down. Lidd already takes a pain
  reading about two hours after a dose, the standard measuring point for acute treatment,
  and works the answer out from that number. The screen uses the redesign's warmer words
  (helped, a bit, no), but they're computed from what you reported, not a second, competing
  answer.
- **A suspicious attack gets a question, not a deletion.** An attack under five minutes is
  more likely a mis-tap than a real attack. Lidd flags it and asks: keep it, or delete it.
  Until you answer, it still counts everywhere. Quietly dropping it from the figures would
  be deciding for you.
- **An unknown end stays unknown.** If the pain was gone when you woke up, Lidd doesn't
  invent an end time. The attack is marked "ended in sleep" and left out of every length
  figure, rather than adding a made-up number to the averages.
- **Edits are time-limited.** You can fix how an attack felt for 48 hours and the end time
  for 7 days. After that, memory is reconstruction, and a badly remembered answer is worse
  than none. I also rejected "only let people fill in what they skipped": it blocks fixing a
  mis-tap, which is reliable, and allows filling a blank weeks later, which isn't.
- **The word is "attack", not "migraine".** Lidd can't confirm what kind of headache it is,
  so no screen claims to know.
- **No streaks.** A counter of pain-free days turns health into a score you can lose.
  "Days in a row" went from the stats; what's left is a plain fact about how long it has
  been since the last attack. I reversed my own earlier ruling to keep that one, with the
  reasoning written down, because what matters is how long it has been, not whether today
  breaks a run.

`[Visual]` Attack detail as shipped: the pain chart, one medication row per dose
("Pain 5 → 3 · 2 h later · helped"), the "Under 5 minutes" card with Keep it.
*Caption: Every figure on this screen is something you reported, or a count of it.*

---

## 4. Reviewing a 113-board redesign

### Where I adopted, changed and refused

`[Check]` Who drew the v4 boards? If it was another designer or a design tool, keep this
framing. If it was you, change the first sentence to "My own redesign, 113 boards, didn't
survive contact with the data unchanged — which is the point of checking it."

In November the app went through a full redesign: 113 boards covering every screen and
flow. A redesign is a proposal, not a specification, so before anything was built I checked
every board against three things: what the stored data can actually say, the accessibility
floor, and the clinical rules the app is built on. Twelve calls needed a decision, plus a batch of smaller token changes.
Five of the calls and the batch show the range:

| The board proposed | Decision | Why |
|---|---|---|
| A redder high-severity colour | **Refused** | It measured 4.20:1 on a raised card, below the 4.5:1 floor the palette holds everywhere. I named the closest value that passes instead. |
| "Did it help?" per dose | **Changed** | Kept the board's words, but computed from the 2-hour reading, so there's one source of truth. |
| Quiet hours, 23:00–07:00 | **Refused** | It would silence reminders during a night attack, exactly when a reading matters most. |
| Purple and blue in Insights charts | **Adopted, with a limit** | Both are muted, and Insights isn't a screen anyone opens mid-attack, so the no-blue, no-purple rule bends there and nowhere else. |
| A five-step end-of-attack flow | **Adopted, with conditions** | Including "gone when you woke up", stored as an unknown end and never as a time. |
| Rounder sheets, a taller footer button, larger toggles | **Adopted** | Taken screen by screen, each checked in place with its neighbours rather than in one blind sweep. |

`[Visual]` `redesign-review-table.png`: the same six rows, with the two severity colours
shown as text on a raised card.
*Caption: Five of twelve calls, and the token batch. The other seven are listed underneath.*

The Attack detail board shows why the checking matters. Its attack was gone when the person
woke up, so its end was unknown, yet the board gave it a measured length ("23 h"). It drew a
line falling to zero after the last reading, as if the pain had been seen going away, and
labelled a column "At the end" for readings taken hours before it ended. Each one looked
right and would have told the user something untrue. The shipped screen says "ended in
sleep", draws nothing after the last reading, and calls the column "Last logged".

`[Visual]` `detail-board-vs-shipped.png`: the board beside the shipped screen, three data
corrections marked in red and the edit-button change in grey.
*Caption: The board, and what shipped. Each red mark is something the data didn't say.*

I also gave the redesign a system it lacked. Insights' section colours had no logic: pain
areas purple, attack days green, painkillers also purple. Now each colour means one subject
on every section: green for how often, blue for what you did, purple for pain, rose for
what it was like, gold for what came before.

`[Visual]` The Insights colour key beside two Insights sections.
*Caption: One colour, one subject, on every section.*

---

## 5. Leading the build

### A team of one designer and one AI

Claude Code wrote the code. I made the decisions and set the conditions it worked under,
much like leading an engineering team:

- **Rules read before every task.** One file of rules, each tied to the reason it exists,
  so a later change can't quietly undo an earlier decision.
- **A decision log.** 2,600 lines, dated, written as decision, then why, then what was
  rejected. It records why odd-looking fixes must stay, so a later pass doesn't tidy a bug
  back in.
- **A design system in code.** Radius, size and padding are named roles (card, control,
  sheet), never raw values, with a contrast check on every theme. A checklist is read
  before any new UI, because the most common failure was rebuilding a component that
  already existed.
- **Review gates.** A type check, a lint run that must report zero, and an independent
  review after any change to stored data, sync, counts or warnings.
- **The phone decides.** When reasoning and the device disagreed, the device won. The
  keyboard behaviour in the medication flows was argued three ways on paper. Measured on
  the phone, one setting took 948 ms to respond and another 78 ms, and that settled it.

`[Visual]` One real decision-log entry, cropped and readable: heading, decision, why,
rejected.
*Caption: One entry from the decision log. Every rule in the app has one.*

The platform followed the user's needs rather than the other way round. Lidd is a web app
wrapped for iOS, plus a thin Swift layer for what a web app can't do: a home-screen widget,
Siri logging that works without looking at the screen, and reminders that survive the app
being force-quit.

---

## 6. Diary or device

### The release decision

I use Lidd whenever I have an attack. Releasing it means choosing a side of a regulatory
line. Under the EU Medical Device Regulation, software that records and summarises a
patient's data generally isn't a medical device. Software that interprets it likely is:
classing a month as chronic, flagging medication overuse, judging whether a treatment works.

My own build does all three. Careful store wording wouldn't change what it does. That's fine
for me and my doctor; it isn't fine for a stranger with no clinician checking the output.

This is the principle from section 3, applied to the product. The launch version is a
diary and a doctor report: something people bring to appointments while they and their
doctor work out what kind of headache it is and what helps.

**Keep every count.** Attack days, medication days, doses, the shape of each attack, before
and after a preventive.

**Drop every verdict.** Dose-limit checks, overuse warnings, the chronic colour, response
labels and "% fewer".

**Still to do.** The licence for the HIT-6 questionnaire, text that scales to 200% (WCAG
1.4.4; it's capped at 150% today), aura capture and dedicated preventive-medication
tracking.

---

## 7. What I'd do differently

I'd measure on the device sooner. My most expensive mistakes weren't the problems I
couldn't solve. They were the ones I solved twice, because I reasoned from a screenshot
instead of testing on the phone, or because a rule wasn't written down the first time. The
decision log exists because of that, and it's what I'd bring to any team: a decision isn't
finished until the reason for it is somewhere the next person will read it.

---

**Next case study:** One template, many patient apps

---

## Notes for publishing (not page copy)

- **Screenshots regenerated 2026-11-26** in `portfolio-screenshots/shots/` (430×932 @3x, from
  a fictional diary in `seed.mjs`, each shot in an isolated browser with no Supabase
  session). Which file goes where:
  - Hero trio: `01-today-ongoing`, `06-logs`, `11-insights`; or `04-today-attack-mode-on` as
    the third phone.
  - §1 plateau: `07-detail-plateau` (chart and both doses: Paracetamol "Pain 7 → 7", Sumatriptan
    "Pain 9 → 4, helped"). The finished visual is `plateau-lidd-vs-paper` (Lidd's chart beside
    the same attack on a paper diary); `paper-diary` is the sheet alone. Both come from
    `paper-diary.html` via `compose.mjs`, with dates fixed to the 2026-11-26 shots.
  - §2 attack mode: `02-today-attack-free` (pill, off) beside `04-today-attack-mode-on` /
    `05-logs-attack-mode-on` (strip, on); `15-log-pain-areas` for the logging flow.
  - §3 record not verdict: `08-detail-plateau-full`, `09-detail-under-5-minutes`,
    `10-detail-ended-in-sleep`.
  - §4 review table: `redesign-review-table` (from `review-table.html`).
  - §4 board vs shipped: the finished visual is `detail-board-vs-shipped` (from
    `board-vs-shipped.html`); its sources are `boards/v4-detail*` and `10`. The four placements are
    `boards/attack-mode-bottom-placements`; Insights colour key from `12-insights-3m-full`.
  - Spare: `03-today-attack-free-light`, `13-add-sheet`, `14-log-*`.
- Rerun with the `migraine-app-verify` server up: `node portfolio-screenshots/capture.mjs` and
  `node portfolio-screenshots/boards.mjs`, then `node portfolio-screenshots/compose.mjs` (see the header of `capture.mjs` for `PW`/`CHROME`).
- **Removed from the old page on purpose:** "I skipped Figma", "the final look mattered
  less", the CODE Design System line (reversed in November), the six-decisions table, and
  the IDE screenshot.
- `[Check]` Confirm the lock-screen and Apple Watch answers on the current build before
  publishing that sentence.
- **Don't claim** public release, user numbers or clinical validation.
