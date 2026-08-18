# Decision log

Why things are the way they are, and what was tried and rejected. `CLAUDE.md` covers *how* each piece works; this is the record of the calls behind them, so they don't get re-litigated or accidentally reverted.

## Platform

- **Wrap the existing web app with Capacitor rather than rewrite it.** The two things that justified going native — reminders surviving a force-quit, and real Siri App Intents — are both reachable from a wrapped app, and ~90% of the codebase (data model, hooks, stats, sync, every component) carries over untouched. *Rejected:* a React Native rewrite (business logic ports, but every component and the hand-inlined head-diagram SVG get rebuilt) and a SwiftUI rewrite (cleanest long-term, but re-derives everything in this file by hand — months, for a personal app whose value is the data model, not the chrome).
- **The PWA stays alive alongside the native build.** It's still how the app is developed and how the browser tooling exercises it, and it's the fallback if the native track is ever abandoned. Anything that must differ branches on `Capacitor.isNativePlatform()` at runtime; nothing is forked.
- **The App Store is not a goal yet.** If it becomes one, the bundle identifier needs settling deliberately first (it's permanent per app record — see below), and Apple's requirements bite on *behaviour*, not on the framework: an in-app account-deletion path, since Supabase sign-in creates accounts, plus a hosted privacy policy and accurate health-data declarations. Sign in with Apple is *not* triggered by email/OTP sign-in.

## Distribution and signing

- **Free provisioning, not the paid account.** It covers everything worth testing on device — local notifications need no entitlement, only *remote* push does. The cost is a 7-day expiry. *Revisit if:* TestFlight becomes useful (sharing with others, or installing without a cable during an actual migraine, when plugging into a laptop is the last thing anyone wants).
- **Bundle id is `com.sunny.migrainetracker2`.** The `2` is not meaningful — the original id could not be registered, and renaming was the fastest way past it. Worth settling deliberately before any Store submission.

## Voice logging

- **No in-app microphone.** iOS Safari doesn't implement the Web Speech API, so a mic button would silently do nothing on the one platform this ships to. Voice therefore always comes from Siri, which does its own dictation.
- **The Shortcut deep link came first and stays.** It was the only option before the native shell, and it's still the only option on the PWA. The App Intent is the native upgrade, not a replacement — both converge on one handler.
- **Neither path writes an attack directly; both hand over a transcript.** Native code can't reach `localStorage` inside the WebView. Even if it could, the wizard still opening for review is the right behaviour: the parser is fuzzy, and silently saving a misheard reading into health data is worse than making the user tap through.
- **The parser is deliberately dumb** — substring/prefix matching over the user's own chip lists, not NLP, and the raw transcript is always kept verbatim as the note. A cleverer parser that silently drops what it doesn't understand would be worse than an obvious one whose guesses are visible in the prefill banner.
- **The wizard still opens, but a complete voice entry is one tap from saved.** Siri cutting the user off is normal, not exceptional, so the answer is to make an incomplete parse visibly incomplete rather than to trust it — the banner distinguishes a heard severity from an invented one, and the one-tap save is withheld until an invented one has been seen. *Rejected:* auto-saving a voice entry outright (the parser is fuzzy and this is a health record) and dropping the default severity so `areas` could hold "unset" (it ripples through every consumer of `snapshot.areas` for one input path).

#### From the 2026-08-14 device tests

Six rounds of "say a sentence into Siri, read the review screen" on a real phone. Every one of these was a real transcript the parser got wrong, not a hypothetical; the mechanics are in the voice-parsing bullets above, and these are the calls behind them.

- **"Honest about what it heard" cuts both ways.** The rule was always *never print a guess as a fact*; the review screen was breaking its mirror image — printing a fact as a guess. One unrated area drove every row to "no severity heard" while the transcript quoted underneath plainly contained the numbers. Marking a real answer unheard devalues the marker by crying wolf, so `severityHeardFor` is per-area and only the one-tap save gates on the all-areas flag. *Rejected:* leaving the single flag and softening the wording — the wording wasn't wrong, the claim was.
- **A dose without a name is still a dose.** Dictation drops drug names constantly ("one tablet of **Treo** this morning" → "one tablet of this morning"), and rejecting the name used to discard the whole event, its timestamp with it. Quantity and form alone are unambiguous, so the dose survives unnamed and keeps its time; `LogForm` shows it as *Unnamed*. Losing a medication event out of a health record is worse than an obviously blank field, and a blank name is visibly blank in a way a wrong time is not.
- **A guess is refused where two readings are equally likely, even though it costs a timestamp.** "One tablet at 10" against an attack with no pinned start could be 10:00 today or 22:00 yesterday, so `resolveBareHour` returns null and the dose reads "no time given". Same principle as the start time refusing a bare hour. *Not yet decided:* whether to prefer the more recent candidate — it's a one-line change if the blank turns out to annoy more than a wrong time would.
- **A drug name is only ever corrected against the user's own history.** "Treo" came back as "dry" and as "trip"; neither shares a first letter, so `correctAgainstHistory` rejects both and the spoken word stands. Widening the match to catch them would let it rewrite names it has no business touching. The name self-corrects once the drug has been logged manually a single time, which is the intended path.
- **English word order beats raw proximity for side words** (`BACKWARD_PENALTY`). Nearest-wins gave "left side of the jaw" to the *eye* seven characters behind it, which then held two contradictory sides and selected both — turning two explicitly-sided areas into four, two of them carrying severities nobody stated for them.
- **The fourth Siri question is asked unconditionally, which is the second-best design.** The user's own proposal — ask "anything more?" only when the third question got an answer — is better, and needs a `requestValue` inside `perform()`. This file already records that silently failing to prompt once `openAppWhenRun` is set; a required parameter is the only prompt that reliably happens. One extra one-word answer is the accepted cost. *Revisit if* App Intents ever makes conditional prompting dependable.

## Notifications

- **Both backends stay live** (OS-scheduled natively, service worker on web) behind one pair of function signatures, so `useAttacks` never branches on platform.
- **"No change" and "Snooze" are handled in Swift; only "Something changed" opens the app.** All three opened it for a while, because they were handled in JavaScript and a background action does nothing once the app has been evicted — which is exactly when a reminder is most likely to be answered. Native handling removes the trade rather than picking a side of it. *Rejected:* leaving them foreground (the app-opening is the whole annoyance) and having the drain schedule the follow-up reminder instead of the native handler (the chain would stall for however long the app stayed closed, which is the case this is for).
- **The app owns the `UNUserNotificationCenter` delegate rather than Capacitor.** Not a preference: Capacitor installs its router after launch finishes, and iOS requires the delegate during launch. Everything the web layer still needs is forwarded to Capacitor's router by hand.
- **A no-change reading is queued, never written natively, and keeps its tap time.** Native code can't reach `localStorage`. Stamping it at drain time was the obvious shortcut and is wrong — the reading's whole meaning is *when* severity was still holding.
- **Every answer goes through the queue, even the one that opens the app.** "Something changed" was delivered live through Capacitor's notification listener at first, since it foregrounds the app anyway. It silently did nothing on device — the second time this same button had failed for a timing reason nobody can see from the JavaScript side. *Rejected:* finding and fixing the broken link (it is past the points that could be measured, and needs a device to exercise at all) and retrying the forward until it lands (still a live-delivery dependency, just a more complicated one). The queue makes late delivery the worst case instead of no delivery.
- **Web queues through the same key instead of writing directly.** It doesn't need to, but it keeps `App.tsx` on one code path, and `@capacitor/preferences` already spans both platforms.
- **The body states an absolute clock time.** It's composed at schedule time but read whenever the user gets to it, so anything relative is a lie by the time it's seen.
- **Permission is requested before anything is scheduled**, because iOS accepts a request made while permission is undecided and then never delivers it. The request is wrapped so a failure can't cost the user the log entry.

## Layout and viewport

- **The shell is pinned to the visible region** (`--app-height` + `--app-offset`), which is the third approach tried. *Rejected:* sizing it to `visualViewport.height` alone (subtracts the keyboard twice when WebKit has offset, stranding the nav mid-screen), and keeping it full height and relying on WebKit's offset (fails when WebKit *hasn't* offset — a focused field that's already visible leaves the nav under the keyboard until an unrelated scroll snaps it into place).
- **Pinch-zoom is disabled via the viewport meta** to stop WKWebView's focus-zoom wrecking the fixed shell. iOS Safari has ignored those directives since iOS 10, so the PWA keeps pinch-zoom and loses no accessibility; the app's own text-size control is the intended way to enlarge type.
- **Trackpad scrolling in the Simulator is left broken.** Making it work would mean letting the document scroll instead of a nested container — reverting the architecture this file exists to protect. Real devices only produce touch, which works.

## Visual design (2026-08-14)

The Today tab was rebuilt from supplied mockups. The mechanics are under "The Today hero cards"; these are the calls.

- **One `HomeCard` for both states, not two components.** Attack-free and ongoing are the same object saying different things, and building them separately is how they drift apart. It also forced the useful question of what the ongoing card's *headline* is — "Started 3m", the thing you actually want at a glance, rather than a severity badge.
- **The artwork sits behind a gradient rather than in its own panel.** A left-to-right fade from the card's own surface colour is what makes it read as one card instead of an image glued to a box. The stops are weighted towards the text, and that's the tiebreak whenever they conflict: this is read mid-migraine, so contrast under the headline beats showing more of the picture.
- **Severity is stated as "Pain severity: 9", not colour-coded.** The old severity-tinted number and card border stopped working the moment there was artwork behind them — a coloured number on an illustration reads as part of the illustration. Plain text also makes the ongoing and attack-free cards structurally identical, which is what lets them swap without the eye having to re-learn the layout.
- **Images are imported from `src/assets`, not served from `public/`.** Vite fingerprints them; a `public/` file keeps its filename forever and the service worker would happily serve last month's artwork after a swap. They're also re-encoded (1.9 MB → 62 kB) because this is an offline-first PWA that bundles everything it ships.
- **The ongoing card opens `AttackDetail` from its text block.** The whole card can't be the tap target once buttons live inside it, and nesting a button in a button is invalid. *Rejected:* a third "Details" button — clutter on a card whose entire job is to be glanceable.
- **The top bar has no divider and says "Hello".** The content below is the same colour, so the line only made the bar look like chrome bolted above the page; `backdrop-blur` still separates scrolled content from the title. "Hello" because the user knows which app they opened, and Today is the one tab with no list to name itself after.
- **Tab titles are 34px, expressed in `rem`.** A `px` value would make the largest type on screen the one thing that ignores the app's own text-size control, which is backwards for an accessibility feature that exists for people who can't read small text during an attack. The header uses `min-h` so it grows instead of clipping at the bigger scales (46.75px at `xl`). Only the four tab titles — the wizard's step headings were explicitly left alone.

Refined against the device and a supplied spec, in that order:

- **Spacing came from a spec, not from taste, and the gaps are uneven on purpose.** 24px sides, 32px top/bottom, then 4/16/24 down the stack. The label is a kicker belonging to the headline and sits tight to it; the detail line is a separate fact and doesn't. An even stack left the label floating between the two, which is what made the first attempt feel wrong without being obviously wrong.
- **Button radius is `rounded-xl` (12px), left in `rem`.** Same reasoning as the titles: the text-size control grows the buttons, and a pinned `[12px]` would read tighter as they get bigger. It's also the radius ~36 other buttons already use, so the card stopped being the odd one out.
- **The gradient's opaque stop must sit past the image's left edge.** The image is a hard-edged box; wherever the gradient has already begun fading at that edge, flat card colour meets artwork in one step and a seam runs down the card. Cost a round to spot, because moving the image and the gradient felt like one change and is two.
- **Which edge of the artwork survives the crop is per-card (`imageAnchor`), not global.** It depends entirely on where the subject sits in that source and how much dead margin surrounds it. Encoding a per-image judgement as one shared constant is how the next artwork swap silently breaks the other card — which nearly happened when the trimmed ongoing art inverted the correct answer.
- **The headline never wraps.** It overflows the text column onto the artwork instead, because it is the one line that has to land at a glance, and a two-line "Started 24h 38m" grew the card for nothing. Verified at the largest text scale, where it still clears the card edge.
- **Live durations tick on resume, not just on a timer** (`useNowTick`). An interval alone looks right and is wrong on iOS, which suspends a backgrounded page's timers while keeping the page alive — the card then paints a stopped clock. Worth treating as a class of bug rather than three patches, since it applies to anything deriving a duration from `Date.now()` at render.

## Screen polish (2026-08-17)

From a device pass over the logging flows. One theme runs through all of it: **a default must never assert something the user didn't say, and a control must never hide the reason it can't be used.**

- **The update-time picker defaults to now, not to the last reading.** The old default quietly claimed a reading had happened at the attack's start. Every default asserts something, so the question is only which assertion is least wrong — and "the moment you opened this sheet" is the one the user can actually verify at a glance. Same family as the invented-severity and defaulted-start-time rules.
- **"Finish now" is shown disabled rather than hidden.** Appearing only once pain areas were set meant nobody who hadn't already found the shortcut ever would. A greyed control says both that the way out exists and that something is missing; an absent one says nothing. *Rejected:* leaving it hidden and relying on the footer's Next, which is what people were doing the long way round.
- **The Front/Back toggle is a segmented control, not two buttons.** At button weight it read as "press this to continue" — competing with the actual primary action on the same screen — rather than as a switch between two views of one step.
- **The last-entry note is boxed but colourless.** Boxing it stops it reading as a caption belonging to the picker above it. Leaving it untinted is the deliberate half: the supplied example was a blue info panel, and beyond the no-blue palette rule, tinting would draw the eye to the one element on the step that isn't actionable. It's context for the reading being entered, not a message about it.
- **Delete moved from the footer to the top bar.** It was one mis-tap from the primary action. Destructive actions get distance, not just a confirm dialog — though it keeps the dialog too.
- **"Edit details" is specified but deliberately unbuilt.** It needs a decision about whether snapshots become mutable, which is a data-model question rather than a UI one — a snapshot currently means "the state at that time", and editing one rewrites history. Parked at the user's request; Add update holds the primary slot on past attacks meanwhile, rather than shipping a button that does nothing. It likely wants settling together with the summary screen's per-section edits (see Known gaps), since both are "change one part of an existing record".

## Records, filters and impact (2026-08-18)

A pass over the Logs list, the Insights page and where `impact` gets asked. The
theme: **a screen that is scanned and a screen that is read want different
things on them**, and colour in this app carries meaning, so it can't be spent
decoratively.

- **The Logs card carries symptoms and not triggers.** Nausea/vomiting and
  photophobia + phonophobia are ICHD-3 criterion C — part of what makes an
  attack migraine rather than headache — while §4 of the dossier is a warning
  about triggers specifically: many can't be confirmed, some are premonitory
  symptoms mistaken for causes, and prominence invites the false-pattern
  hunting it says to avoid. Chips for triggers and nothing for symptoms
  promoted the speculative field over the diagnostic one. Triggers are still
  recorded and still shown in `AttackDetail`.
- **Impact left the end-attack dialog.** Carrying two questions and six
  controls made it a form in an alert's shell, which is what neither HIG nor
  Material wants in a modal, and it forced a judgement about the whole episode
  into the same tap as closing it down. *Rejected:* two sequential dialogs —
  the second modal is the pattern both guidelines dislike, and arriving
  unbidden in postdrome is the worst moment for it.
- **Impact is offered for 24h after an attack ends, then never again.** The
  prompt is its own card on Today; `AttackDetail` shows the answer read-only
  and shows nothing at all when unanswered. **A late answer is the bad
  outcome, not the missing one**: a day later it's reconstruction, which is the
  recall bias a prospective diary exists to avoid, and a badly remembered "2"
  counts in the disability figures where an absent one doesn't. The window
  closing by itself is also why dismissal needs no persistence — no new
  `localStorage` key, no `Attack` field, no migration. **The cost is accepted,
  not overlooked:** a missed prompt means that attack is unanswered forever and
  a mis-tap can't be corrected.
- **Filter options come only from sets the product defines** — severity bands,
  impact levels, treated/untreated, `PAIN_AREAS`, onset. Never free text: the
  medication filter was offering "Dry", the mis-parsed tail of a retired entry,
  as a drug to filter by. Open text grows forever and arrives mis-dictated.
  Treated/untreated answers the medication question inside a closed set, and is
  the more useful form anyway since ICHD-3's 4–72h duration criterion is
  defined for *untreated* attacks.
- **Filter and sort share one sheet reached by one button.** They were two
  buttons opening the same sheet — two affordances with one outcome, which is a
  false affordance however tidy. They are genuinely different operations and
  with two or three sort options would deserve separate controls; with five and
  no menu primitive here, one sheet is honest. Combining costs one thing and it
  is paid for: a non-default sort shows as a removable chip, so the current
  order is readable without opening anything.
- **Selection is a tint, never the solid accent fill.** Solid accent means
  *action* — `btn-primary`, the FAB. Half the app already worked this way
  (`ChipSelector`, `MedicationInput`, the impact pills) while seven controls
  did not, which is why one End-attack dialog showed a solid time preset above
  tinted impact pills. Neither iOS nor Material uses the primary colour for a
  selected state. Now one rule in `src/utils/chipStyles.ts`.
- **Both states of a toggleable chip carry a `ring`, never a `border`.** A ring
  is a box-shadow and takes no layout space; a border does. Mixing them made
  the unselected pill 2px taller — invisible in a flex row where siblings
  stretch, obvious on a control sitting alone, which is how the "Woke up with
  this migraine" toggle was caught changing height as it toggled.
- **Three constants had each been hand-copied into three files, and two of the
  three had drifted.** The severity ramp used `<= 8` for the middle band in the
  Logs badge and the timeline row against `<= 7` in `sevFill`, so a severity 8
  rendered amber in two places and terracotta everywhere else; the impact
  labels existed in two versions with different wording. They are now
  `src/utils/severity.ts`, `src/utils/impact.ts` and `src/utils/chipStyles.ts`.
  **A shared value in this codebase gets a module, not a copy** — this has now
  happened three times.
- **The Logs sparkline was green regardless of severity.** Its stroke was a
  fixed `#9bb9a1`, within a few points of the app's own low-severity colour, so
  a peak-10 attack drew a terracotta badge beside a green line and the row
  contradicted itself. It takes `sevFill` of the figure it plots. Its y-domain
  is pinned to `[0, 10]` for the same class of reason: unpinned, Recharts fit
  each attack to its own range, so a 3→4 run drew the same slope as 2→9 on a
  page whose purpose is comparing rows.
- **Medication timing lives on the detail sheet, not the card.** "Taken early"
  is the most actionable fact about acute treatment (§5), but it is read rather
  than glanced at, and a duration in a chip is a question nobody asked of a
  scanned row. Both cases are labelled — "after 4h 59m" or **"at onset"** —
  because showing nothing for a dose on the first reading read as missing data
  when it is in fact the most useful answer.
- **Insights opens on 30 days, Logs on 7.** Every figure on Insights is monthly
  — the overuse thresholds, the 15-day episodic/chronic line — so a 7-day
  window showed an empty page to someone with a perfectly ordinary number of
  attacks. "What happened recently" and "what does my month look like" are
  different questions.

## Medication guardrails (2026-08-18)

Built as specced below in "Planned, agreed, not built", which stays as the
record of what was decided before any of it existed. What shipped, and the
three things worth knowing that only came out in the building:

- **`checkDose` answers "where would this dose sit", and nothing else.** It
  returns findings, never permission. Every call site states the number and
  saves anyway: if four tablets were taken, the diary has to be able to say
  four, and a tracker that refuses the truth stops being a record. The wording
  is the user's own figure restated — "you entered a 2-hour gap between doses
  — the next one falls at 23:32" — never an instruction.
- **The last-entry caption computes its gap directly, not through
  `checkDose`.** They look like the same question and aren't: `checkDose` asks
  where a dose being logged *now* sits, so it looks for the most recent dose
  before that moment, which is a different reading from the one the caption is
  about. Written the obvious way first, it silently produced no gap at all.
- **`Date.now()` is read inside `medGuardrails`, not by the components.**
  `unitsInWindow`, `lastDoseAt` and `checkDose` all default their timestamp,
  which keeps the rolling figure honest *and* keeps the impure call out of a
  component's render — the lint baseline is 9 and a new entry in it would hide
  the next real one. `TodaySummary` pairs that with `useNowTick`, because a
  rolling 24-hour count goes stale on its own as doses age out of the window,
  exactly like the durations that hook already exists for.
- **The quick-pick sets `amount` and leaves a strength alone.** Tapping "3
  tablets" on a drug whose dose reads "50mg" records `amount: 3` and keeps the
  text, because restating it as "3 tablets" would throw away the one fact the
  field was holding. It only rewrites `dose` when the text is empty or is
  itself a unit count.
- **`VoiceDose` now carries `amount` as a number.** The quantity was always
  parsed out of the transcript and then flattened into `dose`; keeping it means
  "two tablets of Treo" counts as two units against the limits rather than one.
- **`startedOn` shipped with it**, as agreed. The field only — nothing reads it
  yet. The ≥50%-reduction comparison it exists for is a separate piece of work,
  and putting the field in first means the date is being recorded from now
  rather than reconstructed later.

Verified on a throwaway profile per the working-practice rule below (a second
dev server on port 5174 — the `migraine-app-scratch` entry in
`.claude/launch.json` exists for exactly this, `--strictPort` so it can never
silently land on the live origin): the rolling window drops a dose that has
aged past 24h across a local midnight; "50mg" counts as one unit; all three
breach notes fire and none blocks the save; a medication with no limits set
renders as it always did; both editor panels round-trip through
`localStorage`. **Not verified on device** — nothing here touches the native
shell, but the wizard's medication step is one of the screens most often read
mid-attack, so it's worth a look on the next build.

## Head diagram (2026-08-18)

- **Both views share one viewBox, aligned on the crown.** Three attempts. Cropped
  independently (`112 235 336 525` / `165 200 350 540`) they rendered at
  different scales *and* centres — the back head measured 211.7px wide against
  the front's 219.8px, 1.9px off-centre, so switching Front/Back resized and
  shifted it. Matching the box sizes and centring each **silhouette** fixed the
  scale but not the movement: the front carries a long neck and the back a wide
  nape, so centring the whole outline puts the skull elsewhere. Centring the
  **skull's** own bounding box fails one level down — the front's face path runs
  to the chin (445.8 tall), the back's stops above the nape (373.1). The crown
  is the only landmark meaning the same thing in both, and the skulls are the
  same width (321.1) in the artwork. Measured after: 0.02px apart on crown
  height, width and centre. **Re-measure both if the art is re-exported.**
- **Paint order is disabled → dividers → selected fills, and all three
  positions matter.** Dividers above the disabled fill or the jaw's boundaries
  vanish under it; below the selected fills or the dashes sit on top of a
  selected zone and make an opaque fill read as a translucent overlay on a
  grid. Selected fills are additionally stroked in their own colour: adjacent
  zone paths don't meet exactly in the exported artwork, and once the dividers
  moved underneath, that sub-pixel gap showed as a ragged dotted seam.
- **The focused zone's outline is a darker shade of its own severity**
  (`sevStroke`), never the accent. A green ring on an amber fill made the
  focused zone carry two unrelated colour signals and the ring won.
- **The mouth is no longer drawn.** The only facial feature in what is
  otherwise a set of selectable regions, so it read as decoration on a control
  — and it sat inside the disabled jaw, drawing the eye to the one part of the
  head that can't be tapped. Path data kept in `details`.
- **Open: the disabled regions are now darker than the head, which is against
  convention.** They were the *lightest* thing in the diagram at `#a39d92`, so
  the two areas you cannot touch drew the eye first. Dark reads as inert but
  inverts the usual "disabled is greyed out". Parked pending a possible redraw
  of the head.

## Working practice (2026-08-18)

- **Never drive the live app by selector.** Verifying UI changes by calling
  `element.click()` on selectors, in a DOM being hot-reloaded underneath,
  deleted one of the user's real attacks: a selector matched something other
  than intended and the click went through the delete confirm. Recovery exists
  only because `useAttacks.sync()` merges local-first, so the phone still held
  it and re-pushed it. **Interactive verification belongs on a throwaway
  profile** — a second dev server on another port is a different origin and
  therefore a separate `localStorage`. Where possible, read state instead of
  clicking: geometry, computed styles and colours were all measurable without
  touching anything.

## Config tried and reverted

Both were plausible, neither had a measurable effect; they're recorded so they aren't tried again as fixes for the same symptoms.

- **`ios.scrollEnabled: false`** — did not stop the keyboard shifting the shell. The offset is a *visual viewport* offset, not a scroll of the WebView's `UIScrollView`.
- **`ios.backgroundColor`** — did not remove the brief pure-black frame between the launch screen and the app's first paint. That flash is still there and still unexplained.

## Tooling

- **`npm run build` never type-checked, and this file used to say it did.** It
  is a bare `vite build`, and Vite strips types without checking them, so a
  type error can sit in the tree indefinitely while every build passes — which
  is exactly what happened to `voiceParse`'s `m.indices` (fixed by adding
  `ES2022.RegExp` to `lib`, the narrow entry rather than a target bump, since
  the runtime guard is the existing `?.` and the deployment target is iOS 15).
  **`npm run typecheck` is the gate**; it should report zero.
- **`npm run ios` is `vite build && cap copy ios`.** Xcode compiles
  `ios/App/App/public/`, which only `cap copy` refreshes, so Run rebuilds the
  last-copied bundle with no error anywhere — the phone sat three rounds of
  changes behind before this was noticed. Reach for it before every device run.
- **Node 22 for the Capacitor CLI** (installed via nvm; the repo default stays on 20).
- **`pod install` needs a UTF-8 locale**, or it dies inside Ruby's Unicode normalisation.
- **Add Swift files to the target with the `xcodeproj` gem** (ships with CocoaPods), not by hand-editing `project.pbxproj`.
- **Rasterise SVG with `librsvg`** (`brew install librsvg`). `qlmanage` produces a small off-centre thumbnail on a white field.
- **Xcode does not reliably re-copy `public/` on an incremental build**, so a web fix can appear not to work when it simply isn't on the phone. This cost three rounds of device testing in one session, twice producing "the fix didn't work" reports against code that predated the fix. **⇧⌘K (Clean Build Folder) before running a device test**, and settle it by reading the installed bundle rather than re-reasoning about the code:

  ```bash
  grep -rl "some string from the new build" ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphoneos/App.app/public/assets/
  ```

  A UI string from the change is the most reliable marker, since identifiers are minified. `stat -f "%Sm"` on the `.app` gives the build time.
- **Measure, don't reason from screenshots.** Every iOS layout bug this file records was diagnosed by reading real numbers off the live DOM; several wrong fixes shipped first when that step was skipped. Safari Web Inspector against the device is the best tool; the `localStorage` + `sqlite3` probe described above works when it isn't to hand.

## Planned, agreed, not built

Ordered as agreed on 2026-08-18. The first two of the four are done; these are the rest, with the constraints already worked out so the next session doesn't re-derive them.

**Built 2026-08-18: medication guardrails and `startedOn`.** Both entries below are kept as written, because they are the record of what was decided before the code existed and every constraint in them is still binding on anything that touches this. What actually shipped, and the three things that only came out in the building, are in "Medication guardrails" above. **The remaining item in this section is the check-in notification**, which is unbuilt and deliberately so: it touches the Swift handler and the pending-action queue, and notification behaviour has failed silently on device twice — it can't be confirmed anywhere but real hardware.

- **Medication guardrails.** *Design settled 2026-08-18; **built** the same day — see "Medication guardrails" above.* Optional fields captured once in `MedicationEditor`: minimum hours between doses, max doses per day, max days per month. The wizard's existing "Took Sumatriptan 1 tablet at 20:36" note becomes "· next dose from 00:36", and a dose taken early gets a **warning, never a block**. The max-days field is the ICHD number — suggest 10 for a triptan and 15 for a simple analgesic when the user picks a type, never assume it.

  Settled in design: limits count **units** (tablets/sprays), not milligrams —
  "max dose per intake" *is* a quantity, and counting doses can't express it.
  "Per day" is a **rolling 24 hours**, how a leaflet states it, which catches
  the late-night-plus-early-morning run a calendar day silently allows.
  `Snapshot.medication` gains an optional `amount` **alongside** the existing
  free-text `dose`, never replacing it, so every historical dose still renders
  and nothing is back-filled — you can't know now whether an old "1 tablet"
  was one unit or two. Parsing a legacy `dose` must stay narrow: `"50mg"` must
  never come back as 50 units, so only a small integer followed by a real unit
  word counts and everything else falls back to 1, which under-reports and can
  therefore only warn late, never invent an overdose.

  Two things ride along. `Medication` gains a `class`, because
  `MOH_DAYS_TRIPTAN` (10) and `MOH_DAYS_SIMPLE` (15) both exist but nothing
  knew a drug's class, so **10 was being applied to everything** and simple
  analgesics were flagged five days early. And a `maxDaysPerMonth` off the
  label beats the class-derived number — Treo prints "højst 10 dage om
  måneden" on the box. Neither needs a Supabase migration: `medications` and
  `snapshots` are both `jsonb` passed through wholesale, unlike `impact`.

 **The rule this must obey:** the app repeats back what the user entered from the label. It never infers a limit, never blocks a dose, and never phrases a warning as an instruction — "you entered a 4-hour minimum; the last dose was 2 hours ago", not "do not take this yet". An app that looks like it is dosing someone is a different and much heavier thing than an app that counts.
- **`startedOn` for preventives**, in the same pass. ***Built*** — the field and its editor row; nothing reads it yet. It's what makes the ≥50%-reduction metric possible: monthly migraine days before the start date against after. Full adherence tracking is *not* required for that — adherence is what distinguishes "the drug didn't work" from "I didn't take it", which is a later question.
- **The 2-hour check-in notification.** Scheduled at dose + 2h, asking for a severity reading rather than a yes/no: relief is already computed from the trajectory, and a binary would be softer data that could contradict the numbers. Two constraints to solve in the design rather than discover on device: the attack reminder runs +1h/+2h from each reading, so a dose check-in landing within ~30 minutes of one should suppress it; and `notifId()` is `attackId % 2_000_000_000`, which uses the whole id space — a second notification per attack needs its own namespace (attacks into `[0, 1e9)`, check-ins into `[1e9, 2e9)`) or scheduling one silently replaces the other.

## Separate conversations, not scheduled

- **SNOOP red flags.** The dossier asks for a "see a clinician" nudge on thunderclap onset, new headache after 50, neurological deficit, fever, marked pattern change — and says it must never reassure. It's a safety feature and the wording carries real weight, so it needs its own discussion rather than being folded into a UI pass.
- **Phase tracking** — premonitory, aura, postdrome. The app models only the pain phase. The dossier argues premonitory/postdrome capture is where a prospective diary beats recall, which makes this the largest single scope item on the list: it changes the data model, not just the flow.
- **Periodic MIDAS / HIT-6 check-ins.** `Attack.impact` is a pragmatic per-attack proxy; the dossier wants both diary counts *and* the validated questionnaires, because the 2026 REFORM study found they disagree on treatment response.

## Known gaps

- **Headache days can't be reported, only migraine days.** ICHD-3's chronic-migraine line is headache on ≥15 days/month *of which ≥8 are migrainous* — two counts. The app has no way to log a plain non-migraine headache day, so `MigraineDaysChart` reports the second and says so. Closing this means a "headache, not a migraine" log path, which is a product decision about what the app is for.
- **Medication taken without logging an attack is invisible.** Medication exists only inside an attack's snapshots, so a dose on an unlogged day doesn't reach the day counts or the overuse figure. Decided (2026-08-18) to design for both being logged rather than add a standalone dose path, and the Insights caption says outright that such doses aren't counted.
- **Preventive adherence isn't tracked.** Parked with the preventive reminders. It's the difference between "the drug didn't work" and "I didn't take it".
- **Open: `--color-text-primary` is unresolved.** It shipped at the dossier's `#e4dfd6`, measured 13.1:1 against the page and 10.3:1 against a raised card — near max contrast, which is the harsh pairing the photophobia research warns against — and was softened to `#cdc7bb` (10.3:1 / 8.1:1, still past AAA). That's a measured improvement, not a settled value: the right number is somewhere in a band, and the only way to pick it is on a real screen mid-attack. `#d7d1c6` sits midway if `#cdc7bb` reads too soft. **Left open deliberately** (2026-08-18) — the severity colours lifted in the same pass are settled and shouldn't be reopened with it.
- **A warm light theme is specified but not built** (2026-08-18). The photophobia research is genuinely mixed on dark mode: user preference skews dark (~63% in one analysis), controlled studies find no reliable difference, and a badly-built dark theme — vibrant accents on pure black, max contrast — can make symptoms worse. The recommendation was to ship *both* a warm light and a true dark theme plus a dedicated attack mode, with the attack mode rated more valuable than the light/dark toggle itself. Attack mode and the retuned warm dark theme shipped; the light theme is parked because the app currently has one user and no wider audience to serve, and because a light theme needs a second variant for all ~44 hand-mirrored colours in the head diagram and charts. Revisit if the app is ever built for a wider group.
- **Attack mode simplifies Today, and only Today** (updated 2026-08-18). It was the theme, the 20px floor, the dim floor and the loss of animation, with no content reduction at all. `TodaySummary` now drops the two month tiles — figures you read and think about, and the largest, brightest text on the page — and the overuse warning's explanatory paragraph, keeping the warning's own line and the last-dose row: the two things bearing on a decision in the next hour. **The other three tabs are untouched.** Insights is entirely "figures to read", so reducing it means deciding what someone mid-attack would still open it for, and that hasn't been settled. The impact prompt deliberately *does* render in attack mode, against that rule: an attack usually ends while attack mode is still on, so hiding it would mean the 24h window nearly always elapses unseen, and one question with four large targets is what the mode asks for anyway.

- ~~Notification action buttons have not been round-tripped on a device~~ — **verified on device**: "Something changed" opens the wizard; "No change" with the app force-quit leaves the app closed and lands a reading stamped at the tap time, not the drain time; the follow-up reminder fires with the app still closed; snooze returns on schedule; reminders are audible and tap a paired Apple Watch. Note for future debugging: **synthetic taps on Simulator notifications still don't activate action buttons**, so a tap that produces no log line there proves nothing — this had to be done by hand on a phone.
- ~~The app icon is a placeholder~~ — **done**: the app is called **Lidd** (dill, reversed) and the icon is the dill mark on the app background. Sources live in `assets/` (`icon.png` 1024², `splash.png`/`splash-dark.png` 2732²); regenerate with `npx @capacitor/assets generate --ios` after changing them. **The icon must have no alpha channel** — the supplied artwork was RGBA with a fully-opaque background, which iOS tooling can still reject, so it's flattened to RGB on the way into `assets/`. The splashes are the same mark centred on the same `#0d0f14`.
- ~~Siri phrase recognition is unverified~~ — **verified on device**: the phrases are registered, the shortcut is findable in the Shortcuts app, and "log a migraine in Lidd" runs the intent through all four questions. It broke once on rename, for the `CFBundleName` reason above; if it ever answers "I can't help you with that" again, check the two names agree before suspecting anything else.
- **The voice summary screen has no per-section edit path.** Correcting one thing Siri got wrong (typically the medication) means either "Make changes", which walks the whole wizard, or tapping through to the step. The design adds a pencil per section on the review screen, opening that single step over the summary with Save / Discard changes, while "Make changes" stays for when Siri got everything wrong. Not built: `LogForm` drives every step off one `step` number with each step's body inline in a single conditional, so editing one in isolation means extracting the step bodies, adding state for the overlay, and snapshotting the affected `form` keys so Discard can restore them. **Settle it together with "Edit details"** on the attack detail screen — both are "change one part of an existing record", and answering one probably answers the other.
- **The typography and palette decisions have no recorded rationale, and the font was never implemented.** Searched on 2026-08-14 after the user recalled settling on **Satoshi** and choosing colours for light sensitivity: "Satoshi" appears nowhere — not in the tree, not in `git log --all -S`, not across any stored session transcript — and `--font-sans` has been `system-ui, "Segoe UI", Roboto, sans-serif` since the first commit, untouched. So the app renders in San Francisco on iOS and always has. The palette *rules* did survive (`cf621be`: no pure black/white, no purple/blue, no drop shadows, plus the fixed `#7d8599`/`#5a9e7a` zone colours), but nothing anywhere states the light-sensitivity reasoning behind them — plausible as photophobia guidance, unverified as intent. The likeliest explanation is that it predates the oldest stored transcript (2026-07-01) or happened in another tool. **Parked at the user's request**; recorded so the search isn't repeated from scratch. Switching to Satoshi would mean self-hosting a `woff2` (the CSP and offline-first bundle rule out a CDN) and confirming its licence.
