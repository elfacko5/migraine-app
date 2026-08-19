# Migraine Tracker App — Research Dossier

*A consolidated research reference for a portfolio case study. Compiled from clinical
guidelines, peer-reviewed studies, and accessibility standards to ground the app's product
and design decisions in evidence. Intended to be shared with Claude (or collaborators) as
source material for writing the case study.*

**Last compiled:** August 2026
**Scope:** clinical background · diagnosis · treatment · quality-of-life measures · digital-tool
evidence · accessibility (fonts, color, sizing) · tone, voice & UX copy · design tokens · design
rationale · sources.

> Note on sources: clinical claims below are drawn from named guidelines and studies (see
> Sources). Where evidence is preliminary or mixed, that is stated explicitly — useful for a
> case study that wants to show honest, evidence-led design reasoning rather than overclaiming.

---

## 1. Problem framing (for the case-study narrative)

Migraine is a common, disabling neurological disease — not "just a bad headache." It is
**cyclic and multi-phase**, and a large share of the patient burden (recall bias, missed
premonitory signs, medication overuse, disability) is exactly the kind of thing a well-designed
tracker can address. Two design tensions define the product:

1. **The user is often symptomatic while using the app.** During an attack they may have light
   sensitivity (photophobia), nausea, and impaired concentration. The interface must work at its
   users' worst moments, not just their best — this is the core accessibility thesis of the app.
2. **A tracker is potentially an intervention, not just a logbook.** Prospective diaries reduce
   recall bias, support diagnosis, flag medication overuse, and (per at least one RCT) can reduce
   migraine days. The design goal is to make daily capture low-friction enough that people
   actually sustain it.

---

## 2. The migraine model the app tracks (four phases)

Migraine attacks can unfold in up to four phases; each is a distinct tracking opportunity and a
reason the app captures more than "did you have a headache today."

- **Premonitory (prodrome)** — hours to ~2 days before pain. Yawning, food cravings, mood change,
  neck stiffness, fatigue, light sensitivity. Systematically under-reported from memory.
- **Aura** — ~one third of patients. Reversible visual/sensory/speech symptoms preceding or
  accompanying the headache.
- **Headache** — the pain phase.
- **Postdrome** — the "migraine hangover": fatigue, difficulty concentrating, lingering
  sensitivity.

**Design implication:** structure logging around phases and symptoms over time, not a single
binary daily flag. Capturing premonitory and postdrome data is where a prospective diary beats
recall.

---

## 3. Diagnosis — ICHD-3 criteria as data fields

The International Classification of Headache Disorders, 3rd edition (ICHD-3), is the diagnostic
gold standard. The app does not diagnose, but logging to these fields lets it produce a
criteria-aware summary a clinician can trust.

**Migraine without aura (1.1):** ≥5 attacks, each **4–72 hours** untreated, with **≥2 of 4** pain
features — unilateral, pulsating, moderate/severe intensity, aggravation by/avoidance of routine
activity — **and ≥1 of** nausea/vomiting **or** photophobia + phonophobia.

**Migraine with aura (1.2):** ≥2 attacks with fully reversible aura (visual, sensory,
speech/language, motor, brainstem, or retinal) and **≥3 of six** features including gradual spread
≥5 min, each symptom lasting 5–60 min, at least one unilateral symptom, at least one "positive"
symptom (e.g., scintillations, pins-and-needles), and headache within 60 min of aura.

**Chronic migraine (1.3):** headache on **≥15 days/month for >3 months, with ≥8 of those days
migrainous.** This 15-day line separates episodic from chronic migraine and drives treatment
eligibility — so the app's **monthly headache-day and monthly migraine-day counters are its most
important numbers.**

**Two safety-relevant fields:**
- **Red-flag ("SNOOP") symptoms** — thunderclap onset, new headache after age 50, neurological
  deficit, fever, marked pattern change — should trigger a "see a clinician" nudge, never
  reassurance.
- **Acute medication-use days** — medication-overuse headache is defined by frequency (roughly
  ≥10 days/month for triptans/combination analgesics; ≥15 for simple analgesics). Counting
  med-days lets the app warn users before overuse — a genuinely valuable, clinically grounded
  feature.

---

## 4. Triggers — track, but be honest about causality

Commonly reported triggers: stress (including the post-stress "let-down"), sleep disruption,
menstruation/hormonal change, skipped meals/dehydration, alcohol, weather/barometric change,
bright light. **Caveats worth reflecting in the design:** many "triggers" are hard to confirm;
some premonitory symptoms (food cravings, light sensitivity) are early *attack symptoms* mistaken
for causes; and trigger patterns are highly individual. Menstrual association is well-supported
enough to justify a dedicated cycle field.

**Design stance:** track candidate factors and surface *personal* correlations over time rather
than asserting universal triggers — and be careful not to encourage false-pattern-hunting or
unnecessary avoidance.

---

## 5. Treatment landscape (what users log)

**Acute treatment — 2025 ACP guideline (current anchor).** For moderate-to-severe attacks:
**combination therapy — a triptan plus an NSAID or acetaminophen, taken early.** Sumatriptan +
naproxen showed the greatest net benefit. Gepants (ubrogepant, rimegepant, zavegepant) and the
ditan lasmiditan are options — especially when triptans are contraindicated (e.g.,
cardiovascular disease) — but the guideline rated their evidence lower-certainty and flagged high
cost. **Log:** drug, dose, timing relative to onset, and **2-hour pain freedom / relief of most
bothersome symptom** (the standard trial efficacy endpoints).

**Prevention — 2024 American Headache Society position (major shift).** **CGRP-targeting therapies
are now first-line**; patients no longer must fail older preventives first. Covers monoclonal
antibodies (erenumab, fremanezumab, galcanezumab, eptinezumab) and oral gepants (atogepant,
rimegepant). Traditional preventives remain in use: topiramate, beta-blockers (e.g., propranolol),
amitriptyline, candesartan, and onabotulinumtoxinA (for chronic migraine). **Preventive success is
conventionally a ≥50% reduction in monthly migraine days** — make that a first-class metric.

**Neuromodulation (drug-free, growing).** Several FDA-cleared noninvasive devices for acute and/or
preventive use: Cefaly (external trigeminal), Nerivio (remote electrical neuromodulation — itself a
smartphone-app-controlled armband), gammaCore (vagus nerve), SAVI Dual (single-pulse TMS), Relivion.
Worth a logging category.

**Behavioral therapy (strong fit for an app).** A 2025 systematic review/meta-analysis supports
CBT, biofeedback, relaxation training, and mindfulness for reducing migraine frequency and
disability — interventions an app can deliver or reinforce (relaxation prompts, sleep-regularity
nudges, adherence tracking).

---

## 6. Outcome measures — build these in

Two validated instruments are the clinical/research standard, so supporting them makes the app's
data portable into care.

**MIDAS (Migraine Disability Assessment)** — 5 questions over 3 months on days of missed/reduced
work, chores, and social activity. Grades: **I minimal (0–5), II mild (6–10), III moderate (11–20),
IV severe (≥21).**

**HIT-6 (Headache Impact Test)** — 6 items, scored **36–78: ≤49 little/no impact, 50–55 moderate,
56–59 substantial, ≥60 severe.**

**Caveat (2026 REFORM study):** questionnaires and prospective diaries don't always agree on
treatment response — so track **both** objective diary counts (monthly migraine days, headache
days, med-days, pain intensity) *and* periodic MIDAS/HIT-6 check-ins.

---

## 7. Digital tools & tracker evidence (most directly relevant)

- **Prospective smartphone diaries reduce recall bias.** Comparisons of app diaries to clinical
  interviews show meaningful discrepancies, favoring daily prospective capture.
- **A tracker can be an intervention.** A randomized trial of a *prescribed* digital health app
  showed a reduction in monthly migraine days; Germany's DiGA regulatory pathway has made
  prescribable migraine apps a real category.
- **Adherence is the make-or-break constraint.** High daily-entry burden kills sustained use — so
  minimize friction (fast check-in, sensible defaults, wearable auto-capture).
- **Attack forecasting is a research frontier — frame cautiously.** A representative machine-learning
  study combining phone-diary variables with simple wearable signals (heart rate, skin temperature,
  muscle tension, sleep) reached only ~0.62 AUC on a small sample: proof-of-concept, not clinically
  reliable. 2025 reviews describe wearables, digital biomarkers, and ML forecasting as promising but
  early. **Credible v1 = personal analytics and correlation surfacing; forecasting is aspirational,
  not a headline claim.**

---

## 8. Accessibility — the app's differentiating design thesis

### 8.1 Color and light sensitivity (the key migraine-specific insight)

Not all light is equal for migraine photophobia, and the effect is **wavelength-specific, not just
brightness.** Harvard/Burstein research (Nature Neuroscience) found that **blue, amber, red, and
white light intensified headache in ~80% of patients at normal screen/office brightness, while
low-intensity green (~530 nm) was the exception** — least photophobic and even modestly
pain-reducing (~20%). This maps to the melanopsin / intrinsically-photosensitive retinal ganglion
cell pathway and is the same science behind FL-41 "rose" tinted lenses (which filter the ~480 nm
blue-green band).

**Translated to palette rules:**
- Avoid saturated **blue** and pure **white** as dominant surfaces (worst for the photophobia
  pathway; large white fields at phone brightness = high-intensity broadband light).
- Bias toward **warm-neutral, low-saturation, muted tones** — "candlelight, not daylight."
- Use **low-saturation, low-luminance green** as the safest accent (a soft sage, not a bright lime).
  Don't over-read the therapy result — a phone can't reproduce narrow-band therapeutic light; the
  point is to *avoid the aggravating colors* and keep accents calm.
- Keep contrast **sufficient but not maximal.** Pure black on pure white is the harshest pairing.
  Hit WCAG AA (4.5:1 body) but pull both ends inward. *High contrast helps legibility; harsh
  contrast triggers discomfort — that tension is the core balancing act.*

**Dark mode:** offer it, but don't treat it as the fix. Evidence is mixed — user *preference* leans
dark for photophobia (~63% in one analysis), but controlled studies found no reliable
headache/eye-strain difference, and poorly-built dark themes can worsen symptoms. Best practice:
ship warm light + true dark + a **dedicated low-brightness "attack mode,"** plus an **in-app
brightness/dim and warm-filter control** rather than relying on OS settings mid-attack.

### 8.2 Fonts

Recommended, in order of relevance:
- **Lexend** (free, Google Fonts) — **primary.** Engineered to improve reading fluency and reduce
  visual stress; modern, rounded, high x-height, clear at small sizes and low brightness.
- **Inter** (free) — **fallback / alternative primary.** The de-facto modern app UI face: large
  x-height, open apertures, highly legible on screen. Enable its "disambiguation" stylistic set so
  l / I / 1 stay distinct.
- **IBM Plex Sans** — warmer, characterful middle ground; very readable, broad language support.
- **Atkinson Hyperlegible** (free, Braille Institute) — maximum character distinction; offer as an
  optional in-app accessibility toggle for users who want it (its look is polarizing, so not the
  default here).
- Safe fallbacks: **Open Sans, Source Sans, Verdana**; system fonts (SF Pro / Roboto).

Rules: **sans-serif for body; minimum weight 400 (no thin/light weights — they shimmer for
light-sensitive eyes); line height ~1.5; line length 50–75 characters; never convey meaning by
color alone** (some users view through tinted lenses). Skip OpenDyslexic as the default (weak
evidence). Recommended stack: **primary Lexend, fallback Inter, optional Atkinson Hyperlegible.**

### 8.3 Font sizes

**Regular use (mobile):** body **16px minimum** (17–18px preferred; also avoids mobile auto-zoom);
caption **14px floor**; headings ~20–28px+; line height 1.5; touch targets ≥44×44px (iOS) /
48×48dp (Android).

**Attack mode:** body **~20–24px**, key inputs larger; fewer elements per screen; larger tap
targets; minimal text/typing; auto-dimmed warm low-contrast theme; reduced motion. Goal: log an
attack in a couple of big taps.

### 8.4 Text-scaling function

- **Respect OS accessibility text settings** (iOS Dynamic Type, Android font scale). Use scalable
  units (sp / Dynamic Type / rem) so the whole layout responds to one source of truth; layer an
  optional in-app slider on top.
- **WCAG 1.4.4:** text must scale to **≥200% without loss of content or function** — test at 200%+,
  use reflowing layouts, avoid fixed-height text containers. Support roughly **85%–200%** of base;
  attack-mode default near the larger end. Preserve the 1.5 line-height *ratio* as text scales.
- Respect OS "reduce motion" (motion/flashing worsen migraine).

---

## 9. Tone, voice & UX copy

The copy talks to someone who may be in pain, nauseated, and cognitively taxed. For a health
tracker this is as important as the visual design. Two evidence bases apply: **trauma-informed
content design** (safety, trust, choice, control, empowerment, no blame) and the **chronic-illness
"toxic positivity"** literature (relentless cheerfulness invalidates lived experience and is
actively harmful to people in chronic pain).

### 9.1 Core tension: supportive without false cheer

The target voice is **calm, plain, matter-of-fact, and validating** — it witnesses the experience
without performing emotion about it. "Great job! 🎉" after a 9/10 attack reads as tone-deaf; grim
or clinical-cold is also wrong. Aim for the steady, kind register of a good nurse.

### 9.2 Gamification caveat (important for a tracker)

Streaks, badges, and "congratulations" mechanics backfire here: a user must **never** feel they
"failed" or "broke a streak" because they had more migraines, and pain days must not be celebrated.
**Reward the logging habit, never the health outcome.** This is a defining, portfolio-worthy design
decision.

### 9.3 Voice principles

- **Calm and plain, never alarmist.** Short sentences, everyday words — cognitive load is real.
- **Validating, not cheerful.** Acknowledge difficulty neutrally; don't force optimism/gratitude.
- **Person-first, non-judgmental.** "You" / "your migraine"; never imply fault ("you forgot,"
  "you missed"). Avoid catastrophizing pain words.
- **User in control, low pressure.** Choice, graceful exits, easy skip/undo, no guilt in reminders,
  no dark patterns.
- **Honest and transparent**, especially about health data — say plainly why you collect something.
- **Supportive, not diagnostic.** The app observes and reflects; it never tells someone what's wrong.

### 9.4 Microcopy — do / don't for key moments

| Moment | Do | Don't |
|---|---|---|
| Log an attack | "How's the pain right now?" · "Saved. Rest up." | "Tell us all about your migraine!" · "Awesome, complete! 🎉" |
| Reminder | "A quick check-in when you're ready." · "No rush." | "You haven't logged today!" · "Don't break your streak!" |
| Habit reinforcement | "You've checked in 5 days this week — a clearer picture for you and your doctor." | "5 migraine-free days, keep it up!" |
| Empty state | "Nothing logged yet. Add your first entry when you're ready — it only takes a moment." | "No data!" |
| Error | "That didn't save — let's try again." · "Something went wrong on our end." | "Invalid entry." · "You did that wrong." |
| Med-overuse warning | "You've logged acute medication on 10 days this month. Frequent use can sometimes lead to more headaches — it may be worth a chat with your doctor." | Fear-based or scolding language |
| Red-flag / SNOOP nudge | "Some of what you described can have other causes. It's a good idea to check in with a healthcare professional." | Alarmist or diagnostic phrasing |
| Insight / correlation | "On days you logged poor sleep, you were more likely to record a migraine. This is a personal pattern, not a definite cause." | "Poor sleep causes your migraines." |

### 9.5 Copy as an accessibility feature

Plain language and short structure are cognitive-accessibility features, not just tone. **The deeper
someone is into an attack, the shorter and simpler the copy should get** — attack mode strips labels
to essentials, uses large plain buttons, and avoids anything requiring careful reading. The
tone system and the text-scaling / attack-mode system are the same idea expressed two ways.

---

## 10. Design tokens (starting values — tune on real screens)

Warm, low-saturation palette; never pure #FFF or #000; green accents kept low-saturation.

**Light theme (default, warm)**
```
--bg:         #F5F2EC   /* warm off-white, never #FFF */
--surface:    #ECE7DD
--text:       #2A2724   /* dark warm gray, never #000 */
--text-muted: #6B655C
--accent:     #6E8B74   /* muted sage green (safest hue) */
--accent-soft:#A9BFAD
--border:     #D8D2C6
--warning:    #B07A3C   /* muted amber, sparingly */
--danger:     #A65A52   /* desaturated terracotta, not bright red */
```

**Dark theme (true dark, not pure black)**
```
--bg:         #1B1A18   /* warm charcoal */
--surface:    #262421
--text:       #E4DFD6   /* soft off-white, never #FFF */
--text-muted: #A39D92
--accent:     #7FA187
--border:     #3A3733
```

**Attack mode (auto-dim, ultra-low stimulation)**
```
--bg:      #14140F
--surface: #1E1E17
--text:    #C9C4B8   /* low-contrast soft; avoid harsh white-on-black */
--accent:  #7FA187
/* + reduce brightness, disable animation, enlarge type, minimal UI */
```

**Font stack:** primary **Lexend**, fallback **Inter** (enable disambiguation set), optional
**Atkinson Hyperlegible** toggle.
**Type scale (mobile base):** body 16–18px · caption 14px · H3 20 / H2 24 / H1 28+ ·
line-height 1.5 · attack-mode body 20–24px.

---

## 11. Case-study talking points (design rationale in one place)

- **"Designed for the worst moment, not the best."** Photophobia, nausea, and impaired focus during
  attacks drove an attack mode, warm low-stimulation palette, and large low-friction inputs.
- **"Evidence over convention."** Standard app design defaults to white backgrounds and saturated
  blue accents — precisely the wavelengths migraine research flags as aggravating. The palette is a
  deliberate, sourced departure.
- **"Honest about limits."** Forecasting is framed as personal correlation, not prediction, because
  current ML evidence is proof-of-concept only. Trigger insights are surfaced as personal patterns,
  not universal claims.
- **"Clinically portable data."** Logging to ICHD-3 fields and supporting MIDAS/HIT-6 means the
  app's output is meaningful to a clinician, and med-day counting adds a safety feature (overuse
  warning) grounded in guideline definitions.
- **"Accessibility as the core thesis, not a checkbox."** OS-respecting text scaling, WCAG 200%
  reflow, legible typography (Lexend), and reduced-motion support are foundational rather than
  added late.
- **"The words are part of the care."** Trauma-informed, validating copy — and the deliberate choice
  to reward the *logging habit* rather than *health outcomes* — means the app never makes a user in
  pain feel judged, failed, or falsely cheered.

---

## Sources

Diagnosis (ICHD-3): https://ichd-3.org/1-migraine/1-1-migraine-without-aura/ ·
https://ichd-3.org/1-migraine/1-2-migraine-with-aura/ · https://medicalcriteria.com/web/migraine/

Prevention (AHS 2024, CGRP first-line):
https://americanmigrainefoundation.org/resource-library/american-headache-society-issues-new-migraine-prevention-guidance-related-to-cgrp-targeting-therapies/ ·
https://headachejournal.onlinelibrary.wiley.com/doi/10.1111/head.14692

Acute treatment (ACP 2025):
https://www.hcplive.com/view/new-acp-guidelines-recommend-adding-triptan-to-nsaid-or-acetaminophen-for-migraines ·
https://www.acpjournals.org/doi/10.7326/ANNALS-24-03095

Neuromodulation devices:
https://practicalneurology.com/diseases-diagnoses/headache-pain/update-on-noninvasive-neuromodulation-devices-for-headache-treatment/32129/

Behavioral interventions (2025 meta-analysis):
https://headachejournal.onlinelibrary.wiley.com/doi/10.1111/head.14914

Outcome measures (MIDAS / HIT-6):
https://resref.com/midas-migraine-disability-assessment/ ·
https://www.droracle.ai/articles/720486/how-do-you-interpret-the-headache-impact-test-hit-6

Digital tools / tracker evidence:
https://pubmed.ncbi.nlm.nih.gov/40137454/ (smartphone diaries vs interviews) ·
https://pubmed.ncbi.nlm.nih.gov/40591361/ (prescribed digital app RCT) ·
https://journals.sagepub.com/doi/10.1177/03331024231169244 (ML forecasting) ·
https://www.ovid.com/journals/cepha/fulltext/10.1177/03331024251401232~2025-highlights-in-digital-technology-in-headache

Light sensitivity / color science:
https://www.sciencedaily.com/releases/2016/05/160517083042.htm ·
https://hms.harvard.edu/news/green-light-migraine-relief ·
https://healthcare.utah.edu/moran/optometry/fl41-lenses ·
https://www.theraspecs.com/blog/dark-mode-for-headaches-eye-strain-light-sensitivity/

Accessibility (fonts, color, sizing):
https://www.webability.io/blog/most-accessible-fonts ·
https://www.iubenda.com/en/help/182497-most-accessible-fonts/ ·
https://www.a11y-collective.com/blog/wcag-minimum-font-size/ ·
https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/ ·
https://www.boia.org/blog/web-design-mistakes-that-impact-light-sensitive-users

Tone, voice & UX copy:
https://www.galaxyux.studio/blog/trauma-informed-ux-writing/ (trauma-informed UX writing) ·
https://uxcontent.com/a-guide-to-trauma-informed-content-design/ (trauma-informed content design) ·
https://creakyjoints.org/living-with-arthritis/mental-health/keep-complaining-toxic-positivity/ (toxic positivity & chronic illness) ·
https://www.bezzypsa.com/discover/living-well-psa/health-resisting-the-lure-of-toxic-positivity-while-chronically-ill/ ·
https://aci.health.nsw.gov.au/chronic-pain/health-professionals/positive-language (positive language in chronic pain) ·
https://medium.com/@rounakbajoriastar/ux-writing-for-empty-states-errors-and-success-messages-tiny-texts-big-impact-70559a28306d (empty/error/success microcopy) ·
https://www.uxpin.com/studio/blog/ultimate-guide-to-error-messaging-accessibility/ (accessible error messages) ·
https://link.springer.com/chapter/10.1007/978-3-031-85575-7_5 (gamifying chronic-pain mHealth — do's and don'ts)

*Disclaimer: research reference for product/design purposes, not medical advice. Verify clinical
details against primary sources before any health-related claim in published material.*
