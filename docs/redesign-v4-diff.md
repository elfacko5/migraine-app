# Redesign v4 against the shipped app — diff and decisions

Written 2026-11-21 from `docs/redesign-v4/` (113 boards) against `main` at `1c3bf62`.

**Method and limits.** Every board was read as extracted text (headings, labels, copy) plus `index.html`, `reference/Patterns.html` and `reference/TokenDecisions.html` in full. I did **not** view the boards rendered, so layout, spacing and artwork are unchecked. The design's tokens are compared with `src/index.css` only where this file says so. Contrast figures were computed here. Proposals (`proposals/`) are unapproved by the design's own index and are listed but not diffed.

How to read it: **A** needs your decision before any code, because it breaks a written rule or changes stored data. **B** is tokens. **C** is per-screen changes. **D** is new features that need backend or native work. **E** is gaps in the design. **F** is where the code is ahead of the design and must not regress.

---

## A. Decisions needed (each conflicts with a rule or touches stored data)

**A1. "Did it help?" (Yes / A bit / No) per dose.** **Decided 2026-11-22 (June): option (a) — reject the verdict. Keep deriving "helped" from the reading near dose + 2 h (`followUpReading` / `doseHelped`), and in the readout show it with the design's warmer words (helped / a bit / no) *computed from the number*, so you get the design's register without storing a conclusion. The live flow's reminder and the past/end flow's "about 2 h after?" recall both already produce that reading, so no new field or column.** Drawn in Past (`MrgPastMed*`), End (`End24Help`), Update (`UpdHelp`) and Detail ("Did each one help? Add now"). CLAUDE.md: *"there is no 'helped' field and must not be one; a severity number is a report, a self-rendered verdict is a conclusion."* Today Insights, Logs and the check-in all derive helped from the reading near dose + 2h (`followUpReading` / `doseHelped`). The design keeps "3 checked at 2 h" in Insights, so it would have two sources of truth. Options: (a) reject the verdict, keep the 2h reading; (b) adopt it as a self-report stored beside the reading, shown as a different thing from the derived figure; (c) adopt it as the primary. (The new dose field and Supabase column apply to options (b)/(c) only; the decided option (a) above needs neither.)

**A2. Update flow changes meaning.** **Decided 2026-11-22 (June): keep the update-time step (as the code already has). Reject the redesign's single-worst-area "how bad now?" card — the user adds each area manually as today (blank start), and the severity control for a selected area shows how *that area* was last logged, inline in the severity container.** `UpdNow` asks one question, "How bad is it now?", for the worst area with last time drawn dashed, plus "It hurts somewhere else too". CLAUDE.md: every field starts blank and an update is a new reading, not an edit. Open questions: how areas not re-rated are recorded (today a missing area means "not recorded"); the design has **no update-time step**, but "Add update" on a past attack currently backfills readings at a chosen time.

**A3. End-of-attack becomes a five-step flow** (`End24*`: when → did it help → impact → what it was like → two days before). **Decided 2026-11-22 (June), with three conditions: (1) keep a 24 h impact fallback on Today (`ImpactPrompt`) for attacks that ended while slept-through or skipped — moving impact into the flow is fine because the flow is a real flow, not the old dialog, but don't lose the fallback; (2) "gone when you woke up" stores an unknown-end flag and is excluded from duration / avg length / the 4–72 h figure exactly like an ongoing attack — never a fabricated time; (3) step 2 "did it help" resolves as A1, i.e. a per-dose 2 h recall *reading*, not a verdict.** **Condition (1) reversed 2026-11-25 (June): `ImpactPrompt` removed from Today outright.** Impact is now asked only live, as `EndAttackForm`'s own step; an attack ended while slept-through or skipped, or backfilled via `PastAttackForm`, stays unanswered — the recall-bias reasoning in `impact.ts` is read as ruling that out too, not just a late answer from `AttackDetail`. Today End attack is one dialog asking one thing. Sub-questions:
- Impact moves into the flow; the 24h window and `ImpactPrompt` have no board — and, as of 2026-11-25, no code either.
- **"Gone when you woke up"** ("Saved as…. Add a time if you know it") is an end with no time. `Attack.end` is a required ISO string and every duration, average length and the 4–72h figure reads it. Needs a new flag plus a rule for what duration means.
- The 4-step variant (no medication) is "approved in principle", not drawn.
- The morning prompt "Is the attack still going?" (`End24Prompt`) is an open question with the designer, per index.html.

**A4. Three new attack-level fields.** **Decided 2026-11-22 (June): adopt all three. (i) "Felt like" → a new pick-any attack field `painQuality` + Supabase column; it's a genuine ICHD-3 criterion B gap the app can't capture today, pick-any because pain is often mixed. (ii) "The two days before" reads the existing `Attack.triggers` data (the reframe from "triggers" to "the two days before" is *more* in line with dossier §4 — it drops the causal claim) plus a way to record an explicit "Nothing unusual" distinct from unanswered (an empty array). Settle at build time which: a reserved sentinel inside `triggers` (truly no migration, but it must be filtered out of the §4 trigger tallies) or a small boolean column (a one-line migration). The "no migration" framing holds only for the sentinel option. (iii) the under-5-min "confirmed real" flag → attack metadata, metadata-only so it fits the editing rule.** (i) **Felt like**: throbbing / pressing / stabbing / dull (pain quality; ICHD-3 criterion B asks for pulsating quality, so it is clinically relevant). (ii) **"The two days before"** with Poor sleep / Stress / Alcohol / Skipped meal / Period / **Nothing unusual**, shown in place of Triggers on Insights ("In the two days before"). Decide whether this is a relabel of `Attack.triggers` (existing data keeps showing; the dossier §4 caution about triggers still applies, "Nothing unusual" is a new explicit answer) or a new field. (iii) **"Looks too short to be real"** (`DetailFlagged`, Logs banner "1 attack looks too short · Review", under 5 min) needs a persisted confirmed flag.

**A5. Detail becomes editable after the fact.** **Decided 2026-11-22 (June): extend `updateAttackDetails` to the new *stable* metadata (pain quality, two-days-before) so Detail's "Add" works on those. Keep impact read-only after its 24 h window — hold the line against the design here; the recall-bias reasoning (a badly-remembered disability level counts where an absent one doesn't) still stands and nothing in v4 refutes it. Snapshots stay immutable, so "Did each one help? Add now" adds a *reading* (= Add update), never a verdict.** `DetailLower` shows "Add" on What it was like, Stopped you (impact) and The two days before, and "Did each one help? Add now". `docs/editing-assessment.md` settled editing as metadata-only, and impact is deliberately read-only — since the 2026-11-25 removal of the Today fallback (A3), that means read-only from the moment `EndAttackForm`'s own step closes, not just after a 24h window. Decide how far "Edit this attack" goes.

**A6. Severity-high colour.** **Decided 2026-11-22 (June): use the redesign's colour if it passes every contrast check.** Checked the same day, and `#D9705F` does not: text on `bg-raised` `#302d29` measures **4.20:1** (below the 4.5 AA floor this palette holds; `#c68880` is 4.72 there), and on its own 20% badge tint 3.57 on a card. It passes on the page (5.33), a card (4.74) and every attack-mode surface (4.86 on raised). So it is **not adopted**, and `--color-severity-high` stays `#c68880`. Closest passing value if you still want a redder high band: `#DD7868` (4.54 on raised, 5.13 on a card, 19.5 ΔE from the delete colour). Neither the proposed value nor that one is desaturated (62–63% saturation against 38%), which the "desaturated terracotta, not bright red" rule cares about and contrast doesn't measure. The collision the design wants fixed (high severity and the delete confirm sharing `#c68880`) is still open; the other way to fix it is to change the delete confirm instead. Original note: Decision 11 moves `--color-severity-high` from `#c68880` to `#D9705F` (the delete button used the same value). Contrast computed here: `#c68880` 5.99 on page, **5.33 on a card**; `#D9705F` 5.33 on page, **4.74 on a card**. Both pass 4.5, but CLAUDE.md says check severity colours against `bg-raised` as the tighter surface, and this one is closer to the floor. It also needs updating in `headDiagram.ts`, `sevFill`, the chart files and the widget's `liddSeverity`, which are all hand-mirrored. The design's own Today/Logs `.s1` low band is a grey `#B3AD9F`; code's low band is green `#8FB096`, and decision 11 says they converge on the code names.

**A7. Purple and blue on Insights.** **Decided 2026-11-22 (June): Insights is exempt and may use the muted purple and blue.** CLAUDE.md's no-purple/no-blue rule gets this one carve-out, Insights charts only, never pain intensity. When Insights is built I will check the chart set against the attack-mode surfaces, since Insights stays reachable there. Original note: Decision 12 adds `chart-1…5` including blue `#8FB3C9` and purple `#AB9FCB` plus a purple heat ramp. CLAUDE.md: *no purple or blue anywhere*, saturated blue avoided for photophobia. Design's argument: both are ~30–35% saturated and Insights isn't read mid-attack. Contrast on page: purple 7.08, blue 7.83. Decide whether Insights is exempt, and whether attack mode (which keeps Insights reachable) should drop them.

**A8. Today reinstates things removed on purpose.** **Decided 2026-11-22 (June): (1) class/triptan bars — do NOT reinstate on Today; the 2026-11-17 removal stands (class-days-vs-guides is an Insights concern, and a count seen all day becomes a §9.2 score); the overuse *warning* banners stay. (2) "↓ from 9 / 10" crosses the §9.2 no-score line (fewer attacks framed as winning) — backlogged. (3) Wording: do not use "migraine" in any user-facing string — an attack may be a migraine or another headache type, which the app can't confirm — so the episode/day word is "attack" everywhere ("attack days", "days in a row with an attack", "woke up with this attack"). Captions may still explain the clinical migraine-day threshold in prose; the spoken Siri phrase "log a migraine" stays (different register). This supersedes the "migraine is the condition" vocabulary rule and the "migraine days, not headache days" naming in CLAUDE.md. Concrete user-facing call sites to change when this is built (not exhaustive): the reminder notification title `notifications.ts:55` `"How's your migraine?"`; `WeekCard` (`"No migraine days in the last 7 days"` / `"Migraine on …"`); the `MigraineDaysChart` section title, which becomes "Attack days per month / this week" with the clinical migraine-day threshold kept only in the caption prose; `StatsView`'s `"with a migraine"` sub-label; `AttackDetail`'s `"Woke up with this migraine"`; and the backup strings (`backup.ts`: the export filename, the Share title, and the "No migraine data found" error). (4) Ongoing hero — follow the code: keep the trajectory and peak.**
- `TodayOngoing` / `TodayAddSheet` show a **"Triptan days" class bar** (`4/10`). The class bars on Today were removed 2026-11-17 on June's call; the design uses "Nov" in one board and "30d" in another.
- **"↓ from 9" / "↓ from 10"** comparison on the 30-day tiles reads as a score for a health outcome (§9.2). The widget proposal repeats it.
- **Wording:** "attack days" on Today against "Migraine days" on Insights; "Add a past headache", "Past headache", "Save headache" in the Past flow against the app rule "attack, never headache" (written 2026-10-13); "Saved. Rest up." on the live-saved screen.
- Ongoing hero shows "Pain 5 now" with no trajectory or peak; code carries both.

**A9. Reminders.** **Decided 2026-11-22 (June): backlog quiet hours. I agree it shouldn't ship now — beyond effort, 23:00–07:00 would silence a *night* attack, which is when a reading matters most, so if it's ever built it must not apply while an attack is open. Keep Snooze. The notification's "It's gone" (ending an attack from a reminder, which skips the end-flow questions) rides with the A3 End-flow decision, not this pass.** `RemindersRedesign` adds **Quiet hours 23:00–07:00 ("No reminders")**, Adaptive vs Fixed timing, and the notification (`UpdNotif`) offers **Update… / Same as before / It's gone**. Consequences: quiet hours would silence reminders during a night attack, which is when a reading is most useful, so decide whether quiet hours apply during an open attack; the notification **drops Snooze** (current actions are update / no_change / snooze); "It's gone" ends an attack from a notification, which CLAUDE.md says doesn't exist, and so skips the end-flow questions. All of it touches `NotificationActionHandler.swift`, the queue and `notifId` space. The reminders board is incomplete per the designer (no fixed/standing row).

**A10. Attack mode.** **Decided 2026-11-22 (June): keep the code version — the 44 px icon-only button and auto-on-only. Backlog the redesign's suggestions: the labelled switch, "turns off again once the attack ends", and the step-1 "sensitive to light right now" toggle.** (i) Today uses a **labelled switch** ("Attack mode" with a 40×24 toggle) where the code has a 44px icon-only button (changed 2026-10-28 deliberately). (ii) "Turns off again once the attack ends" is new; the code only auto-turns it on (`App.tsx:440`), never off. (iii) Decision 14's **"Sensitive to light right now"** toggle in step 1 of the logging flow is not on the `Live23When` board; the design says landing it is a later pass. (iv) No board shows any screen with attack mode actually on.

**A11. Light mode.** **Decided 2026-11-22 (June): build the light-mode controls as the redesign draws them, and build light mode last.** Agreed, with one addition: every new token introduced earlier (chart set, text-strong, warning-surface, and any others) gets its light value at the moment it is added, derived and measured, so light mode never has a hole. What waits until the end is the screen-by-screen light pass, not the token values. Display has a Theme Light/Dark control, but no board is light. The only light values are the on-accent label pair and the warning surface (`#efe4d3`) in `TokenDecisions`. The app ships a full light palette (`docs/palette.md`) whose values the design doesn't carry.

**A12. Today's Settings icon is a dot-and-rays gear.** **Decided 2026-11-22 (June): keep the code's Lucide `settings` cog; reject the dot-and-rays gear — it is the sun used for the theme switch.** CLAUDE.md records that this is the sun used for the theme switch and chose Lucide `settings` deliberately (2026-10-26).

---

## B. Tokens: design vs `src/index.css`

Design colour values match the existing palette closely (page `#1B1A18`, card `#262421`, text `#CDC7BB`, muted `#A39D92`, accent `#7FA187`, link `#9BB9A1`, severity low/mid `#8FB096`/`#C39257`). Differences:

| Item | Design | Code | Note |
|---|---|---|---|
| Heading | 26/600 | tab titles 34px, `text-2xl` 28 | Design says code adopts 26 (decision 16). Hero headline 32 in design vs 44 in code |
| Sheet radius | 20 | 16 (`--radius-sheet`) | Design: code moves to 20 |
| Flow CTA | 56 high, 14 radius, 17 | `.btn-primary` 12 radius, 44px | Pattern's own "spot-check" item. Also: design has two button sizes by role (56/14/17 flow, 52/12/16 inline) |
| Segmented control | 44px segments, 10–14 radius | 6 (`--radius-segment`) | **Decided 2026-11-24 (June): adopt the design's 44px segment / 14px track, filled `bg-bg-surface` track with no border, accent-bordered tinted selected state.** `SegmentedControl` and `AreaSeverityPicker`'s view toggle both moved. |
| Toggle | 46×27 everywhere | check `Switch` in `settingsUi` | Design converts Today 40×24 and Reminders 48×28 |
| List row / badge | 56 row, 28 badge | check against medications rows | Decision 8 |
| Stepper | 44 inline, 64 in value sheet | | Decision 9 |
| `text-strong` `#E4DFD4` | new, 13.09 on page | rejected `#e4dfd6` as glare, CLAUDE.md | Design limits it to the biggest text, but it is the value we rejected |
| `warning-surface` `#2E2820` | new; icon amber, text primary | amber text used for warnings today | Contrast stated 8.7 for text |
| Danger | confirm only, `#C68880` | | Decision 2C matches code's `ConfirmDialog` |
| Scrim | `#14140F` | attack-mode base value | |
| Page padding / gap | 20 / 18 | `px-gutter` 16 | |

**Decided 2026-11-22 (June):**
- **Heading size: adopt the design's 26px/600 for ordinary screen titles** (replaces code's 34px tab titles). The text-size control still scales it (≈39px at max), so accessibility holds. Couples with `TopBar`'s `min-h-14` and top padding, which were measured for 34px — re-tune those in frame when applied. *Hero headline stays 44 (code) for now; revisit when Today is built.*
- **`text-strong`: add a new token, but NOT the design's `#E4DFD4`** — that is the value device-testing rejected as glare. Use a milder value, brighter than `text-primary` `#CDC7BB` but below the glare point (provisional `#d8d2c6`, ~11:1 on page), and verify on the phone before trusting it. Used only for the 1–2 largest texts per screen (empty-state headlines, big numbers). Light value derived when added (A11).
- **Buttons: bigger footer CTA only** — the primary footer action goes to 56px high / 14px radius; in-card and compact buttons stay at 44px / 12px radius. Not the full two-tier.
- **Clean batch adopted** (design's settled reconciliations): sheet radius 16→**20**, segment radius 6→**10**, `warning-surface` **#2E2820** (light `#efe4d3`, amber *icon* + primary text), **toggle 46×27** everywhere, **stepper 44** inline (64 only in the value sheet), **list rows 56 / badge 28** (40 badge only beside a page heading), **section labels 14/600** `#A39D92`, **text links → accent-light `#9bb9a1`**, on-accent label = `bg-base`, destructive = confirm-only terracotta, **chart-1…5 + chart-heat** (Insights only, per A7), **gutter 16→20 / card gap 18**.

**Application approach: tokens land per-screen, not in one blind commit.** Each new colour token (`warning-surface`, `text-strong`, the chart set) gets its dark/attack/light value derived and measured *when the screen that uses it is built*, verified in frame — chart tokens with Insights, `warning-surface` with Today's overuse banners, `text-strong` with the empty states. `severity-high` stays `#c68880` (A6). Display (G2) is the first screen and carries the section-label / toggle / segment-radius / heading-26 applications.

---

## C. Per-screen changes

- **Today (01).** New hero art (drawn sun and leaf; check against `heroArt`), labelled attack-mode switch, 7-day dot strip ("2 attacks in the last 7 days", matches `WeekCard`), 30-day tiles. The + opens a **bottom sheet** ("Add or end"), where the code has a small anchored menu. No impact prompt, HIT-6 prompt or check-in card is drawn.
- **Logs (06).** Header "35 attacks", date-grouped rows, filter sheet (Sort, Period, Peak 1–3/4–7/8–10, Medicine incl. "None taken", Stopped you, Side incl. "Not logged", Triggers, Symptoms), "Show 2 attacks" live count, "No attacks match. Try a longer period." and the "too short" banner. **The "Stopped you" chips still use the old labels** (Not at all / A little / A lot / Couldn't function) while the flows now use Carried on / Slowed down / Had to stop / In bed. Same four levels, two vocabularies. Check how the row looks rendered, since text extraction can't show the marks.
- **Detail (07).** Tiles (23 h, 7 worst, Left side), Pain over time, Medication with timing from onset, then Where it hurt (Worst / At the end, "no reading" for a missing one, matching the not-recorded rule), What it was like, Two days before, Timeline. The unapproved proposal moves Timeline up. Footer "Edit this attack".
- **Insights (09).** Sections: Migraine days, Medication (per drug, "1 of 10 days", doses, "checked at 2 h"), Your monthly guides, **Typical attack** (average peak, length, **time to the peak**, attack days: a new calculation), Pain over time, Symptoms (x of n), Where it hurt, What you tried, In the two days before. **Each section's explanatory caption is replaced by an "i" button opening a "Got it" modal.** The captions carry clinical caveats (migraine days vs headache days, doses outside an attack not counted, the overuse marker scoped to 7/30 days), and a modal hides them. Medication-overuse marker and the period-scoping notes have no board. `InsightsLowData` and `InsightsEmpty` are drawn.
- **Settings (14).** Groups: Medications (3 medicines), Reminders (On during attacks), Display & attack mode, Data, Email, About. **No row for Headache impact (HIT-6) and none for Account & sync / sign-in.** Patterns mentions HIT-6 using the step header, so it exists somewhere, but it isn't reachable from this board.
- **Display (18).** List with Attack mode, Theme, Font, Text size, "What it changes" page, iPhone-size follow, font previews. Close to what ships; this is the lowest-risk first screen to build. The older "Screen dim" boards (`A5`) are not in v4, so confirm where brightness lives now.
- **Data (16).** Export (counts + "not encrypted"), **Import described as additive** ("Anything already in Lidd stays as it is. Only entries that are new to this phone are added"), Delete all data (removes from phone **and account**, "Export a copy first"), plus result states. No error states.
- **Medications (15), 35 boards.** See F: this is what was already built. Remaining differences listed there.
- **Past (21) / Live (23) / Update (25) / End (24).** Flat step flows: Past 5 (When, Where, Medication, What it was like, Anything else), Live **3** (When, Where, Medication), Update 4 (How bad now, Did it help, Taken since, Anything else), End 5. Differences from `LogForm`: the Live flow collects no symptoms, reliefs or triggers (they arrive at the end of the attack); medicines are **pick-any** with per-dose cards ("How much", "About when?", "Add another dose", multiple doses of one medicine), where the code is one medication per reading (radio); a timed dose already becomes its own reading, so the model can carry this, but two medicines at one moment would be two readings at one timestamp. Past adds "Roughly / Exact time" precision (only Exact is drawn) and **inline "Add a medication"** (name + strength, rest later in Settings: needs a rule for the type), with `MrgPastStop` ("Discard this draft?"). Live adds "Next check-in: 2 h after this".
- **Chrome.** Fixed header / scrolling body / fixed footer with a hairline (decision 17) matches how `flush bareHeader` sheets already work. Header patterns (Step flow: 40px circle Back + X; Add/edit modal: Cancel + Done; list header; sheet header with handle) are stated in `Patterns.html`. Chips: pick rows first, no single-chip orphans, leave room for the check (decision 18; matches the `ChipCheck` slot rule).

---

## D. New features beyond restyling

1. **Feedback** (`FeedbackDark`, `FeedbackSentDark`): "We read every message", optional email. Needs somewhere to send it (Supabase table, email service) and a privacy statement.
2. **About** with version/build, Privacy policy, Terms of use, "Made in Denmark". The policy and terms have to exist; this is the point where HIT-6 licensing (P4) also matters.
3. **Delete all data** including the account's server rows: a new remote delete in `sync.ts`, irreversible.
4. **Merge import** (additive by entry) replaces "Import backup → confirm → reload". Needs a per-key merge rule for attacks, lists, medications, HIT-6 and settings.
5. **Doctor report** is referenced (type changes are "flagged on your doctor report"; "Private. Left out of the doctor report by default") but no screen exists, and it was explicitly not built in v3 (`ProfileView.tsx:42`, `docs/decisions.md:2057`). Treat as out of scope unless you say otherwise.
6. **Lock-screen widgets** (proposal only): accessory families need iOS 16 and the app targets 15, and it shows monthly figures that the widget rule (§9.2) rules out.
7. **A "note" field with doctor-report privacy** (`21e` in Patterns) — `Snapshot.note` has no step today.

---

## E. Gaps in the design itself (from index.html and what I found)

- No light-mode boards; attack mode shown as a settings before/after only.
- No error states for import, sync loss, sync conflict, bad backup file.
- 200% text drawn for 4 screens only. Largest Dynamic Type is the app's main accessibility claim (current ceiling 150%).
- No sign-in, Account & sync, or HIT-6 screens in the v4 set; `ImpactPrompt` and `Hit6Prompt` have no board.
- Reminders missing the standing row; the 4-step End variant and the morning prompt unresolved.
- Only Past has inline "add a medication".
- Several Display boards in the old set (screen dim) don't appear in v4.

---

## E2. Visual pass (added 2026-11-22)

After the first version I rendered eight boards in the browser pane (Today ongoing, Logs, Detail, Update "how bad now", End summary, Insights, Live medication, Display with attack mode on). The pane is narrower than the 390px artboards, so right edges are cropped; nothing below depends on them. What the text read could not show:

- **Logs rows are much sparser than the shipped v3.10 row.** Each row is date block, duration, time range, a medication count with a small icon, and a **solid-filled** peak badge (amber, terracotta). No side glyph, no symptom icons, no drug type letters or helped/didn't-help marks, no sparkline. Two consequences: the side (half of ICHD criterion B) leaves the list, and the badge is a solid severity fill, where CLAUDE.md has the peak as a shaded number capped at 40% so it holds contrast in every theme. Decide whether the sparser row is intended.
- **Detail's "Pain over time" ends at 0.** The dashed line runs to an open circle at 0 on the end time, captioned "no reading until it ended". The shipped rule is that a missing value is never drawn as zero and never interpolated, and the app has no record of pain at the end. The design draws an assumption.
- **The Insights "i" modals are empty in the source.** The static render shows a literal `{{modal.title}}` / `{{modal.body}}` over the page, so the text that would replace each section's caption doesn't exist in these files. Together with A: the caveats those captions carry still have nowhere to live.
- **Update "How bad is it now?"** is a single card: area name, "was 7 at 20:25", a 0–10 grid in two rows (6 + 5 cells) with last time drawn as a dashed cell, and "+ It hurts somewhere else too". Nothing is pre-selected, which softens A2's blank-start concern, but the 0 cell remains: the app's severity is 1–10 today.
- **Today** is closer to the shipped hero than the text suggested: label, large duration, "Pain 5 now", the Add update / End attack pair, then one card with the dose and two counters. The hero art is concentric rings with an arc, not the leaf I assumed.
- **Live medication** is as described: expanded card with a check, a 44px stepper, a "when" row of radio pills, "Add another dose". Display with attack mode on matches the text; the "When I log an attack" switch is off while attack mode is on, as drawn.
- **Detail's dose markers collide** at the top of the chart ("Sumatriptan" and "Treo" tags overlap), a small point for the designer.

Not rendered: the remaining ~100 boards. The medications set is the one most worth a second look if those flows are touched.

---

## F. Where the code is ahead; do not regress

The Medications boards were drawn from the same `medications.html` the app was built from, then partly overtaken:

- **"Any medicine"** is June's settled wording (2026-11-19). v4 still reads "Any attack medicine" on `GuidesDark` and the edit boards.
- **Name row in the edit form** is absent from the design (added because a typo couldn't otherwise be fixed).
- **Q10 type-change switch** (versions of one drug share a type, with a switch to change the others) is absent; the design's `TypeListDark` only says the recount.
- **"Stopped medicines"** (`AddFormStopped`: "Adding it again joins your 6 logged doses back to it") contradicts the shipped decision that stop-using was dropped.
- **Remove wording**: v4 "Remove X from your medicines? Your 6 logged doses stay in your diary and insights" differs from the approved "It leaves your list. The 6 doses stay in your diary and in Insights."; keep the approved lines.
- **Keyboard handling, `inert` sheets, focus return, `Toast` timing, the `deleted` list and sync rules** have no design counterpart and must survive any restyle.
- **Widget** direction C and its no-monthly-figures rule; **viewport architecture**; **`DateTimeField` / native picker**; **tap-44 rules**.

---

## G. Suggested order once A is decided

1. **Tokens** (B), after A6, A7, A11: one commit, then retest contrast against `bg-raised`. Includes the hand-mirrored SVG and widget colours.
2. **Display (18)**: lowest risk, nothing in A blocks it except A10(ii).
3. **Settings, Data, About** (D3, D4, D1, D2 each need a decision first; Feedback can wait).
4. **Insights** (needs A4, A7 and the "i" caption question).
5. **Logs and Detail** (A4(iii), A5, Stopped-you labels).
6. **Today** (A8, A10, A12).
7. **The four flows last** (A1, A2, A3, A4, A9). They change stored data and the notification handler, so they get their own plan with `reviewer` after each commit.
