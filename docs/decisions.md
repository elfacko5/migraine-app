# Decision log

Why things are the way they are, and what was tried and rejected. `CLAUDE.md` covers *how* each piece works; this is the record of the calls behind them, so they don't get re-litigated or accidentally reverted.

## Platform

- **Wrap the existing web app with Capacitor rather than rewrite it.** The two things that justified going native — reminders surviving a force-quit, and real Siri App Intents — are both reachable from a wrapped app, and ~90% of the codebase (data model, hooks, stats, sync, every component) carries over untouched. *Rejected:* a React Native rewrite (business logic ports, but every component and the hand-inlined head-diagram SVG get rebuilt) and a SwiftUI rewrite (cleanest long-term, but re-derives everything in this file by hand — months, for a personal app whose value is the data model, not the chrome).
- **The PWA stays alive alongside the native build.** It's still how the app is developed and how the browser tooling exercises it, and it's the fallback if the native track is ever abandoned. Anything that must differ branches on `Capacitor.isNativePlatform()` at runtime; nothing is forked.
- **The App Store is not a goal yet.** If it becomes one, the bundle identifier needs settling deliberately first (it's permanent per app record — see below), and Apple's requirements bite on *behaviour*, not on the framework: an in-app account-deletion path, since Supabase sign-in creates accounts, plus a hosted privacy policy and accurate health-data declarations. Sign in with Apple is *not* triggered by email/OTP sign-in.

## Distribution and signing

- **Free provisioning, not the paid account.** It covers everything worth testing on device — local notifications need no entitlement, only *remote* push does. The cost is a 7-day expiry. *Revisit if:* TestFlight becomes useful (sharing with others, or installing without a cable during an actual migraine, when plugging into a laptop is the last thing anyone wants).
- **Bundle id is `com.sunny.migrainetracker2`.** The `2` is not meaningful — the original id could not be registered, and renaming was the fastest way past it. Worth settling deliberately before any Store submission.

## Home-screen widget

Built 2026-08-25, as a read-only widget first.

- **The widget shows attack state and the dose position, and deliberately not the monthly figures.** Migraine days a month is the number a clinician asks for, and it is exactly the wrong thing to pin to a home screen: seen thirty times a day it becomes a score for a health outcome, which §9.2 rules out. The same reasoning that keeps streaks out of Insights keeps the day count off the widget. *If it is ever wanted*, it should be an alternate configuration the user opts into, never the default face.
- **The extension is handed a computed payload, not the diary.** It could have been given the attacks and left to derive its own figures — that is one fewer moving part — but a widget that computes is a widget that can disagree with the app, and nothing about a wrong widget is visible from inside the app. Deriving on the web side means the severity pair, the overuse reference point and the dose position each have exactly one implementation.
- **Summing the 24-hour dose window is the one thing the extension does compute, because a total decays.** A dose ages out of the window while the app is closed, so a frozen number over-reports precisely when it matters. Handing over the individual doses with units already resolved keeps the parsing (`doseUnits`' narrow read, the retired-entry filter) on one side and gives the extension arithmetic it can safely own — plus a timeline entry at each expiry, so it is right in between refreshes.
- **A separate native plugin rather than `@capacitor/preferences`.** The two existing handoffs ride Preferences, and reusing it was the obvious move — but Preferences writes to `UserDefaults.standard`, which a separate process cannot read, and its group option switches the store *globally*, which would move `pendingNotificationActions` and `pendingVoiceEntry` out from under the paths the Swift notification handler and the Siri intent write to by hand. Silently, and on a code path nobody would connect to a widget change. One key through its own plugin is the smaller change.
- **Elapsed times were built on `Text(_:style:.relative)` and that was the wrong call** (reversed on device, 2026-09-01). The reasoning was that WidgetKit's refresh budget could not buy a per-minute rewrite, so the choice looked like one between the app's phrasing and being correct. It wasn't: under an hour that style renders seconds, so the widget put a counter ticking once a second on the home screen — in an app whose palette exists to avoid drawing the eye and which cuts every animation in attack mode. The premise was also wrong. Entries inside a single timeline are pre-rendered and don't each cost a refresh, so a minute-accurate string is affordable after all, and once the figure is in days it changes daily. **The general lesson is the one worth keeping: "the platform gives it to you free" is a claim about cost, not about whether the result is the right thing to show.**
- **Two hours were lost to Capacitor's plugin registration, twice over.** A plugin in the app target is never auto-registered (only npm packages listed in the generated `capacitor.config.json` are), and then `registerPluginType` — the API that looks right — returns immediately while auto-registration is on. Both failures present identically: the bridge is up, the call crosses, and the web side gets `UNIMPLEMENTED`. `registerPluginInstance` from a `CAPBridgeViewController` subclass is the working route.
- **App Groups were expected to force the paid account, and don't.** The capability is widely described as unavailable to personal teams, and this was written up as the blocker on shipping the widget to a phone. It is wrong: Xcode issued locally-generated profiles for both the app and the extension with the group entitlement in them, on the same free team and the same 7-day expiry as everything else. Recorded because the assumption is the kind that quietly parks a feature — check what the toolchain actually does before deciding a capability is out of reach.
- **The ongoing state was redesigned from a canvas of three directions** (2026-09-01), after Sunny read the first build as "a bunch of text with no visual hierarchy". A — duration as the headline, severity as a coloured numeral — shipped first. **C superseded it the same day**, on Sunny's call: the Logs sparkline showing the attack's trajectory, with the numeral kept smaller as the line's endpoint. A is still on the canvas. **B was never built** — severity as the hero with a 10-step scale marking the peak — and the reason still holds: the scale is close to a progress bar, a shape that implies a goal, which is the wrong metaphor for a symptom.
- **C was worth reaching for precisely because it was the expensive one.** A and B are view changes; C needed the readings in the payload rather than just now and peak, which is a contract change across a process boundary and gets no cheaper by waiting. The thing it buys is the question two numbers cannot answer — whether the attack is climbing or easing off — which is most of what a glance at a home screen is for, and otherwise costs opening the app. **The general shape: when one option among several is the only one that changes an interface between components, its cost is the one that compounds, and that is an argument for doing it early rather than a reason to defer it.**
- **The severity numeral went down, not up, under C.** Under A the digit and the duration were peers competing for the same job, and two corrections in opposite directions (40pt, then 26pt to match) were tuning a balance the tile shape could not win. With a line above it the numeral is a caption on a figure already drawn, so 20pt is right. *The fix for "no hierarchy" is rarely "make one thing much bigger"* — that lesson survives A, and C is what it looks like applied properly.
- **Colour carries severity here, where the Today hero refuses it.** The hero states severity as plain text because it sits on artwork, where a tinted number reads as part of the illustration. The widget sits on a flat ground, so the ramp does the work the Logs list already lets it do — magnitude registers before the digit is read. Not an inconsistency: the same rule applied to two different surfaces.
- **Sizing the severity figure took two corrections in opposite directions.** The first version had every line at one of two sizes and no hierarchy at all; the fix made the numeral 40pt against a 26pt headline, which Sunny read as off balance — correctly, it was then the loudest thing on the widget. It ended matching the duration's size, with colour and weight as the only separators. Worth remembering as a shape: *the fix for "no hierarchy" is rarely "make one thing much bigger"* — it was the run-on sentence, not the size, that flattened the original.
- **The medication column lost its 24-hour dose count on Sunny's call**, trimmed to the time, the drug and the next dose. Recorded because the count was load-bearing elsewhere in the design: it is the only figure on any surface that answers "how much is already in me" without opening the app, and it is why the payload carries `windowDoses` at all. That field stays, unused, so the count can come back without a contract change.
- **Adding the widget target silently deleted the `App` scheme.** Xcode's auto-created schemes live in `xcuserdata` and are neither shared nor tracked, so rewriting the project file took the only way to run the app with it — presenting as a launch that hung on the widget extension, an error that reads like a signing fault. The scheme is now checked in. General lesson: anything Xcode "creates automatically" is not a thing to depend on across a scripted project edit.

- **The interactive "No change" button was built and removed on the same day (2026-09-01).** It shipped as an iOS 17 `AppIntent` in the extension, writing a group-side queue that `LiddWidgetPlugin` drained into the existing `consumePendingActions` path, and it round-tripped end to end on device. Sunny then called it, and the call was right. Recorded at length because it is an obvious thing to propose again.
  - **The case for it still stands.** A `no_change` reading is the cheapest answer to give and among the most valuable to hold — the plateau analytics are built out of consecutive `no_change` runs, and it is exactly the reading nobody opens an app to log.
  - **What killed it is that the lock-screen reminder already offers the same action**, on a cadence that is coming anyway. The button's only real gain was answering *earlier* than the reminder. Against that it was the largest single source of layout trouble on the surface: it forced a reserved-width constant on the label, it made the square family read as crowded, and it caused the medium overflow bug. **A shortcut to something already one tap away has to earn its structural cost, and this one didn't.**
  - **Its confirmation state was never designed, and that is the real fault.** A tap that redraws to the previous state is indistinguishable from a broken button, so the control swapped to a `✓ Noted` check — which then persisted until the app next ran and drained the queue. Its lifetime was therefore invisible: seconds if the app happened to wake, hours if not. Sunny's question was "when does it go back?", and there was no answer to give. **If this is rebuilt, the confirmation is the part to design first** — the intent and the queue were the easy half, and building the easy half first is what produced a feature that worked and still had to come out.
  - **"Why is there no *log a change* button?"** Because a change needs the wizard — which areas, what severity — so it cannot complete in a tap; it can only open the app, which additionally needs `@capacitor/app`. The control was structurally the lone half of a pair and read that way. **A single action from a set is worth shipping only when the others are genuinely unnecessary, not merely harder.**
  - Two things were cheaper than the earlier deferral note assumed, and are worth keeping if it returns: it needs **no notification machinery** (nothing has fired when the button is tapped, so the pending reminder still arrives and the drain re-times it as it would a hand-logged reading — no `notifId()` folding, no `notificationConfig` in the extension), and the **second queue is the whole cost**, unavoidable because `UserDefaults.standard` is invisible to the extension and Preferences' group option switches the store globally.
  - Everything is in git at `0d785c2`.
- **The widget got the Today hero's artwork and lost it again, same day.** `HomeCard`'s recipe ported cleanly — image on the trailing 64%, opaque gradient stop past its left edge, fading from the ground colour itself — and on the wide family it looked right; the square family needed the fade turned through 90° because a 64% band there spends 40% of the width on a dark wash. Sunny dropped it once the mark had moved out of the corner it was competing for: **on a surface with none of the app's protections the picture was the loudest thing the widget had**, and two lines of text on the flat ground read better. Worth keeping as a shape: *the reason a decoration looked necessary can be a layout problem, and fixing the layout can remove the need for the decoration.*
- **The mark took four placements to settle.** Top-right (the platform's habit, but the one corner every state already uses for its label — they overlapped once the label grew), inline before the label (fixed the collision but forced the mark down to the label's line height, defeating the point of enlarging it), bottom-left (nicer on the attack-free card alone, but only works where there is empty space beneath the text, so the ongoing card would have needed it elsewhere), and finally **trailing edge, level with the content** — bottom-right during an attack where the block ends on its severity row, centred off one where the block is centred. The rule that survived is *the mark lines up with the bottom-left content*, not *the mark sits in corner X*. **A position rule that every state can honour beats a nicer position that one state can.**
- **Verifying a widget state without running the app is its own skill, and two of the obvious moves are wrong.** `xcrun simctl spawn <udid> defaults write group.…` and the extension read **different stores** — `defaults read` will echo back a payload the widget never sees, which cost most of an afternoon before the two were diffed. The store that matters is the App Group *container plist*, written with `plutil -replace` and followed by a simulator reboot so `cfprefsd` re-reads it. `launchctl kickstart -k system/com.apple.chronod` leaves both widgets rendering as blank white placeholders and needs another reboot to recover. Timeline caching is real too — entries carry the snapshot captured when `getTimeline` ran, and the attack-free branch schedules about a month of them — but it was not what made the state stick.
- **Lexend reached the extension as three static instances** cut from the app's variable woff2 with `fontTools.varLib.instancer`. CoreText cannot read woff2 at all, so the app's own file was never shippable as-is; static instances rather than the variable file because selecting a weight axis at runtime needs `kCTFontVariationAttribute` where three PostScript names are a lookup that visibly works or doesn't. 400/500/600, nothing lighter, the app's own rule.

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
  component's render — at the time, the lint baseline was 9 and a new entry in
  it would have hidden the next real one. (The baseline is now 0; see below.) `TodaySummary` pairs that with `useNowTick`, because a
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

## Cards, icons and the Logs list (2026-08-19)

- **The Logs row is ranked by how long and how bad**, then when, then
  medication, then symptoms, then the quiet line. Duration leads because it is
  diagnostic, not context: ICHD-3 1.1 defines migraine as attacks of 4–72 hours
  untreated.
- **Average severity is time-weighted, and a plain mean was rejected on
  purpose.** Severity is sampled whenever a reminder happens to be answered, so
  a mean would measure the diary as much as the attack — the same episode
  logged eight times while it faded averages lower than one logged twice at its
  worst. Each reading counts for as long as it held until the next, which is
  the rule the snapshot model already states. Peak stays beside it, labelled:
  it is what ICHD's "moderate or severe intensity" speaks to.
- **Two labelled numbers, so no badge.** An unlabelled badge works while there
  is exactly one figure; with two it can't say which is which, and once both
  are labelled they read better as text. Colour still carries magnitude.
- **Location is a side, and a *count* of areas was rejected.** The suggestion
  was "4 areas"; the problem is that a count cannot distinguish one-sided from
  both-sided, which is precisely what ICHD-3 criterion B turns on (≥2 of four
  pain features, one being *unilateral*). "Left side" is half a criterion in
  one word. `attackSide` reads across the whole attack — one that starts left
  and spreads is bilateral — and returns `null` when nothing says, because
  `Nose` is the only sideless zone and an attack recorded solely there has no
  laterality to invent.
- **The side is drawn, not written**, and the glyph is **mirrored like the
  picker**: the front view faces you, so the subject's left is screen-right.
  Flipping it would put the shading opposite the side the same person just
  tapped. The artwork is interim pending Sunny's illustration; swapping it is
  two paths in `SideGlyph`.
- **The reading count came off the card.** The sparkline already shows there
  was more than one reading and roughly how many.
- **Nothing on a card row may be an emoji.** An emoji is full-colour and can't
  inherit `currentColor`, so it makes the least important mark on a row the
  brightest thing on a screen the palette works to keep quiet — the rule the
  attack-mode pill gave up its emoji for. Medication forms, the Profile menu,
  symptoms and reliefs are all drawn marks in `drawnIcons.tsx` now. `medIcon`
  became `medForm` (a plain function returning a key) plus `MedIcon`, so the
  matching stays importable from non-JSX code.
- **Medication chips lost their accent tint.** It was how the two chip sets
  were told apart before either had an icon; the icons do that now, and accent
  means *action or selection* everywhere else.
- **Logs opens on all time, and the period moved into the filter sheet.** It
  had a permanent pill row on the argument that it is adjusted constantly while
  other filters are set once — but defaulting to 7 days meant the page opened
  hiding most of what it exists to show, and a quiet week read as an empty
  diary. Insights keeps its own pills: there the period *is* the question.
- **Both Today tiles label their subject, not their period.** They had been
  built the opposite way round from each other (one "This month / 9 migraine
  days", the other "Medication / 5 days this month"), so neither could be read
  against the other.
- **`MedicationEditor` is two sections and the split is a contract.** Name,
  strength, quantity and unit are required — they are what every other screen
  renders, and a medication that can't say what one dose of it is can't be
  counted against anything. Everything below is optional and each field carries
  its own **More info**, because the fields are transcribed off a leaflet and a
  leaflet doesn't explain itself. `dose` became derived rather than typed, so
  it can't disagree with the structured fields.

## Today's hero, and where an action lives (2026-08-25)

- **The Today hero's actions duplicated the nav's FAB, and the duplicates
  went.** `AttackFreeCard` carried "Log an attack" and `OngoingAttackBanner`
  carried "Add update" — in both cases the FAB's own action, in a second and
  louder place. **Duplicated entry points are not the fault**; HIG and Material
  both expect a persistent action in the chrome alongside contextual in-content
  ones, and the FAB earns its place by being reachable from the other three
  tabs where the hero isn't. The fault was two **solid-accent** targets in one
  viewport on a screen where accent means *press this* and nothing else on
  Today is accent-filled. So the hero keeps only what the FAB can't express —
  `End attack` — and the attack-free hero carries nothing at all.
- **`End attack` stays `btn-secondary`** rather than being promoted into the
  vacated primary slot. Promoting it would rebuild the competition the change
  removes.
- **The first-run empty state keeps its labelled "Start logging" button.** A
  bare plus is a weak first affordance, and someone with no history needs the
  words once.
- **The FAB's `aria-label` was wrong and is now a prop.** It was hardcoded
  "Log a migraine" while opening *Add update* whenever an attack was ongoing —
  a live bug, and one that matters more now the FAB is the only route.
- **Moving `AttackModePill` was considered and rejected.** With the hero's
  accent button gone, the pill is the nearest labelled thing to the FAB, and it
  is categorically different — a mode toggle in the floating layer beside a
  create action, where the chrome is where a toggle would normally live. The
  obvious destination is `TopBar`'s trailing slot. **Wrong for this app**: top
  right is the hardest corner to reach one-handed, and this control is reached
  mid-attack by someone not reading carefully, which is the reason it was moved
  to the bottom in the first place. It also doesn't compete on the axis that
  actually signals importance here — its off state is `bg-raised` /
  `text-secondary`, the quietest interactive treatment in the app. If it ever
  does read wrong, the levers in order are: push its bottom offset up a step
  (checking it against the `calc(10rem + inset)` page reserve, which is tuned
  to its height), default it collapsed on Today only, then `TopBar`.

- **The hero stopped being a card.** It was a rounded `bg-bg-surface` panel
  inset in the page padding, holding a hard-edged image box — two visible
  frames around the one thing on Today that should read as the top of the
  screen rather than an object on it. It now bleeds past the page padding and
  up to the top of the scroll region, and **Today renders no `TopBar` while a
  hero is on screen**: a greeting bar above it would put a strip of chrome
  between the status bar and artwork meant to start at the top. The hero's
  label and headline are the page's heading in that state; the first-run state
  has no hero and keeps the bar.
- **The blend works because the hero has no background of its own.** The
  gradients fade from `bg-bg-base` — the page colour itself — so the artwork
  dissolves into the page instead of into a card tone that then has to meet the
  page at a seam of its own. They fade to `bg-bg-base/0`, never `transparent`:
  interpolating towards `rgba(0,0,0,0)` greys the mid-stops.
- **Three tuning rules, all found by looking at it on a phone-width viewport:**
  the artwork must stop short of the very top (it ran to y=0 and put the clock
  and battery on top of the picture); the **band's height** is what sizes the
  artwork, not its width (square sources, `object-cover`, so the taller
  dimension drives the scale — a hero that looks too zoomed wants a shorter
  `min-h`); and the vertical fades need to be long and carry a mid stop,
  because a short linear fade finishes with a kink the eye reads as an edge of
  its own. The text block is **centred against the artwork**, not top-aligned
  in it — top-aligned it read as text that happens to have a picture behind it.
- **How well it blends still depends on the artwork.** The attack-free image is
  near-black and disappears into the page completely; the ongoing one carries a
  cool navy plate that stays visible as a lighter, bluer field where the
  gradient has faded. That is the picture, not a seam — but it is why a
  replacement image should be dark and warm at its edges.

- **The attack-free hero lost its detail line and gained a greeting.** It read
  "Since Thu 20 Aug, 10:40" directly under "8 minutes" — the timestamp the
  headline is measured *from*, which is the same fact a second way, occupying
  the largest piece of real estate in the app. Nobody glancing at Today wants
  the exact end time; it is still on the attack in `AttackDetail` if it is ever
  wanted. The freed line went to a time-of-day greeting, which is also where
  the "Hello" that `TopBar` used to carry on Today ended up — a page that opens
  on a bare figure reads colder than this app is meant to. **The ongoing hero
  gets no greeting**: "Good morning" above "Ongoing attack" would be the app
  failing to notice. `greeting()` reads the clock inside the util rather than
  in the component, the rule `medGuardrails` already follows, so nothing new
  lands in the `Date.now()`-during-render lint budget.
- **The four nav tab marks became Lucide paths, inlined unchanged** —
  `calendar`, `list`, `line-chart`, `user` — matching Sunny's Figma nav and the
  recorded rule that a generic UI affordance comes from Lucide, whose contract
  is the one every icon here already follows. Today is a **calendar, not a
  house** (the tab is a day, and a house said "start here" about one tab of
  four); Logs a list rather than a clock-with-an-arrow, which read as "undo";
  Insights a trend line rather than bars. **Profile keeps the person and not
  the comp's gear** — that comp is labelled "Settings", which the tab stopped
  being once it took on medications and account.
- **The attack-mode pill's `FlareUpIcon` was replaced by `AttackModeIcon`.**
  The supplied artwork was the right metaphor as the wrong kind of drawing:
  five *filled* concentric scalloped rings in a 39×40 box, ~16KB of path data,
  carrying far more detail than the 20px pill can resolve — on device it read
  as a small flower or a gear. Redrawn to the contract everything else follows:
  five elements, one stroke weight, no interior detail. **Arcs, not rays**, and
  that is the constraint if it is redrawn again — a dot with straight rays is a
  sun, and the sun is the brightness pill at the same screen position in the
  opposite state; a crescent is taken too, since `MoonIcon` means sleep as both
  a relief and a trigger, and all three can be on screen together. This is the
  same failure Health Icons was rejected for and worth noting as a pattern:
  **detail that survives at 40px does not survive at 16–20px.**
- **Then it had to be drawn bigger, twice over.** The first redraw inherited
  the old mark's proportions and sat in the middle 50% of the 24-unit box, so
  at `h-5` it put ~10px of visible ink beside a 16px label. Fixed the way the
  medication forms were fixed in the same situation: the arcs now use ~78% of
  the box, and the pill renders it at 24px rather than 20 — the nav pairs a
  24px icon with a 14px label, and this control is physically larger than a nav
  tab. Measured, not eyeballed: 12.9×10px of ink before, 18.9×18px after.
  **Two separate levers, and reaching for only one of them under-fixes it** —
  how much of the box the drawing uses, and how large the box is rendered.
- **The brightness pill's `🔆` was the last emoji in the app, and it is gone.**
  `BrightnessIcon`, inlined from `icons/brightness 1.svg`, which had been
  sitting unused. The rule it broke is the one the attack-mode pill gave up its
  own emoji for: a full-colour glyph can't inherit `currentColor`, so the
  brightest mark on screen belonged to the control that exists to make the
  screen dimmer.
- **Health Icons for the domain marks: raised again, parked.** Sunny asked for
  health-related icons to come from Health Icons and everything else from
  Lucide; the Lucide half matches what is recorded, the Health Icons half is
  what the 2026-08-19 spike ruled out for these sizes. Recorded as **unsettled
  rather than decided** — the note above was written from the spike, and Sunny
  recalls a different recommendation. If it is picked up, the thing to produce
  first is a side-by-side of a few Health Icons against the drawn marks at
  their real shipping sizes (14–16px for chips, 18px for medication headings),
  because that is the only question in dispute.
- **Triggers got an icon set**, reversing the earlier note that they had none
  and that a half-iconed row reads worse than one with no icons at all. That
  note described what existed rather than deciding anything: symptoms and
  reliefs had marks and triggers didn't, which is exactly the inconsistency the
  drawn-icon set exists to prevent. `TriggerIcon` + `TRIGGER_ICON_RULES` in
  `drawnIcons.tsx`, matched by pattern like the other two families, wired into
  the `LogForm` trigger step, `AttackDetail`'s Edit details picker, and the
  read-only trigger line in `AttackDetail`'s header — which was a comma-joined
  string, the one list in the app that read as raw text.
- **Most of the marks are reused, and that is right rather than merely cheap.**
  Caffeine is the same cup whether it helped or set the attack off; drawing a
  second near-identical one would be a distinction nobody could see at 16px.
  Six are new — stress, alcohol, weather, hormones, menstruation, screen time.
- **Two of the six avoid a collision that only shows up on one screen.**
  `AttackDetail` can display triggers, symptoms and reliefs together, so stress
  is drawn as chevrons pressing inward rather than a lightning bolt (one zigzag
  too close to `AuraIcon`), menstruation as a cycle arrow rather than the
  obvious droplet (already the hydration relief), and hormones as a *smooth*
  wave, because a sharp one at 14px is `ThrobbingIcon`'s ECG line.

## Working practice — push, don't hoard (2026-08-19)

**Commits go to `origin` as a matter of course.** The "commit per task, push
nothing" rule was written for one unattended session, so the work could be
reviewed before it left the machine. It then quietly became the default: by
the time anyone looked, 69 commits — over a month — existed only on this
laptop, with a perfectly good remote sitting unused. A single disk failure
would have taken all of it.

Push after committing, or at the latest at the end of a session. Confirm
first only for the genuinely irreversible: force-pushing, rewriting history,
tags, releases, opening a PR.

## Working practice — the simulator is a signed-in origin too (2026-09-01)

The 2026-08-19 entry below says to check for a session before seeding. It is
about `localhost:5174` because that is where it went wrong then. **The rule is
about origins, not about that port**, and reading it as being about the scratch
server is exactly how it went wrong again.

- **A simulator install carries its own WebView `localStorage`, and a previous
  session's Supabase token survives in it indefinitely.** The iPhone 17 Pro
  simulator was signed in to the real account from some earlier session. A seed
  probe injected into the installed bundle's `index.html` — the technique
  `docs/viewport-architecture.md` recommends, and it is still the right
  technique — overwrote `hd_attacks` and `hd_medications`, and the app pushed
  both.
- **The check that was skipped was the documented one.** The App Group was
  inspected for a widget payload before seeding; `localStorage` was never
  inspected for an `sb-…-auth-token`. Looking at *a* store is not looking at
  *the* store. The one-line safeguard is `select key from ItemTable where key
  like 'sb-%'` against the WebView's `localstorage.sqlite3`, in the same call as
  the write.
- **The damage was asymmetric, and the shape is worth knowing.** Attacks merge
  by id, so the 40 real ones came straight back on the next pull and only the
  fabricated record had to be removed. Medications are **whole-list
  last-write-wins on `updatedAt`**, so a seed list with a fresh timestamp
  replaced the real library outright — including the guardrails transcribed by
  hand off leaflets, which nothing else in the app can reconstruct.
  **Before seeding anything, ask which of the two merge strategies each key you
  are about to write uses.** A union is survivable; a whole-list write is not.
- **The recovery window is the other device's next foreground.** `localStorage`
  stays authoritative for reads, so an untouched phone still holds the real list
  — until it foregrounds, pulls the newer row, and overwrites it. The fix is an
  export taken in airplane mode, and it expires on its own.
- **Prefer a simulator you erased.** `xcrun simctl erase` before a seeding
  session costs seconds and removes the whole class of problem; a fresh install
  onto a device that already has the app does not clear its WebView store.

## Working practice — the scratch origin is not a safe sandbox (2026-08-19)

Recorded at length because it went wrong twice in one day, and the second
failure was a wrong *conclusion*, not a wrong action.

- **A second dev server on another port is a different origin, but that does
  not make it isolated.** The app is sync-aware: if that origin holds a
  Supabase session it pulls the real account down and pushes local writes back.
  Seeding test attacks there put three fabricated records into a real medical
  diary, which then synced to the live app. **Check `signedIn` *before*
  seeding, not after** — one line, and it is the whole safeguard.
- **One clean read is not proof.** After cleaning up, a check of the live
  origin showed the fakes absent and that was reported as "your account is
  clean". It wasn't: the read landed in the window between a pull and the push
  arriving, and the records reappeared later. A sync round-trip has to be
  observed settling, and the authoritative store — not a local cache — is what
  answers the question.
- **Tab ids are recycled across origins in the Browser pane.** The id `seed`
  was port 5174 early in a session and port 5173 later. Anything destructive
  must confirm `location.origin` in the *same* call, never trust the id.
- **`autoPort` on the live dev server was a latent version of the same bug.**
  A busy 5173 meant Vite silently took the next port; a different port is a
  different `localStorage`, so the app came up empty and signed out, looking
  exactly like data loss. Both configs are now `--strictPort`: failing to start
  is visible, silently moving is not.
- **Supabase sessions lapse in this pane.** Every page in it reports
  `visibilityState: "hidden"`, which is the state browsers throttle timers in,
  so the token refresh often doesn't fire and the hour-long session expires.
  That explains repeated sign-ins; it does **not** explain missing data, since
  `localStorage` is the source of truth and survives sign-out.

## The Browser pane, when it stops responding (2026-08-19)

Two failures that look like app bugs and are not. Both were diagnosed by
reading the page rather than looking at it, which is the same rule the iOS
layout work already records.

- **A 0×0 viewport.** The pane can hand a tab no dimensions at all, so the page
  keeps painting its last frame and has nowhere to route taps. The tell is a
  screen showing something that shouldn't be there — old data, the previous
  URL's page — while `innerWidth`/`innerHeight` read 0. Forcing a resize fixes
  it.
- **`visibilityState: "hidden"` while plainly on screen.** Un-maximised, the
  pane can report the page hidden; a hidden page doesn't repaint or take input.
  Maximising is what marks it visible again.
- Neither is fixable in app code, and both were confirmed by checking that
  layout was correct — pointer events, the app-height variables, no overlay —
  while input still didn't arrive.

## Chips, settled (2026-08-19)

- **Filter pills keep their drawn size and gain a 44px target.** 32×32 clears
  WCAG 2.2's 24px floor but not Apple's 44pt. `.tap-44` expands the target
  invisibly, and the row gap went `gap-2` → `gap-y-4` because the expansion
  adds 6px above and below each pill: at an 8px gap the rows' targets would
  overlap and trade one mis-tap for another. Measured after the change — 23
  pills, still drawn at 32, zero overlapping targets.
- **`ChipSelector` now uses the shared `chipClass`, like everything else.** It
  had been the one component with its own unselected style (`text-primary`
  and a background hover, against the shared `text-secondary` and colour
  hover). The defence offered for keeping it — that these are options you read
  to choose from, where a filter pill is something you glance past — **does
  not survive scrutiny, and Sunny pushed back on it**: the filter sheet's
  pills are also options you open a screen specifically to read and pick from.
  It was drift being rationalised after the fact. Recorded because the
  rationalisation was more plausible than the truth, which is exactly when
  this sort of thing survives a review.

## The notification chain, verified on device (2026-08-19)

The dose-retimed reminder was tested end to end on a real phone, which is the
only place any of this can be trusted, and everything held: permission
granted, the reminder scheduled, brought forward by the dose to `dose + 2h`,
delivered to a paired Apple Watch with vibration, answered as "No change" with
the app closed, queued into `UserDefaults`, drained on next open, and the
reading landed **stamped at the tap time** rather than the drain time. That
last part is the whole reason the Swift handler and the pending queue exist.

Run twice. The second run removed the watch, and the **phone itself vibrated
and lit its screen**, which proves phone-side delivery independently of wrist
routing; "No change" was tapped straight from the lock screen and the reading
was on the timeline a minute later. Both halves of the delivery path are
therefore verified, not inferred.

Three things the test taught that reasoning had not:

- **The readout that made it diagnosable was worth more than the fix.** Three
  notification failures in this project have looked identical from outside —
  nothing arrives — whether the cause was a missing sound file, a stale
  bundle, a permission never granted, or a schedule never made. Profile → Data
  now reads the permission and the pending queue back from the OS, and the
  first real test resolved in thirty seconds what had previously taken a
  two-hour wait per attempt.
- **A silent phone with a buzzing watch is iOS working correctly.** With a
  paired watch on the wrist and the phone locked, iOS routes the alert to the
  watch only. It also proves the bundled sound resolves, since an unresolvable
  sound name kills the wrist tap too.
- **A diagnostic that lies is worse than none.** The readout showed a
  follow-up scheduled in the past, which looked like a broken chain. It wasn't:
  `reschedule` copies the delivered notification's content, which carries
  `userInfo["cap_schedule"]`, and that — not the trigger — is what
  `getPending()` reports. The trigger was always right.

  The fix took two goes, and the second one is the lesson. Updating the
  plugin's `cap_schedule` worked, but it depended on casting the whole
  `userInfo` in one step, which can fail silently and would leave the stale
  date in place looking like an answer. The handler now also writes its own
  `nextAt` into `cap_extra` — a key we own and always set — and the readout
  prefers it. **Verified on device**: after a fresh reschedule the entry reads
  two hours ahead rather than the time it just fired.

  **A stale entry immediately after a rebuild is expected, not a symptom.**
  iOS keeps already-queued notifications across an app update, so an entry
  scheduled by the previous binary carries its old metadata until it fires or
  is replaced. Only the next reschedule can show the fix — which cost a round
  of "I rebuilt and it still shows the old time".

## Accessibility audit (2026-08-19)

Measured in the live DOM rather than read off the source — the same rule the
iOS layout work follows, and it is what turned up the ones that looked fine in
the code.

- **A closed overlay must leave the focus order, not just stop taking taps.**
  `aria-hidden` + `pointer-events-none` left every button inside tabbable, so
  a keyboard user tabbing through Today walked into a closed dialog — and
  `aria-hidden` with focusable descendants is itself the failure. `inert`
  fixes both; the delayed `visibility` flip is the fallback for iOS 15, since
  `inert` only landed in Safari 15.5, and the delay is the transition's own
  length so closing still animates.
- **A placeholder is not an accessible name.** It disappears the moment
  someone types. Eleven controls announced as "edit text, blank"; seven of
  them were self-inflicted, when the `MedicationEditor` rewrite replaced
  `<label>`s with styled `<span>`s. The lesson worth keeping: a label that
  *looks* right is not a label — `Field` now generates the id and injects it,
  so the association can't be dropped by restyling.
- **A wrapper element will happily swallow an injected id.** `NumberField`
  needs its `<div>` for the suffix, so the id landed there and the input
  stayed nameless. Anything taking an id from a parent has to forward it to
  the control.
- **`.tap-44` expands a target invisibly**, for the small icon buttons and
  inline text links that fell under WCAG 2.2's 24px floor or Apple's 44pt ask.
  **Deliberately not applied to the filter pills**: on a wrapped row with an
  8px gap it would make adjacent rows' targets overlap, which trades one
  mis-tap for another. Those need a real size or gap change — see the open
  item.
- **Heading levels are structure, not size.** Insights jumped h1 → h3;
  `InsightSection` is an h2 now and looks identical, because the size was
  always the class.
- **Check contrast against the tightest surface.** 14px secondary text
  measured 4.38:1 on `bg-elevated`, under the AA 4.5 the palette is tuned to —
  the same trap the severity colours fell into against `bg-raised`.
  `#3b3733` → `#383430` reads 4.58 and stays lighter than `bg-raised`.
- **Fixed ids inside a repeated component are a latent bug.** `SideGlyph` set
  two literal clipPath ids, so a ten-row list emitted ten copies of each; it
  only rendered correctly because every copy defined the same geometry.
  `useId` per instance.
- **A live card must not state a past figure in the present tense.** The Today
  card read "Pain severity: 9" off `attackMaxSeverity` — the worst it had
  *been* — so an attack that had eased to 3 still announced a 9. It reads
  "Severity now 4 · peak 9" now, and collapses to one number when they agree.
  Deliberately not the Logs row's time-weighted average: that summarises a
  finished episode, and mid-attack it is a partial figure that keeps moving.
- **A rewrite can quietly revert an agreed decision.** "Max in one go" had come
  back as "Maximum in one go" when the editor was restructured. Worth a
  re-read of recent decisions after any wholesale rewrite of a file.

## The palette measured against WCAG, and what it cost (2026-08-25)

A full contrast audit of all three palettes, measured on the pairs that
**actually render** rather than on the token table — a token pair nothing puts
together proves nothing. Every number, and the exemptions, are in
[`palette.md`](palette.md). What it changed:

- **Attack mode's `--color-text-secondary` was below AA on `bg-elevated`**
  (4.14:1) — which is where `InsightSection` puts a chart's own labels, so the
  frequency counts and migraine-days month labels rendered under AA whenever
  attack mode was on. Lifted to `#9a9689` (4.82). **The dark palette's own fix
  for the identical bug moved `bg-elevated` instead, and that route is closed
  here**: attack's elevated sits 1.11 from `bg-raised` and darkening it far
  enough collapses the stack before clearing 4.5. Dark had room because its
  elevated goes *lighter* than raised.
- **Non-text contrast (1.4.11) failed everywhere and structurally** — every
  author-drawn edge measured 1.15–1.8:1 against the required 3:1, in all three
  modes, by near-identical margins, because they came from one decision:
  outlines drawn one step off their own surface. Fixed with a **second token**,
  `--color-border-control`, not a brighter `--color-bg-border`: that token has
  73 call sites and only ~17 are controls, so raising it globally would have
  turned 47 decorative dividers into a visible grid — which *is* the §8.1
  regression the palette exists to avoid. Confined to controls it costs a 1px
  hairline on things meant to be pressed.
- **The tension between 1.4.11 and §8.1 was largely illusory.** 3:1 is not a
  harsh boundary and a hairline adds negligible luminance whatever its
  contrast; §8.1's concern is large bright fields and saturated hues. The trap
  was one token doing two jobs.
- **Selected chip state now carries `ChipCheck`, not just colour.** The
  selected-vs-unselected delta was 1.38 on the fill and 1.26 on the label. The
  glyph reads 4.68:1 with **no palette change**, and it satisfies §8.2's
  stricter "never by colour alone" — which matters here specifically because
  FL-41 lenses shift exactly the sage-vs-grey distinction the chips relied on.
  **Its slot is always rendered at `opacity-0`**, because a check that appears
  on tap makes the chip wider than its unselected self and a wrapped row
  reflows on every toggle. Verified: toggling one chip in an eight-chip row
  moved nothing.
- **Two pre-existing defects surfaced only by looking at the screen**, which is
  the argument for verifying with neighbours in frame rather than trusting the
  numbers. The app has two switches and they had drifted: `ProfileView`'s used
  a light thumb measuring **1.70:1 against its own accent track when on** — the
  switch's state indicator was the least visible thing on it, in the state that
  matters. And `NotificationSettings` was hand-rolling its unselected interval
  state instead of using `CHIP_OFF`.
- **Four things are left failing, with their exemptions written down** rather
  than quietly: disabled diagram regions (1.4.11 exempts inactive components),
  the 15-day threshold line (the count is printed as text beside it, and it is
  already `aria-hidden`), decorative hairlines, and the selected chip's own
  ring. 1.4.4 also still knowingly fails at the 150% ceiling.

**A methodology note worth keeping.** Two rounds were wasted on a measurement
artefact: mutating `data-theme` and reading `color` in the *same* synchronous
script returns a stale colour while custom-property lookups resolve fresh, so
the fix looked inert on a server that was serving it correctly. Split the
mutation and the read across separate calls. The compiled CSS in `dist/` is the
deterministic check when a browser reading disagrees with itself.

## The design system, mirrored into Figma (2026-08-25)

**Lidd Design System** — <https://www.figma.com/design/eIOtxkHeEPguTLY2gWdhxF>.
Variable collections only, no components: `Primitives` (38, hidden behind empty
scopes), `Color` (18 semantic × Dark/Light/Attack), `Radius`, `Typography`, plus
eight Lexend text styles and foundations pages.

- **All three modes are real Figma modes**, so one set of bound variables
  resolves three ways — the Colour page proves it with three columns pinned via
  `setExplicitVariableModeForCollection`.
- **It is a hand-maintained mirror, not a source.** `index.css` stays
  authoritative for Dark and Attack, `palette.md` for Light. Nothing syncs; a
  value changed in one place has to be changed in the other, exactly like the
  hand-mirrored SVG and Recharts constants.
- **Primitives deliberately carry no code syntax** — no CSS variable
  corresponds to `sand/450`, and inventing one would misrepresent the codebase.
  **No effect styles either**, since the app uses no drop shadows.
- Gotcha for anyone building components there: `figma.createAutoLayout()`
  defaults to a **white fill**. 69 rows across three pages had it before it was
  caught on a screenshot.


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

## Code health (2026-08-18)

- **The lint baseline of 9 is gone; `npm run lint` reports zero.** A standing
  count is worse than it looks: a real new error arrives as "10 instead of 9"
  and reads as the usual noise, so the only way to notice one was to `git
  stash` and compare — which nobody does on the run where it would matter. The
  nine were all the deliberate patterns this file already defends (sync on
  mount and on every foreground; a period filter that is relative to now by
  definition), so they became **per-site `eslint-disable-next-line` carrying
  the reason**, not a rule switched off in the config. The rule still fires
  everywhere else, and the next instance of either pattern has to write down
  why rather than disappearing into a total.
- **A disable directive has to be the line immediately above the code.** Cost
  a round to find: with the reason continued across several `//` lines after
  the `--`, "next line" is the next *comment*, so all eight directives landed
  on nothing while looking correct. Explanation above, directive last.
- ~~Still open: the bundle is ~920KB~~ — **considered and declined
  (2026-08-19).** 921KB raw is 264KB gzipped, it is fetched once and then
  served from the service-worker cache or the native bundle, and the cost of
  splitting lands on two of the four tabs — including a list scrolled
  mid-attack. Vite's 500KB warning is a default threshold, not a verdict.
  Revisit only if first web load becomes something anyone measures.

## Working practice (2026-08-18)

*Superseded in part by "the scratch origin is not a safe sandbox" (2026-08-19)
above — the throwaway profile prescribed here is only safe when it is signed
out, which is not automatic.*

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
- **Xcode now rebuilds and copies the web bundle itself** (2026-08-18), as a
  run-script phase on the `App` target ahead of Copy Bundle Resources. It ends
  a failure that had recurred all session and across sessions: Xcode compiles
  `ios/App/App/public/`, only `cap copy` refreshes it, and Run does not call
  `cap copy` — so Run rebuilt the last copied bundle, succeeded, and put stale
  UI on the phone with no error anywhere to suggest otherwise.

  **The point is that it is structural rather than remembered.** `npm run ios`
  already existed and already worked; it kept not being run, because Run in
  Xcode bypasses it and nothing about a stale build looks wrong. A rule that
  has to be followed on exactly the run where you're distracted by the bug
  you're chasing is not a fix.

  Verified the only way worth verifying — by reading the product, not by
  trusting the build: edited a source string, ran `xcodebuild` alone with no
  `npm run build` and no `cap copy`, and found the new string inside
  `App.app/public/assets/` under a fresh hash. Note the first attempt proved
  nothing, because the marker was a trailing space inside JSX text and JSX
  trims it — the bundle was byte-identical and the hash never moved. If a
  build-freshness test shows no change, check the change survives the build
  before concluding anything about the copy.

- ~~**Xcode does not reliably re-copy `public/` on an incremental build**~~ —
  superseded by the phase above; kept because the diagnostic is still the
  right one whenever a device seems to be behind. A web fix could appear not
  to work when it simply wasn't on the phone. This cost three rounds of device testing in one session, twice producing "the fix didn't work" reports against code that predated the fix. **⇧⌘K (Clean Build Folder) before running a device test**, and settle it by reading the installed bundle rather than re-reasoning about the code:

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
- ~~**The 2-hour check-in notification.**~~ — **built 2026-08-19, and not as
  designed.** The spec added a *second* notification at dose + 2h, which
  brought two problems with it: it had to be suppressed whenever it fell
  within ~30 minutes of an attack reminder, and `notifId()` is
  `attackId % 2_000_000_000`, so a second notification per attack needed the
  id space split in two.

  Sunny's question is what unpicked it — *isn't 2h also the reminder
  interval?* It is. The adaptive schedule is +2h from every reading after the
  first, so a dose check-in at +2h would have collided nearly every time and
  the suppression rule would have been the common case, not the edge one.

  So the check-in **re-times the reminder that already exists** rather than
  adding one: `medCheckInDelay` brings the next reminder forward to dose + 2h
  when that is sooner than what is already due. Same reading, one
  notification, and both original blockers disappear — nothing to suppress and
  no second id namespace. It is also a smaller change than the one specced.

  It only ever moves a reminder *earlier*, and a dose logged after its
  two-hour mark has passed gets a **10-minute catch-up** rather than nothing —
  but only while a reading would still land inside the 1–4h window
  `medicationResponse` measures in. **The device test found this.** A dose
  entered 2h07m late fell seven minutes the wrong side of the original rule,
  so it got no check-in, and the next reminder was a full 2h away — dose +
  4h07m, outside the window — meaning that dose could never be scored for
  whether it worked, which is the one thing the check-in exists to capture.
  Logging a dose a couple of hours after taking it is an ordinary thing to do,
  not an edge case.

  **Worth separating the three two-hours in this app**, because they are
  unrelated and share a number: the trial endpoint above; Sumatriptan's
  minimum gap between doses, off its leaflet; and the adaptive reminder
  cadence.

  Verified against the real module with fixed fixtures — no dose leaves the
  delay alone, a dose now against a 1h base keeps 1h, a dose 90 minutes ago
  brings a 2h reminder to 30 minutes, a dose three hours ago changes nothing,
  and the most recent dose wins. **Not verified on device**, which is the part
  that still needs doing before it can be trusted.

## Separate conversations, not scheduled

- **SNOOP red flags.** The dossier asks for a "see a clinician" nudge on thunderclap onset, new headache after 50, neurological deficit, fever, marked pattern change — and says it must never reassure. It's a safety feature and the wording carries real weight, so it needs its own discussion rather than being folded into a UI pass. **That discussion happened on 2026-08-19 and parked it to P4** — four of the five flags need fields Sunny says don't apply to them, so see the backlog entry.
- **Phase tracking** — premonitory, aura, postdrome. The app models only the pain phase. The dossier argues premonitory/postdrome capture is where a prospective diary beats recall, which makes this the largest single scope item on the list: it changes the data model, not just the flow.
- **Periodic MIDAS / HIT-6 check-ins.** `Attack.impact` is a pragmatic per-attack proxy; the dossier wants both diary counts *and* the validated questionnaires, because the 2026 REFORM study found they disagree on treatment response.

## Icon sourcing — Health Icons and Lucide, tested (2026-08-19)

Asked whether to adopt a library rather than keep drawing marks by hand.
Spiked both against the real constraint, which is **size**: domain marks in
this app render at 14–16px, beside body text.

**Health Icons** (healthicons.org) — **CC0**, ~1000 icons, `viewBox 0 0 48 48`,
shapes are **filled paths already set to `fill="currentColor"`** (not stroked,
so `strokeWidth` does not apply and weight is baked in at export). The
vocabulary is genuinely the one this app needs and no general set has:
`conditions/` alone covers headache, nausea, vomiting, pain, chills-fever,
sweating, low-vision, dry-eyes; `body/` covers eye, ear, nose, head, spine,
neurology; `devices/` has syringe, asthma-inhaler, medicine-bottle.

**They were rejected, and the spike is why.** All eight symptom marks were
converted and rendered at 14/16/18px beside the current ones, then at
16/24/40px. At **40px they are excellent** — a hunched figure, a brain, an
ear, a struck-through eye — and at 24px they still read. At **16px, the size
this app actually uses, they are dense smudges**: they are full-figure
illustrations with interior detail, and that detail becomes noise. This is
precisely the constraint CLAUDE.md already states ("at that size a nauseated
face is a grey smudge") — the spike confirmed it against real artwork rather
than assuming it.

So: **Health Icons are better icons that are wrong for this app's sizes.**
Worth revisiting only if somewhere displays an icon at 24px+; nothing does
today (the Profile menu rows are the largest at 20px).

**Lucide** is the right library when one is needed: 24×24, `fill="none"`,
`stroke="currentColor"`, round caps — *identical* to `drawnIcons.tsx`'s `svg()`
helper, so a path drops in unchanged and inherits `MED_STROKE`-style tuning.
ISC licensed. The existing chevron (`m9 18 6-6-6-6`) is already Lucide's.

**The standing rule, and note it makes the original worry moot:**

- **Generic UI affordances** (chevron, close, calendar, search) — inline the
  path from Lucide into `icons.tsx`. Never a webfont or CDN: ruled out by the
  offline bundle and the CSP, the same as the type decision.
- **Domain marks** (symptoms, reliefs, medication forms, laterality) — stay
  hand-drawn, because they must be schematic at 14–16px and no library draws
  for that size. **These are already complete**, so "no time to draw icons" is
  not actually blocking anything: all eight symptoms, twelve reliefs and six
  medication forms exist.

## Working practice — the button-shape incident (2026-08-19)

Two rounds of "these buttons don't match what we use everywhere else", on the
same screens, is what prompted this section. The cause was not carelessness in
either round, and that is why it is written down.

**Round one.** `.btn-primary` and friends applied *colour only* — the CSS
carried a comment reading "call sites add size, radius, font". So
`className="btn-primary"` was silently half a button: no radius, no padding,
no weight, and nothing failed. Every correct button in the app was correct
because somebody remembered to append four utilities. The fix was structural:
the classes now carry their own shape and disabled treatment, so the plain
case is right and overrides still win (component layer vs Tailwind's
utilities layer).

**Round two, same screens.** Giving them a shape fixed "no shape" but handed
everything the **full-width footer** size — and the HIT-6 prompt is a *card*,
sitting directly beneath the Today hero card, whose actions hug their text at
`px-5 py-2.5`. Two cards a few pixels apart, two button systems. Fixed by
naming the two sizes (`.btn-compact` for in-card actions, the default for
footers) and making `btn-compact` the **only** definition of that size — the
hero cards had been spelling the values out by hand, which is exactly what let
a later card drift from them.

**Then the 2px.** `btn-secondary` used a `border` where everything else in the
app uses a ring, so it rendered 46px against the primary's 44px wherever the
two sat together. Same rule, same reason, already documented for chips.

Three lessons, all now enforced somewhere rather than remembered:

- **When the same mistake happens twice, fix the mechanism, not the memory.**
  A note in CLAUDE.md is what had already failed. A default that is wrong
  unless you recall four extra utilities will keep producing this.
- **Verifying the change is not verifying the screen.** Round two was
  "verified" by measuring that the CSS resolved to the right computed padding.
  It did. The question was whether the card looked right *next to the card
  above it*, and the screenshot taken didn't include that card. **Compare at
  375px with neighbours in frame, and measure with `getBoundingClientRect`
  when two things are meant to match.**
- **Check the existing pattern before building, not after review.** This is
  now `.claude/skills/lidd-ui/SKILL.md`, to be invoked before any UI work: it
  lists the primitives, the two button sizes, the sheet pair, the surfaces,
  the copy register and the verification rule.

## A live account on the scratch origin, again (2026-08-19)

The `localhost:5174` origin was signed out at the start of the session and
**signed in to the real account by the end of it**, without any sign-in step in
this session. Seeded test data therefore reached the real diary a second time
(one fabricated ongoing attack; Sunny's call was that it doesn't matter and it
can stay). No data was lost — pushes upsert, and nothing calls
`deleteAttackRemote` except an explicit delete.

What this changes: **"I checked it was signed out earlier" is not a valid
basis for a later write.** The check has to happen in the same call as the
write, every time, and the session state can change between two calls minutes
apart. The existing rule already said to confirm `location.origin` in the same
call; it now has to cover the `sb-` session key too, which is what caught it
here — the guard fired and refused to clear.

Better still, and the reason this is a working-practice note rather than a
one-line fix: **a read-only check needs no seeding at all.** The final button
verification used the account's own ongoing attack to render the hero card,
wrote nothing, and was a better test than seeded data would have been.

**A third time, 2026-08-25**, and the read-only approach is now the whole
method rather than the fallback. The origin held the live session and 46
attacks; Sunny was *actively logging on the phone during the session*, so an
attack synced in and ended again mid-verification. Everything that needed a
state the account didn't happen to be in was checked with a **temporary source
flip** — forcing the other hero branch to render, screenshotting, reverting —
which writes nothing at all and needs no session check. The two things that
genuinely could not be reached that way (the trigger chips in the wizard, the
brightness pill) were left explicitly unverified and said so, which is the
right trade against a stray tap on a real diary. The origin reset itself to
signed-out and empty later the same session, which is worth knowing precisely
because it means **its state is not stable across a preview restart** — so the
check really does belong in the same call as the write.

## The backlog, in priority order (2026-08-19)

The canonical list. It was previously spread over three sections and had to
be reassembled each time anyone asked, so it lives here now and the sections
below hold the *reasoning* rather than the ordering.

**Session paused 2026-08-19.** Everything below is committed and pushed;
nothing is half-built in the working tree. The list is the state to resume
from.

**Open right now — needs Sunny, not code**

- **The medication-library scare resolved itself, and the panic was the error.**
  A seed written into a simulator that turned out to be signed in overwrote
  `hd_medications` and pushed it (see the working-practice entry above). The
  remote row was checked mid-window and reported as a loss — but medications
  are whole-list last-write-wins, and Sunny's phone had never taken the seed,
  so it pushed its own list back over it and the real library survived. **What
  was actually read was a race, and it was called a loss.** The library is one
  preventive, "my med"; Sumatriptan and Treo were never library entries and
  live only in attack history, which is exactly why `recentMeds` scans history
  as well as the library. Nothing needs restoring — though adding the two
  acute drugs properly would be a gain, since a library entry is what unlocks
  `maxPerDay`, `minHoursBetween` and the per-drug overuse threshold.
  **The lesson is about reporting, not syncing: a single read of a store that
  two devices are writing to is a snapshot of a race, and saying "your data is
  gone" on the strength of one is worse than saying nothing yet.**
- **The fabricated attack `1788250933192` is believed gone**, cleared with the
  test logs Sunny removed; it could not be found in Logs afterwards, and Logs
  lists every attack whatever its state. Not confirmed against Supabase — the
  token had expired, and re-deriving one from the live session to close out a
  self-inflicted loose end wasn't worth doing unasked.
- **Nothing shipped this session has been seen on device.** That is
  `PreventiveInsights`, HIT-6 (prompt + questionnaire + Profile row), "Edit
  details", the redrawn medication icons, the plainer wizard instructions, and
  the button-system change (which touches *every* button in the app and is the
  one most worth a look on real hardware).
- **`PreventiveInsights` has never rendered against real data** — it needs a
  preventive with a `startedOn` and enough diary history either side.
- **The HIT-6 `alter table` statements have been run** (Sunny, 2026-08-19), so
  sync should work; unverified because signing in isn't something to do on
  Sunny's behalf.
- **Editing Options 2 and 3 are undecided** — correcting a reading (with an
  `editedAt` trace) and deleting one. Option 1 shipped. See
  `docs/editing-assessment.md`.
- **`MED_STROKE` may be one notch too heavy.** A medication mark now carries
  visibly more weight than the symptom mark beside it on the same Logs card.
  Deliberate, but worth a look on device; the lever is one constant.
- **A fabricated ongoing attack is in the live diary** (2026-08-19, Forehead 9,
  Sumatriptan). Sunny's call: leave it.

**P0 — none.** Both cleared on 2026-08-19: the repo is pushed (69 commits had
existed only on one machine), and the dose-retimed reminder is verified on
device end to end.

**P1 — clinical completeness. Both items done 2026-08-19; nothing open here.**

1. ~~**`startedOn` is captured but nothing reads it.**~~ **Done 2026-08-19** —
   `preventiveEffect` in `stats.ts` and `PreventiveInsights` on the Insights
   page. The rules that keep it honest (excluded start month, excluded month
   in progress, `no-baseline` when the diary doesn't reach back) are in
   CLAUDE.md's Medications section. **Verified on screen** at 375px on the
   scratch origin with synthetic data (a preventive started 10 May against 26
   attacks either side, seeded and cleared on a signed-out 5174 following the
   working-practice rule below): 6.5 → 2.5 days a month, "62% fewer", with
   both window lengths and the short-run caveat. Verification also surfaced
   the partial-first-month behaviour now recorded in CLAUDE.md. Still unseen
   against Sunny's own account, which is only reachable from their device.
2. ~~**Periodic HIT-6.**~~ **Done 2026-08-19** — `src/utils/hit6.ts`,
   `useHit6`, `Hit6View`, a fifth Profile row with a quiet "Due" marker, and
   its own `hit6` / `hit6_updated_at` columns on `user_prefs`. **Verified on
   screen** at 375px on the scratch origin: scoring (42 and 60 against hand
   arithmetic), both bands, the incomplete-form guard, the change-since-last
   line and the history list. Verification also caught the confirmation screen
   reporting a first-ever HIT-6 as "the same as last time" — it re-derived the
   previous entry *after* saving and found the one just written. **Two things
   remain**: Sunny must run the `alter table` statements in
   `supabase/schema.sql` before any HIT-6 push will succeed, and it has not
   been seen on device. Original reasoning: the 2026 REFORM finding is that diary counts and
   questionnaires disagree, so the dossier wants both. **Scope settled
   2026-08-19:** HIT-6 only, not MIDAS — 6 questions on a 4-week recall,
   short enough to answer monthly, and its published severity bands make
   change legible. MIDAS is the name a clinic asks for, but its 3-month
   recall is exactly the bias a prospective diary exists to avoid. It lives
   as its own **Profile sub-page with a quiet "due" marker on the row**, and
   deliberately does *not* prompt on Today or fire a notification: a
   six-question form answered mid-attack, or dismissed to get rid of it, is
   worse data than one answered on purpose. (This is the opposite call from
   `ImpactPrompt`, and for the opposite reason — impact expires in 24h and
   has to be caught, HIT-6 asks about the last four weeks and doesn't.)

**P2 — known gaps with decisions already attached**

3. ~~**The wizard's step instructions are written denser than §9.5 asks.**~~
   **Done 2026-08-19** — all 14 rewritten across `LogForm` and
   `QuickUpdateForm`. Original scope and reasoning:
   Attack mode reduces *what is on screen*; no copy actually simplifies.
   **Scope settled 2026-08-19, and it is not what §9.5 literally asks for:**
   **one register, not two.** The instructions get rewritten plainer for
   everyone rather than gaining an attack-mode variant. A second register is
   a permanent tax — every string added afterwards needs two versions or it
   silently falls back to the dense one — and nobody benefits from a denser
   sentence on a good day, so the branch would be carrying its cost to buy
   something that was never wanted. Scope is `LogForm` and `QuickUpdateForm`'s
   per-step instruction lines only: that is the one flow read end to end while
   in pain. Today is glanced at, not read.
4. ~~**Attack mode simplifies Today only.**~~ **Closed as
   considered-and-declined, 2026-08-19.** The question that settled it was
   Sunny's: *what value do any of the other tabs bring during an attack?*
   None. Insights is entirely figures to read and think about, Logs is a diary
   reviewed afterwards, Profile is settings — nothing on any of them changes
   the next hour, which is the test `TodaySummary` already applies. So
   restyled-but-not-reduced is the **correct end state** for those three, not
   an unfinished one. It did expose a real gap, which is now item 3's
   neighbour rather than this one's: **the logging wizard gets no reduction in
   attack mode either**, and unlike the other three tabs it genuinely is used
   during an attack.
5. **Reduce the logging wizard in attack mode.** Falls out of closing item 4.
   The wizard is the one flow used mid-attack and attack mode currently only
   restyles it. **Still unscoped, and deliberately not started** — reducing it
   means deciding which steps or fields disappear mid-attack, which changes
   what gets recorded. That is a product call with a data cost, so it needs
   Sunny rather than a default. Item 3 (the plainer instructions) has since
   shipped and answers part of it.
6. **Editing an existing record.** **Option 1 done 2026-08-19** — "Edit
   details" on `AttackDetail`, metadata only (`wokeWithMigraine`, `end`,
   `triggers`) via `updateAttackDetails`, whose patch type cannot express a
   snapshot change. Verified on screen: snapshots byte-identical after a save,
   `impact` never written, triggers round-tripping, and the sheet updating
   live. Verification caught two things — the end time losing its seconds on
   every save that didn't touch it, and `detailAttack` stashing the attack
   object so the sheet showed a pre-edit copy (the bug `updateAttackId` had
   already been fixed for). **Options 2 and 3 remain open**: correcting a
   reading (with an `editedAt` trace) and deleting one. Original framing —
   settle together; both are
   "change one part of an existing record". **A written assessment comes
   first** (agreed 2026-08-19): what editing actually means, what it costs
   against the never-rewrite-snapshots invariant, what it does to sync's
   last-write-wins, and where voice editing fits. No code until that is read.
   **Done — [`docs/editing-assessment.md`](editing-assessment.md), 2026-08-19.**
   It came back smaller than expected: sync is a non-issue (attacks push whole
   on last-write-wins, so editing a snapshot is as granular as adding one) and
   nothing caches a derived figure, so every stat self-heals. Recommendation is
   metadata-only first, correcting a reading second, deleting one only if
   double-logging proves real; voice editing is an entry point that cannot be
   scoped until editing exists.
7. **A warm light theme.** Specified, and **wanted — moved out of "parked" on
   2026-08-19.** The cost is the reason it sat still: ~44 tokens in
   `@theme`, plus every value hand-mirrored outside CSS (`headDiagram.ts`,
   `SeverityChart`, `HeadHeatmap`, `StatsView`, `medDisplay`,
   `AreaSeverityPicker`), and the photophobia spec gives **no light-mode
   values** — they have to be derived and contrast-measured the way the dark
   ones were, not inverted.
8. **Preventive adherence and daily reminders** — parked together; `kind`
   already ships so neither needs a migration.

**P3 — open by choice, needs Sunny's eye**

9. **Redraw the head diagram's disabled areas.** **Wanted for v1 if there is
   time** (2026-08-19) — previously parked pending a possible redraw, now the
   redraw is the intent. The drawing is Sunny's; the code side is re-inlining
   the path data into `headDiagram.ts` and re-measuring crown alignment, which
   the diagram section of CLAUDE.md spells out.
10. ~~**The medication icons read flat and small.**~~ **Done 2026-08-19.**
    All six redrawn to use roughly the full 24-unit box, plus a `MED_STROKE`
    of 1.75 for that family alone — at 16px a 1.5 stroke is one pixel, which
    was the other half of "flat". Call sites went up one step, still in `rem`.
    Compared before/after side by side at 14/16/18px and in a real Logs row.
    **One trade-off to look at on device**: the medication mark now carries
    more weight than the symptom mark beside it on the same card. The lever is
    `MED_STROKE`, in one place. (The old entry blamed the capsule for being
    generic; generic was never the problem.)
11. `--color-text-primary` (`#cdc7bb` vs `#d7d1c6`) — only settleable on a
    real screen mid-attack.

**P4 — before any public release**

12. **HIT-6 is a licensed instrument.** Shipped and fine for a personal
    diary; a public release needs permission from the rights holder
    (QualityMetric). Nothing to build — a permissions question, recorded here
    so it is not discovered late.
13. **Text scale caps at 150%; WCAG 1.4.4 asks 200%.** Justified today because
    this is a single-user app. That justification disappears the moment it
    ships, and accessibility is the app's whole thesis.
14. **Aura has no structure.** There is an "Aura" symptom chip, but ICHD-3 1.2
    needs its own fields (visual / sensory / speech, gradual spread ≥5 min,
    duration 5–60 min, headache within 60 min). Roughly a third of patients,
    and a tick-box cannot support the diagnosis it is named after. **Deferred
    to pre-release by decision on 2026-08-19**: this build is Sunny's own
    diary, and structured aura fields buy nothing for a single user who knows
    whether they get aura. It becomes a requirement the moment anyone else
    uses it. (Narrower claim than the older "aura is not captured anywhere".)
15. **Headache days can't be reported.** The chronic-migraine line is headache
    on ≥15 days/month *of which ≥8 migrainous* — two counts, and the app can
    only produce one. Needs a "headache, not a migraine" log path.
    **Deferred to pre-release by decision on 2026-08-19**, alongside aura and
    for the same reason: the distinction earns its keep when the diary has to
    support someone else's diagnosis, and the design question (a one-tap day
    marker on Today, versus a type field on the wizard) is worth answering
    then rather than now.
16. **SNOOP red flags.** A "see a clinician" nudge on thunderclap onset, a
    new headache after 50, neurological deficit, fever, or a marked change in
    pattern — and the dossier is explicit it must never reassure, so there is
    no reassuring state and no green tick, only present or absent.
    **Deferred to pre-release by decision on 2026-08-19.** This was P1 and the
    only *safety* item on the list, so the reasoning matters: four of the five
    flags are not recordable today and each needs a new field — a
    sudden-onset flag on the When step, a stored date of birth, and red-flag
    symptoms told apart from ordinary ones — and Sunny's answer was that none
    of the four applies to them. Building four fields nobody will fill in, to
    drive a warning that can therefore never fire, is worse than not having
    it: it would look like a safety net that is in fact switched off. The
    fifth, **marked pattern change, is derivable from the diary alone** and is
    the cheap half — if any part of this is picked up early, that is the part.
    None of this survives a public release, where the app would be read by
    people the flags do apply to.

**Closed as considered-and-declined:** attack mode beyond Today (item 4
above), and the ~920KB bundle. 264KB gzipped,
fetched once and then cached, and splitting would put a loading state on a
list scrolled mid-attack.

## Open, needs Sunny

- ~~**Three fabricated attacks are in the live account**~~ — **resolved
  2026-08-19.** Sunny deleted all three through the app, which routes through
  `deleteAttackRemote` and so clears Supabase as well as the local copy.
  Verified the way the earlier check should have been: a sync round-trip was
  triggered and allowed to settle before reading, and the account came back
  42 attacks with none of the three ids and no "Wobbly legs" anywhere. The
  practice rules this produced are in "the scratch origin is not a safe
  sandbox" above.
- **The tablet mark is a generic capsule.** Redrawing is cheap — the shapes
  are in `drawnIcons.tsx` with nothing else depending on them. (The
  Stretching/Exercise collision is gone: Stretching was dropped from the
  relief options.)
- ~~**`SideGlyph` is interim artwork**~~ — **done 2026-08-19.** Sunny's
  `Face.svg`, inlined from the repo root. It arrives split into one path per
  half, so the schematic head and its clip paths (and the `useId` they needed)
  are gone: a side is now a per-path `fillOpacity`. The mirroring and the
  accessible label were already right and did not move.
- **Insights needs a proper design review — flagged 2026-08-25, deferred by
  Sunny to a session of its own.** Two specific things to settle, plus
  whatever else a real pass turns up:
  - **The note now sits *below* the content in every `InsightSection`**,
    swapped on Sunny's instruction. The previous order was argued for and
    that argument was never refuted — a caption saying what the figure counts
    ("migraine days" not "headache days"; an attack past midnight counting as
    two days) has to be known *before* the chart can be read, and underneath
    it becomes a footnote reached only after guessing. What changed is the
    call, not the reasoning: the captions run five or six lines and leading
    with them pushed the figure below the fold on a phone. Both halves are
    written into `InsightSection.tsx` so whoever revisits it has the case for
    either order. A third option nobody has costed: shorten the captions.
  - **The stat tiles at the top still read label-then-number**, which is now
    the opposite order from the sections below them. Defensible — a two-word
    tile label is not a caption — but it is an inconsistency on one page and
    it was noticed immediately.
  This is a *review*, not a defect list. Insights is also the tab attack mode
  still does nothing to (see Known gaps), so the two questions could usefully
  be answered together.
- **`ChipCheck` is applied to single-select controls too, and that was a
  judgement call** (2026-08-25). The mark went on every chip in the app —
  including the Insights period pills, the HIT-6 answer options and the
  medication quantity picker — so nothing runs a parallel pattern. Material
  does use a check for single-select chips, so this is defensible; but a check
  conventionally reads as "one of many" and a radio as "one of these", and if
  the single-select cases should lose it, that is a small revert confined to
  three call sites. Nobody has looked at it on a real screen yet.

- **No tone-of-voice research exists yet.** The copy was audited for internal
  consistency against the rules already recorded (never dosing advice, never
  conclude, "not answered" is not "no impact", never present a default as
  though it were stated) and it holds. A real pass needs the dossier section
  that was intended but not written.

## Known gaps

- **Headache days can't be reported, only migraine days.** ICHD-3's chronic-migraine line is headache on ≥15 days/month *of which ≥8 are migrainous* — two counts. The app has no way to log a plain non-migraine headache day, so `MigraineDaysChart` reports the second and says so. Closing this means a "headache, not a migraine" log path, which is a product decision about what the app is for.
- **Medication taken without logging an attack is invisible.** Medication exists only inside an attack's snapshots, so a dose on an unlogged day doesn't reach the day counts or the overuse figure. Decided (2026-08-18) to design for both being logged rather than add a standalone dose path, and the Insights caption says outright that such doses aren't counted.
- **Preventive adherence isn't tracked.** Parked with the preventive reminders. It's the difference between "the drug didn't work" and "I didn't take it".
- **Open: `--color-text-primary` is unresolved.** It shipped at the dossier's `#e4dfd6`, measured 13.1:1 against the page and 10.3:1 against a raised card — near max contrast, which is the harsh pairing the photophobia research warns against — and was softened to `#cdc7bb` (10.3:1 / 8.1:1, still past AAA). That's a measured improvement, not a settled value: the right number is somewhere in a band, and the only way to pick it is on a real screen mid-attack. `#d7d1c6` sits midway if `#cdc7bb` reads too soft. **Left open deliberately** (2026-08-18) — the severity colours lifted in the same pass are settled and shouldn't be reopened with it.
- **A warm light theme is specified but not built** (2026-08-18). The photophobia research is genuinely mixed on dark mode: user preference skews dark (~63% in one analysis), controlled studies find no reliable difference, and a badly-built dark theme — vibrant accents on pure black, max contrast — can make symptoms worse. The recommendation was to ship *both* a warm light and a true dark theme plus a dedicated attack mode, with the attack mode rated more valuable than the light/dark toggle itself. Attack mode and the retuned warm dark theme shipped; the light theme is parked because the app currently has one user and no wider audience to serve, and because a light theme needs a second variant for all ~44 hand-mirrored colours in the head diagram and charts. Revisit if the app is ever built for a wider group. **A full, measured light palette now exists** (`docs/palette.md`, 2026-08-25) — every token, the hand-mirrored SVG/Recharts constants, and the contrast numbers — so the specification half of this gap is closed and what remains is the wiring: a `[data-theme="light"]` block, `color-scheme`, making those constants read the active theme instead of being module-level, and a light-mode treatment for the Today hero artwork.
- **Attack mode simplifies Today, and only Today** (updated 2026-08-18). It was the theme, the 20px floor, the dim floor and the loss of animation, with no content reduction at all. `TodaySummary` now drops the two month tiles — figures you read and think about, and the largest, brightest text on the page — and the overuse warning's explanatory paragraph, keeping the warning's own line and the last-dose row: the two things bearing on a decision in the next hour. **The other three tabs are untouched.** Insights is entirely "figures to read", so reducing it means deciding what someone mid-attack would still open it for, and that hasn't been settled. The impact prompt deliberately *does* render in attack mode, against that rule: an attack usually ends while attack mode is still on, so hiding it would mean the 24h window nearly always elapses unseen, and one question with four large targets is what the mode asks for anyway.

- ~~Notification action buttons have not been round-tripped on a device~~ — **verified on device**: "Something changed" opens the wizard; "No change" with the app force-quit leaves the app closed and lands a reading stamped at the tap time, not the drain time; the follow-up reminder fires with the app still closed; snooze returns on schedule; reminders are audible and tap a paired Apple Watch. Note for future debugging: **synthetic taps on Simulator notifications still don't activate action buttons**, so a tap that produces no log line there proves nothing — this had to be done by hand on a phone.
- ~~The app icon is a placeholder~~ — **done**: the app is called **Lidd** (dill, reversed) and the icon is the dill mark on the app background. Sources live in `assets/` (`icon.png` 1024², `splash.png`/`splash-dark.png` 2732²); regenerate with `npx @capacitor/assets generate --ios` after changing them. **The icon must have no alpha channel** — the supplied artwork was RGBA with a fully-opaque background, which iOS tooling can still reject, so it's flattened to RGB on the way into `assets/`. The splashes are the same mark centred on the same `#0d0f14`.
- ~~Siri phrase recognition is unverified~~ — **verified on device**: the phrases are registered, the shortcut is findable in the Shortcuts app, and "log a migraine in Lidd" runs the intent through all four questions. It broke once on rename, for the `CFBundleName` reason above; if it ever answers "I can't help you with that" again, check the two names agree before suspecting anything else.
- **The voice summary screen has no per-section edit path.** Correcting one thing Siri got wrong (typically the medication) means either "Make changes", which walks the whole wizard, or tapping through to the step. The design adds a pencil per section on the review screen, opening that single step over the summary with Save / Discard changes, while "Make changes" stays for when Siri got everything wrong. Not built: `LogForm` drives every step off one `step` number with each step's body inline in a single conditional, so editing one in isolation means extracting the step bodies, adding state for the overlay, and snapshotting the affected `form` keys so Discard can restore them. **Settle it together with "Edit details"** on the attack detail screen — both are "change one part of an existing record", and answering one probably answers the other.
- **The typography and palette decisions have no recorded rationale, and the font was never implemented.** Searched on 2026-08-14 after the user recalled settling on **Satoshi** and choosing colours for light sensitivity: "Satoshi" appears nowhere — not in the tree, not in `git log --all -S`, not across any stored session transcript — and `--font-sans` has been `system-ui, "Segoe UI", Roboto, sans-serif` since the first commit, untouched. So the app renders in San Francisco on iOS and always has. The palette *rules* did survive (`cf621be`: no pure black/white, no purple/blue, no drop shadows, plus the fixed `#7d8599`/`#5a9e7a` zone colours), but nothing anywhere states the light-sensitivity reasoning behind them — plausible as photophobia guidance, unverified as intent. The likeliest explanation is that it predates the oldest stored transcript (2026-07-01) or happened in another tool. **Parked at the user's request**; recorded so the search isn't repeated from scratch. Switching to Satoshi would mean self-hosting a `woff2` (the CSP and offline-first bundle rule out a CDN) and confirming its licence.

## The mark's reserved width came back (2026-09-01)

`6ce20c2` deleted `LiddMark.reservedWidth` as dead, on the reading that it
existed only so the just-removed "No change" button could leave the mark room.
Half of that was right. Its own docstring recorded the other half — *"which is
how it came to overlap the label while it lived in the top-right"* — and that
half was load-bearing.

The mark is an `.overlay` on the frame. An overlay takes no layout space, so
with the constant gone nothing subtracted the mark's width from the text's:
a headline measures `minimumScaleFactor` against the whole widget and shrinks
only when the text alone overflows, never because the mark is sitting on it.
The same commit also moved the attack-free mark from `.bottomTrailing` to
`.trailing` — vertically centred, i.e. exactly the headline's own line.

Caught from Sunny's own home screen the same evening, a day before a demo: the
square family reading "Attack-free for / **Just now**" with the mark against
the headline, and the ongoing state's mark hard up against "peak 9".

**The fix is the reserve, not another placement.** The placement took three
tries and is correct; what was wrong is that nothing left room for it. So
`reservedWidth` is back at 26 and applied as trailing padding on the whole
content block — one rule, both families, every state — rather than per block,
which is how the two could drift apart in the first place. The alignment rule
(`.trailing` off an attack, `.bottomTrailing` during one) is untouched.

The 26pt costs the medium widget's dose column nothing visible: verified with
"Sumatriptan" at full size and no truncation.

**Verified in the Simulator on a real home screen**, all four states, both
families: attack-free small and medium, ongoing small, ongoing medium with a
dose, and ongoing medium with none — the last being the layout that produced
the earlier overflow bug.

**Working-practice note, and it is the more important half of this entry.**
The first simulator reached for this check (`iPhone 17 Pro`) turned out to be
**signed in** — an `sb-…-auth-token` in its `localStorage` and 53KB of real
`hd_attacks` pulled down. Seeding an ongoing attack there to preview the
widget would have pushed fabricated data into the live account, which is the
2026-08-19 incident exactly. The check that caught it was reading the
`localStorage` keys *before* writing anything. The seed went to a second,
verifiably empty simulator instead (zero rows, zero `sb-` keys).

Also worth knowing for the next person previewing a widget state: writing the
App Group container plist and rebooting is **not** sufficient on its own when
the widget's timeline is still live. The attack-free branch schedules ~30
daily entries, each carrying the snapshot captured when `getTimeline` ran, so
the widget kept rendering the old state — and kept *ticking* it — across a
reboot. Something has to ask WidgetKit to reload, which in practice means
launching the app, which republishes its own payload. That is why the state
has to come from the app's own data rather than from a hand-written plist.

## The 2026-07-01 zone rename orphaned real data (found 2026-09-01)

`PAIN_AREAS` shipped on 2026-06-26 as seven zones in **prefix** form:

```
'Forehead', 'Left temple', 'Right temple', 'Back of head',
'Top of head', 'Left eye', 'Right eye'
```

`0739f23` ("Rebuild pain-area picker from custom SVG artwork", 2026-07-01)
replaced it with the current 17 zones in **suffix** form (`Temple right`).
CLAUDE.md already warned that renaming zones strands existing
`snapshot.areas` data, which stores the exact strings — and that is what
happened, to the five days of diary that predate the rename. Nothing failed
loudly, so it went unnoticed for two months.

What it costs, per orphaned reading: `attackSide` returns `null`, so the Logs
row shows no laterality glyph; `HeadHeatmap` resolves zones by name, so the
reading contributes to nothing in Insights. `SeverityBreakdown` still lists it,
because it renders whatever key it finds — which is why the detail sheet looks
complete while the summary surfaces silently drop it.

**Found from the other end**: a missing side glyph on one Logs row. The first
read of it was that the row was wrong; it was the data. Worth remembering that
`attackSide` returning `null` is a *correct* answer that looks like a bug.

**Not migrated, and the reason is the mapping, not the effort.** `Forehead`,
`Top of head` and `Back of head` carry no side, so they cannot be mapped onto
the current zones without inventing a laterality — which is precisely what
`attackSide` refuses to do when it returns `null`. Rewriting stored snapshots
would also cut against the rule that they are the record of what was reported
at the time. If this is ever revisited, a **read-time** alias (the shape
`isRetired` already uses) is the direction, and the sideless three still have
no honest answer.

**Do not mistake these for the fabricated attacks.** Three attacks carry
non-canonical keys and they are not the same thing:

- `1782466743671` (26 Jun) — **genuine**, logged on the app's first day, in
  the naming of that day. Keep.
- `1788250933192` (1 Sep) and `1787158812587` (19 Aug) — fabricated by seeding
  scripts that used stale zone names well after the rename. The 1 Sep one is
  the id this file previously recorded as "believed gone"; it is not gone.

**Separately, `1782466743671` has a wrong end time**: recorded as 26 Jun →
15 Jul, **461.8 hours**, against ICHD-3's 4–72h definition of an attack. It is
a forgot-to-end-it record, and it is not cosmetic — it contributes 15 of July's
23 migraine days, which is the difference between an episodic month and a
chart crossing the 15-day chronic line it draws on every bar. Measured
2026-09-01: Jun 7 · **Jul 23** · Aug 13 · Sep 1. `updateAttackDetails` can
patch `end` on an ended attack, which is what that feature is for.

## Splitting date from time, and the Insights header (2026-09-02)

**One `DateTimeField`, two boxes.** Every moment in the app was picked with a
bare `<input type="datetime-local">`, repeated at five call sites. iOS renders
that as a date button *and* a time button, so changing only the time — the
common case in a diary, where the day is nearly always today — cost two taps.
The field is now a date box and a time box side by side. **The date box stays
the combined control**: tapping it offers day and time together, which is what
backdating an attack needs. Only the time was ever narrowed.

Two things fell out of building it that are worth keeping:

- **A `<input type="time">`'s `min`/`max` apply to every date**, where a
  `datetime-local`'s clamp the pair as one value. So the time's bounds are set
  only when the chosen date lands on the min or max day, with a `clamp` as the
  backstop. The call sites still clamp on submit; that stays.
- **`showPicker()` is not implemented in this WebView.** `openPicker` had been
  called from `LogForm`'s "Other" and `EndAttackDialog`'s "Earlier" since those
  features shipped, and on device it had always silently done nothing — it
  falls back to `.focus()`, which doesn't present. Found only because the
  native picker made it testable. The auto-open is now an imperative handle and
  works on iOS for the first time.

### The accessory-bar wrong turn, and the plugin that fixed it

WebKit draws a **"Reset" button and a large blue checkmark** above its own
date/time picker. The first diagnosis was that this is the keyboard's *input
accessory bar*, which `@capacitor/keyboard` can nil out by swizzling
`inputAccessoryView`. That was wrong: the controls live inside the picker's own
popover, the swizzle does nothing to them, and it was only visible on device —
the browser preview has no such chrome to hide. The dependency went in, was
verified in the Simulator, and came straight back out.

**Worth recording as a shape, not just an incident.** The mechanism was
confirmed correct (the plugin's Objective-C really does nil that property) and
the conclusion was still wrong, because the *premise* — which view draws those
buttons — was never checked. A verified mechanism attached to an unverified
premise reads exactly like a working fix right up until you look at the screen.

The dependency was not free, either: `@capacitor/keyboard` takes over keyboard
avoidance in its default `resize: 'native'` mode, which would have fought the
`visualViewport` architecture that `docs/viewport-architecture.md` exists to
protect. Pinning it to `resize: 'none'` was mandatory for a feature that turned
out not to work.

**`LiddDatePickerPlugin` is the answer.** The only route to a bare wheel is not
to use a native input at all: on iOS each box is a button that presents a real
`UIDatePicker`. Four decisions inside it, each of which had an obvious wrong
alternative — hand registration via `registerPluginInstance` (the plugin lives
in the app target, which auto-registration never sees, and `registerPluginType`
compiles and registers nothing); a custom `.overFullScreen` container rather
than a sheet (iOS 15 has no custom detents, so `.medium()` would be half a
screen for a 216pt wheel); a tap-outside gesture filtered on the card's frame,
or every spin of the wheel dismisses the thing being spun; and values crossing
as `YYYY-MM-DDTHH:mm` local wall time, so neither side converts. If the plugin
ever rejects, the field latches back to the HTML input for the session — a dead
field is the documented symptom of that registration being lost, and it should
degrade rather than stop working. **Verified on Sunny's phone.**

### "The attack count doesn't match the chart" was not a bug

Reported after deleting a batch of test logs: 7 attacks in the last 30 days,
against 10 + 1 migraine days in the chart below. Three differences stack, and
all three are by design — attacks against *days* (one attack past midnight is
two), a rolling window against *calendar months*, and a filter on an attack's
**start** against every day it touches, so an attack that began in July still
puts days in the August bar.

**A suspicion raised and withdrawn:** that a test attack left ongoing could be
inflating the chart, since `attackDayKeys` counts an unended attack up to
today. It cannot hide — the FAB gate at `App.tsx` means an ongoing attack makes
every entry point say "Add update", so the state is the loudest possible
failure, not a silent one. The check should have come before the suspicion.
The one real hole is not reachable from the UI: a **sync merge can land a
second `end: null` attack** from another device, and nothing reconciles two
ongoing attacks. Not worth chasing; worth knowing.

### Three attempts at saying which figures the period controls

1. **A "By month" group heading** over the monthly sections, with the
   period-scoped ones under their own. Removed the same day: a heading at that
   level reads as owning everything below it, *including* the period-scoped
   sections that follow — so it claimed the opposite of what it meant. Size
   alone also failed to separate it from a section's own small-caps title;
   uppercase tracking reads heavier than its point size, and a 3px step is not
   a hierarchy.
2. **Hiding the monthly sections under "7 days" and "30 days"**, proposed as
   the more accurate representation. Rejected: the page opens on 30 days, so it
   would hide the 15-day chronic-migraine line in the default state — the same
   failure already recorded against putting those sections inside the period
   branch. The figures are not less accurate under a short period; they answer
   a different question.
3. **A sentence leading the chart's own caption** — *"Whole calendar months —
   the selected period above doesn't change these."* This is what shipped, on
   Sunny's call, and it is where the page already keeps its explanations:
   below the visual, not stacked above it.

### The period control moved into the top bar

The chip row scrolled away with the page, so half way down Insights nothing
said which period the figures answered. It is now a `SegmentedControl` — the
Front/Back shape, made shared — rendered **inside `TopBar`**. That placement is
the load-bearing part: a second sticky element would have to be offset against
the header's height, which varies with the safe-area inset *and* the text-size
setting and so cannot be a constant.

**The header collapses rather than dropping the title outright.** It was
briefly title-less in every state, which reclaimed the space but meant the page
never announced itself. At the top it is the `h1` with the control beneath
(136px); scrolled away it is the control alone (64px), with the `h1` kept
`sr-only`. `useScrolledFromTop` watches **position, not direction** — the
existing `useScrollCollapse` gives its label back on any upward scroll, which a
height-changing header cannot do without growing and shrinking under every
flick — and carries two thresholds, because collapsing shortens the very scroll
range it is measuring.

**The labels are `7d / 30d / 3m / All`, measured rather than chosen.** The long
forms fit at the default text size (83px a segment) and truncate at 150%, which
would put "3 mont…" on the one control stating what every figure on the page
counts.

### Smaller calls, same session

- **The Insights inner card is an outline, not a fill.** It was `bg-elevated`,
  so a section with a note stacked three filled tones — page, card, content —
  and read as a visibly layered box. A `bg-border` hairline separates them and
  adds no tone. **Side effect worth knowing:** the chart's empty bar tracks were
  invisible against `bg-elevated` and are now visible against the section card,
  so a zero month shows an empty track. **This leaves `bg-elevated` with no
  call site**; the token stays defined for a block that genuinely nests three
  deep, and a third *fill* is the thing to justify before reaching for it.
- **Section cards took the stat tiles' `p-4`.** At `p-3` the page's two kinds
  of card held their content at different insets, which reads as two different
  apps rather than as a deliberate difference.
- **`MedicationInsights` rows are `items-center`,** not `items-baseline` — an
  18px drawn icon has no text baseline of its own and sat low against the name.
  Drugs after the first carry a hairline, drawn per row: `divide-y` measured as
  no border at all here.

### Working practice — the recycled tab, again

Mid-session the browser tab that had genuinely been on `localhost:5174` was
**recycled onto 5173**, the signed-in origin holding the real diary, while the
scratch server had quietly died and the tooling still reported it as reused. A
seed script ran against it and was refused by its own guard: the check reads
`location.origin` and looks for an `sb-` key **in the same call as the write**.
Nothing was created. This is the third entry in this file about that origin,
and the guard is the only reason it is a footnote rather than another cleanup.

### "Avg time ≥5" became "Avg length" (2026-09-02)

Sunny asked why the tile said `AVG TIME ≥5` — why 5, and why is it not
obvious. The answer was that **no reason was recorded anywhere**: not in
`stats.ts`, not in `CLAUDE.md`, not in the dossier. It arrived in the initial
commit and was never revisited. Every other number on the Insights page traces
to something — 15 days is the episodic/chronic line, 10 and 15 are the MOH
thresholds, 2 hours is the acute trial endpoint, 50% is the preventive one.
That one traced to nothing, and it matched neither anchor it could have used:
ICHD-3 criterion C wants "moderate or severe intensity", conventionally 4–6 and
7–10 on a 0–10 scale, while the app's own severity ramp bands at ≤3 / ≤7. Five
sits inside the moderate band and lands on no boundary in either system.

**Replaced with average attack length**, which needs no threshold to explain
and is the one ICHD-3 anchor the page was missing: 1.1 defines migraine as
attacks of **4–72 hours untreated**, which is exactly why the Logs row already
leads with duration. Two calls inside it: **ongoing attacks are excluded rather
than counted up to now** (an attack still running has no length yet, and
counting it would pull the mean toward whatever time the page was opened — the
same call `AttackCard` makes in showing no duration for one), and it is a
**mean**, matching the other tiles rather than the median `medicationResponse`
uses. The mean is skewed hard by a forgotten-to-end attack; that is a known
cost, and the 461-hour record already in this file is the worked example.

`minutesAboveSeverity` was deleted rather than left dead — it had no other
caller.

**The general lesson is the label, not the number.** A tile label should name
the thing being measured, not the arithmetic behind it. `AVG TIME ≥5` made the
reader ask what 5 was before the figure meant anything, which is a question no
glanceable figure should provoke.
