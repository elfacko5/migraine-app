# Lidd v3.1 — Heuristic & UX/UI review, measured against the research dossier

*Companion files: `lidd-v3.1-artboards.html` (all v3.1 artboards as live, tappable frames) and
`migraine-app-research-dossier.md` (the research source, referred to below as "dossier §n").*
*Prepared October 2026. Numbers shown in brackets on screens, like [5h 10m], are example values.*

---

## 0. How to use this file in a new session

1. Upload this file, `lidd-v3.1-artboards.html` and, ideally, the research dossier.
2. Open the HTML in a browser. Every frame is the same v3.1 prototype opened at a different
   starting screen (a "preset"). All frames are tappable. The first frame (`#prototype`) is the full app.
3. Links in this file point to frames by anchor, for example
   [`lidd-v3.1-artboards.html#same`](lidd-v3.1-artboards.html#same). The frame header shows the
   same id and preset name.
4. The source of truth is the Claude Design canvas *Lidd* (private to Rik), on the page
   **"v3 · visual-first"**, in the row **"v3.1 — after heuristic review"**. The v3 boards sit in the rows above it for
   before/after comparison. The prototype source file is `project/V31Prototype.dc.html`.
5. The HTML uses a lightweight stand-in for the canvas runtime, so it works offline. Fonts (Lexend,
   Inter, Atkinson Hyperlegible) load from Google Fonts and fall back to system sans without internet.

---

## 1. Where v3.1 sits

| Version | What it was | Verdict |
|---|---|---|
| v1 (Page 1) | Best-practice rebuild of Rik's existing screens (Today, logging, logs, settings, Siri, attack mode) | Good structure. Dropped the pain-area map, which goes against the research. |
| v2 (page "v2 · research-aligned") | Full dossier alignment: ICHD-3 fields, med-day thresholds, 2-hour endpoints, SNOOP, after-phase | Clinically complete, but **too text-heavy**: hard to use mid-attack (dossier §1, §9.5) |
| v3 (page "v3 · visual-first") | Same clinical data, rebuilt as icon tiles, a head map, big taps and minimal copy | Right direction. The heuristic review found 8 priority issues. |
| **v3.1** (row under v3) | v3 plus the 8 fixes and a copy pass | Current version, documented here |

**Design thesis the review measured against** (dossier §1, §8, §9, §11):
- *Designed for the worst moment:* photophobia, nausea and impaired focus. Logging should take
  a couple of big taps, short copy, and no precision taps.
- *Low friction drives adherence* (§7). But speed must not cost correctness, because the data has to be
  clinically portable (ICHD-3 fields, §3).
- *Safety features grounded in guidelines:* SNOOP red flags and the medication-overuse warning (§3).
- *Calm, validating, user-in-control copy* with easy skip and undo, and no streaks (§9.2–9.3).
- *Accessibility as the core:* targets ≥44 px, meaning never carried by colour alone, Dynamic Type up to
  200 % (§8.2–8.4). Warm low-stimulation tokens and a dedicated attack mode (§8.1, §10).

---

## 2. Heuristic analysis of v3 (Nielsen's 10 heuristics + dossier)

Severity: **High** means it risks wrong clinical data, a missed safety signal or failure mid-attack.
**Med** means real friction or confusion. **Low** means polish.

| # | Finding in v3 | Heuristic | Dossier | Sev. |
|---|---|---|---|---|
| F1 | The red-flag entry was only a ⚠ icon in the header, easy to miss and unlabeled. Attack-mode buttons said just "Pain" / "End", which is ambiguous for a cognitively taxed user. | H6 Recognition over recall · H2 Match real world | §3 SNOOP must nudge to a clinician · §9.5 copy as accessibility | High |
| F2 | "Same as last time" logged an attack **instantly** from the + sheet, with no confirmation, no current pain and no meds question, and no undo. One mis-tap created a false attack and false med-days. | H5 Error prevention · H3 User control & freedom | §3 med-day counting must be accurate · §9.3 easy skip/undo | High |
| F3 | Single-choice steps (worse with movement, most bothersome symptom) **auto-advanced**, while other steps needed Next. The flow was inconsistent, gave no chance to correct a mis-tap, and moved unexpectedly for someone with impaired focus. | H4 Consistency · H3 User control | §1 tension 1 · §8.3 attack mode, fewer surprises | Med–High |
| F4 | The head map lost its "your right / your left" orientation. Zones were small pills floating over a drawing rather than the regions themselves. There was no non-map alternative for VoiceOver users or very large text. | H2 Match real world · Accessibility | §3 *unilateral* is an ICHD-3 field, so laterality must be right · §8.4 reflow at 200 % | High |
| F5 | **Two pain scales:** 1–10 on the head map, 0–10 elsewhere. Peak pain and the 2-hour pain-free check (0) weren't comparable. | H4 Consistency & standards | §5 2-hour pain freedom · §6 pain intensity as a diary count | Med |
| F6 | Single-choice and multi-choice tiles looked identical (both ✓). "Pain" and "Stabbing" shared an icon. Medications had no class cue, even though overuse thresholds differ by class. | H4 Consistency · H6 Recognition | §8.2 never convey meaning by colour alone · §3/§5 thresholds per class (10 days triptan/combination, 15 days simple painkillers) | Med |
| F7 | The overuse warning only appeared if the user went to Insights, so the system didn't surface it at the moment of risk. The 2-hour results tracked pain-free only, without most-bothersome-symptom (MBS) relief. | H1 Visibility of system status | §3 "warn users *before* overuse" · §5 2-hour pain freedom **and** MBS relief · §9.4 overuse copy | High |
| F8 | No empty, error or permission-denied states. Attack detail was read-only, with no edit or delete. Log titles were inconsistent and logs weren't grouped by date. | H9 Help users recover from errors · H3 · H8 Aesthetic & minimalist | §9.4 empty/error microcopy · §9.3 user in control | Med |

### Best-practice UX/UI findings (non-heuristic)
- Info "i" buttons were **32 px**, below the 44 px minimum (§8.3).
- Copy that read poorly under load: "Woke" (sounds like slang), "Earlier one", "Different", "Sensitive" (to what?),
  aura "Words" / "Vision" (clinical terms are *speech* and *visual*, §3), the prompt "Dim things down?" (didn't
  say what it does), and patterns copy that promised a timeline without a count.
- Attack mode was never introduced in onboarding, so users wouldn't know to turn it on before they need it (§8.1).
- Merging overlapping logs had no undo.

### What v3 already got right (kept)
Warm tokens from §10 (no #FFF/#000, sage accent, desaturated danger) · Lexend with an optional
Atkinson toggle · a separate headache-days vs migraine-days count with the 15-day chronic line (§3) ·
med-day bars per class · factors framed as personal patterns, not causes (§4) · after-phase and
early-warning capture (§2) · "Saved. Rest up." · no outcome streaks, with check-ins counted instead (§9.2) ·
a dedicated attack display mode with its own tokens (§8.1, §10).

---

## 3. Fixes in v3.1

Each fix: **change → why (dossier) → artboards to inspect.**

### Fix 1 — Visible safety entry and explicit attack-mode actions (F1)
- "Feels different from usual?" is now a full-width labelled button on the Where step. It opens a
  plain-language SNOOP sheet (sudden or worst ever · new weakness or speech trouble · fever or stiff neck ·
  not like my usual). Any selection shows calm copy and **Call 112** (Danish emergency number).
- Attack mode shows an "Attack mode" label, with **Update pain** / **End attack** buttons and a clear **Exit**.
- *Why:* §3 says red flags must trigger a "see a clinician" nudge, never reassurance. §9.4 gives the red-flag copy.
  §9.5 says attack-mode labels are stripped down but still unambiguous.
- *Inspect:* [`#where`](lidd-v3.1-artboards.html#where) · [`#redflag`](lidd-v3.1-artboards.html#redflag) ·
  [`#attack-mode`](lidd-v3.1-artboards.html#attack-mode)

### Fix 2 — "Log like last time" confirms before saving, and every start can be undone (F2)
- The + sheet card now reads "Log like last time · you'll confirm first".
- The new **confirm screen** shows the head with last time's areas, a 0–10 "Pain now" stepper, "Taken Sumatriptan yet?"
  (Yes, just now / Not yet) and Edit to reopen the map. **Start attack** stays disabled, with the
  reason shown, until the medication question is answered.
- Every attack start, headache-day log, merge and delete shows an **Undo** toast.
- *Why:* keeps the one-tap speed that drives adherence (§7) without corrupting med-day counts that power the overuse
  warning (§3). Matches §9.3: "easy skip/undo".
- *Inspect:* [`#add-sheet`](lidd-v3.1-artboards.html#add-sheet) · [`#same`](lidd-v3.1-artboards.html#same) ·
  then in [`#prototype`](lidd-v3.1-artboards.html#prototype): Skip setup → + → Log like last time → Yes → Start attack → Undo

### Fix 3 — No auto-advance; Next everywhere, with the reason shown when it's disabled (F3)
- Every wizard step has a bottom Next. On optional steps it reads **Skip** until something is picked.
- When Next can't be used, the reason sits above it ("Tap where it hurts to continue",
  "Choose yes or not yet to start"), rather than a silent dead button.
- *Why:* predictable rhythm for impaired focus and motor control (§1, §8.3). User in control (§9.3).
- *Inspect:* [`#worse`](lidd-v3.1-artboards.html#worse) · [`#where`](lidd-v3.1-artboards.html#where) · [`#same`](lidd-v3.1-artboards.html#same)

### Fix 4 — Painted head map with orientation, plus a list fallback (F4)
- Regions (top, both foreheads, both temples, behind each eye) are painted SVG shapes. An unselected region has a dashed
  outline. A selected one is filled with a shade matching its pain and shows the number on top. Hit areas are ≥44 px.
- **YOUR RIGHT / YOUR LEFT** labels under the head. Back of head / Neck / All over sit as tiles below it.
- A **Head | List** toggle switches to a plain list of all 10 areas with their numbers, for VoiceOver users, large Dynamic Type or
  anyone who finds the map fiddly. Display settings note that at large text the map switches to the list automatically.
- *Why:* unilateral pain is an ICHD-3 criterion (§3), so laterality errors corrupt the clinical summary. §8.4
  requires reflow at 200 % without loss of function.
- *Inspect:* [`#where`](lidd-v3.1-artboards.html#where) · [`#where-list`](lidd-v3.1-artboards.html#where-list)

### Fix 5 — One 0–10 pain scale everywhere (F5)
- Head map grid, attack-mode "Pain now?", the 2-hour check-in, the attack Today stepper and Like last time all use
  **0 none · 10 worst**, shaded in the same colour ramp with the number always visible. Choosing 0 on an area removes it.
- *Why:* 2-hour **pain freedom** (0) is the standard endpoint (§5). Pain intensity has to be comparable across the
  diary (§6).
- *Inspect:* [`#where`](lidd-v3.1-artboards.html#where) · [`#checkin`](lidd-v3.1-artboards.html#checkin) ·
  [`#attack`](lidd-v3.1-artboards.html#attack) · [`#same`](lidd-v3.1-artboards.html#same)

### Fix 6 — Single choice vs multi choice look different; distinct icons; medication class badges (F6)
- **Single choice:** a radio ring in the corner that fills when picked (`role="radio"`). **Multi choice:** ✓ in the corner
  (`aria-pressed`). Selected tiles also get a thicker border, so nothing relies on colour alone.
- "The pain" (head icon) and "Stabbing" (bolt) now have different icons.
- Medications carry letter badges: **T** triptan · **C** combination · **P** simple painkiller · **G** gepant ·
  **–** nothing. The badges repeat on Today's med-day bars and in Insights.
- *Why:* §8.2 never conveys meaning by colour alone. Overuse thresholds differ by class (§3). The ACP 2025 combination
  therapy (triptan plus an NSAID or paracetamol) is logged by multi-selecting (§5).
- *Inspect:* [`#worse`](lidd-v3.1-artboards.html#worse) · [`#meds`](lidd-v3.1-artboards.html#meds) ·
  [`#display`](lidd-v3.1-artboards.html#display) · [`#today-warn`](lidd-v3.1-artboards.html#today-warn)

### Fix 7 — Overuse warning appears automatically; MBS relief added to outcomes (F7)
- At **8 of 10 triptan days** a warning card appears on Today, with copy based on §9.4: "Frequent use can sometimes lead to more
  headaches. Maybe worth a chat with your doctor." The bar turns amber, the dossier's muted warning colour.
  In the prototype the base is [7], so logging one Sumatriptan attack triggers it.
- The 2-hour check-in asks pain (0–10) and then, if the most bothersome symptom wasn't pain, "Is the light sensitivity
  better?" Insights shows **Pain-free** and **Worst part better** rows per medication class, as dots with a legend.
- The dose stepper on the meds step warns at more than 2 tablets in 24 hours.
- *Why:* §3 "warn users *before* overuse". §5 sets 2-hour pain freedom **and** MBS relief as the standard endpoints.
- *Inspect:* [`#today-warn`](lidd-v3.1-artboards.html#today-warn) · [`#checkin`](lidd-v3.1-artboards.html#checkin) ·
  [`#insights`](lidd-v3.1-artboards.html#insights) · [`#meds`](lidd-v3.1-artboards.html#meds)

### Fix 8 — States, edit/delete, consistent logs (F8)
- New **States** screen (Settings → Empty & error states) with four states:
  - Empty Logs: "Nothing logged yet / Add your first entry when you're ready."
  - Save failed: "That didn't save. Let's try again." + Retry.
  - Apple Health permission off: "You can still log it by hand."
  - Not enough data for Insights.
- **Attack detail:** Edit reopens the head map; **Delete** opens a confirm sheet, then an Undo toast.
- **Logs:** date headers, consistent "time · duration" titles, a peak-pain badge and a mini head showing the side. Merging overlaps
  shows a timeline, then "1 attack · nothing is lost", then Undo.
- *Why:* empty and error microcopy comes straight from §9.4. §9.3 says user in control, no blame.
- *Inspect:* [`#states`](lidd-v3.1-artboards.html#states) · [`#logs`](lidd-v3.1-artboards.html#logs) ·
  [`#detail`](lidd-v3.1-artboards.html#detail) · [`#delete`](lidd-v3.1-artboards.html#delete)

### Copy and polish pass
| Before (v3) | After (v3.1) | Reason |
|---|---|---|
| Woke | Woke up | Plain language (§9.3) |
| Earlier one | Log an earlier attack | Says what it does |
| Same as last time / Different | Log like last time / Something's different | Action-first, with a confirm step |
| Sensitive | Light-sensitive / Sound-sensitive | Specific (photophobia/phonophobia are separate ICHD-3 items, §3) |
| Aura: Vision / Words | Aura: Visual / Tingling / Speech | Matches ICHD-3 aura types (§3) |
| Dim things down? | Switch to attack mode? · "Dimmer, bigger, only the essentials" | Names the feature, explains it in 4 words |
| Pain / End (attack mode) | Update pain / End attack | Unambiguous (§9.5) |
| Patterns copy | "Appear after about 30 check-ins" + 12/30 ring | Honest about limits (§7, §11) |
| Info buttons 32 px | 44 px | §8.3 targets |
| — | Attack mode card in onboarding step 3 | Users learn it exists before they need it (§8.1) |

Two bugs found and fixed while exporting: the "Worst part better" label in Insights was cut off, and the 2-hour check-in
card showed immediately after starting an attack. It now appears after about 2 hours.

---

## 4. Artboards worth investigating further (priority order)

| Priority | Artboard | What to evaluate / open question |
|---|---|---|
| 1 | [`#prototype`](lidd-v3.1-artboards.html#prototype) | Run a timed task: "log an attack like last time, with medication" and "log a new left-sided attack". Target: ≤3 taps for the first and ≤6 for the second. Test in attack mode. |
| 2 | [`#where`](lidd-v3.1-artboards.html#where) | Region shapes and hit areas still need real-device testing. Does "YOUR RIGHT" on the left read correctly to users? (Mirror vs front view is a known confusion; consider testing a "looking at yourself" vs "looking at someone" framing.) Check shade contrast for numbers 1–3 on light and dark. |
| 3 | [`#same`](lidd-v3.1-artboards.html#same) | Is the confirm step light enough to keep the one-tap promise? Alternative: start immediately with a 10-second undo plus a med prompt. Validate with users. |
| 4 | [`#attack-mode`](lidd-v3.1-artboards.html#attack-mode) + [`#checkin`](lidd-v3.1-artboards.html#checkin) | Attack-mode type sizes against §8.3 (20–24 px body): elapsed and buttons pass, but the subtitle on the check-in is ~17 px. The in-app **dim/warm filter control** from §8.1 is still not designed. |
| 5 | [`#today-warn`](lidd-v3.1-artboards.html#today-warn) + [`#insights`](lidd-v3.1-artboards.html#insights) | Should the warning trigger at 8 (early) or only at 10 (the guideline threshold)? Simple painkillers need their own 15-day bar. Wording should be validated with a clinician. |
| 6 | [`#redflag`](lidd-v3.1-artboards.html#redflag) | SNOOP coverage: "new headache after 50" is missing. It's better captured as age at onboarding than as a checkbox. Should "Call 112" sit behind the "sudden / weakness" items only? |
| 7 | [`#where-list`](lidd-v3.1-artboards.html#where-list) | Each list row should open the 0–10 picker inline. Right now the picker is shared with the map view. Test with VoiceOver. |
| 8 | [`#states`](lidd-v3.1-artboards.html#states) + [`#logs`](lidd-v3.1-artboards.html#logs) | Extend states to Insights empty charts, Siri failures and offline sync. |

---

## 5. Still open after v3.1 (not yet designed or verified)

- **Dynamic Type 200 % reflow** (§8.4) is described, not demonstrated. Needs a board at an AX5 text size.
- **In-app dim / warm-filter control** (§8.1). Attack mode covers the theme but not brightness.
- **Reduce motion** handling (§8.4), shown nowhere yet.
- **MIDAS / HIT-6** check-ins (§6) still use placeholders. HIT-6 licensing has to be verified before using its items.
- **Preventive response metric:** a ≥50 % reduction in monthly migraine days (§5) is not yet in Insights.
- **Classification logic:** how a logged day becomes a *migraine day* vs a *headache day*, using ICHD-3 features from map, movement,
  nausea and light/sound (§3). This needs to be specified for the clinician report.
- **Cycle field** (§4) exists as an onboarding toggle and a "Period" factor tile, but has no cycle view.
- **Neuromodulation** is logged as a generic "Device" tile (§5). Named devices could come from medication settings.
- Pain-shade contrast was adjusted by eye (formula `10 + n·4 %` sage on surface). Run a numeric WCAG check on real tokens.

---

## 6. Key dossier references used

- §1 Problem framing: user symptomatic while logging; a tracker as an intervention
- §2 Four phases: early warning signs, aura, headache, after-phase
- §3 ICHD-3 fields, the 15-day chronic line, SNOOP, medication-overuse thresholds
- §5 ACP 2025 acute treatment; 2-hour pain freedom and MBS relief
- §6 MIDAS / HIT-6 and diary counts
- §7 Adherence and friction; forecasting framed cautiously
- §8 Accessibility: wavelength-aware palette, Lexend/Inter/Atkinson, 16 px body / 14 px floor, 44 px targets, attack-mode sizes, 200 % text
- §9 Tone: calm, validating, no streaks, undo, the microcopy table
- §10 Design tokens (used unchanged in v3.1)
