# Lidd — a migraine tracker built for the moment you can't think straight

**Role:** design + engineering (solo) · **Timeline:** Jun–Aug 2026, ~100 commits · **Stack:** React 19, TypeScript (strict), Tailwind v4, Vite, Recharts, Supabase, Capacitor/Swift

---

## The problem

Migraine tracking apps ask you to fill in a form. That's the wrong interaction for the condition: the person logging is photophobic, nauseous, and often can't hold a thought long enough to finish a multi-field entry. Worse, most apps model an attack as *one record with one severity number* — which throws away the thing a neurologist actually wants to see: how the pain moved, where it spread, and whether the medication did anything.

Lidd is built around two bets: **an attack is a time series, not a row**, and **every path out of the app has to work at 3 severity levels of "can't cope."**

## What it does

- **Snapshot data model.** An attack is an ordered array of snapshots — each holds the full state (per-area severities, symptoms, reliefs, medication, note) at a point in time. Severity isn't a single field; it's a map of 17 head zones to 1–10 scores, so "forehead 8, left temple 6" is a first-class reading.
- **Anatomical pain picker.** A front/back head diagram built from hand-drawn SVG artwork, where each zone fills with its own severity colour. The same geometry powers the Insights heatmap, so the picker and the analysis view are literally the same drawing.
- **Adaptive follow-up reminders.** After logging, the app asks "how's your migraine?" at +1h, then +2h. The two most common answers — *no change* and *snooze* — are resolved from the notification itself and never open the app.
- **Voice logging via a real Siri App Intent.** "Hey Siri, log a migraine." Siri asks four short questions; a hand-written parser turns the transcript into a prefilled draft that the user reviews before saving.
- **Insights.** Severity-over-time charts, pain-area frequency heatmap, plateau and medication-non-response analytics derived from the snapshot chain.
- **Offline-first with optional sync.** `localStorage` is the source of truth for every read. Sign-in (magic link or 6-digit code) adds best-effort Supabase push/pull on top. No account required, ever.

## Design decisions worth defending

**"Finish now" is visible before it's usable.** The logging wizard has 8 steps, but only one is required. A "Finish now" link sits in the app bar from step one — *disabled, with a tooltip explaining why*, rather than hidden until the precondition is met. A control that materialises only once it's valid gives no hint it exists, so nobody goes looking for it. Same call on the voice review screen.

**Never present a default as though it were stated.** Two versions of the same rule. If voice parsing couldn't hear a severity, the review screen labels that area *"no severity heard"* and disables one-tap save, forcing a look at the pain step. And the "Woke up with it" toggle answers *whether*, not *when* — so the review screen says exactly that instead of quietly claiming the attack started "just now."

**An update is a new reading, not an edit of the last one.** Every field in the quick-update flow starts blank. Each step instead shows a quiet, non-interactive reference to the previous entry ("At last entry (20:36), pain was severity 8 — Forehead 8, Temple left 6"). Pre-filling would have made "nothing changed" the path of least resistance and silently corrupted the trend line.

**A reminder must accept every honest answer.** The reminder asks how the migraine is. One true reply is *it's over* — but early on the only routes out were to log a no-change reading (asserting the opposite) or close the sheet and go find the attack elsewhere. "It's over — end attack" now sits at the top of that sheet: the least frequent answer, and the only one with no other way out.

**It's a menu or it isn't.** The Profile tab's first draft had one row sitting above three loose sections. It read as an accident rather than a choice, so all four became rows. The bottom nav is capped at four tabs plus the action button — anything new goes *inside* a tab, never beside them.

**Dark-first, no pure black, no shadows.** Read mid-attack with photophobia. The app also ships its own text-size and screen-brightness controls, because the OS ones are several taps away when you can barely look at the screen.

## Engineering the hard parts

**A WebKit viewport bug that screenshots couldn't find.** After a cold PWA launch, iOS reported a stable, self-consistently wrong viewport height and hard-clipped every `position: fixed` element to its own short native viewport — a visible gap under the bottom nav that no `top`/`bottom`/`transform` value could escape. The fix was structural: the app root is a fixed-height, non-scrolling `position: relative` shell with its own nested scroll region, and every floating layer is `absolute` against it. Height comes from a hook that distrusts the browser's own figure below a threshold *and* cross-checks whether the keyboard is open, because focus — not magnitude — is what tells the two cases apart. Safari Web Inspector against the physical device is what finally cracked it, after several confident, wrong fixes derived from screenshots.

**Notifications that survive a force-quit — which meant writing Swift.** A service worker's `setTimeout` dies with the browser, so the app got a Capacitor shell where the OS owns the timer. Then the action buttons silently failed on device, twice, when routed through the JS bridge: iOS launches the app in the *background* to deliver a non-foreground action, so there may be no WebView to receive it. Every answer now goes through a Swift-written queue in `UserDefaults` that the web layer drains on mount and on every foreground. The queued entry carries the *tap* time rather than "now", because the app might not be opened for hours and a reading stamped on read would be a lie about when the severity held. The native handler also schedules the next reminder itself, or the chain stalls.

**A voice parser with no NLP.** ~700 lines of deliberately low-precision substring matching against the user's *own* chip lists, plus `soundex` for mis-transcribed anatomy (double-guarded, because "neck" and "nose" share a code). Every rule exists because a real transcript broke without it: severity is per-area with a forward-biased side-word search, the severity window stops where the medication clause starts (numbers after "took" are quantities), a bare spoken hour is refused rather than guessed. The raw transcript is always kept verbatim and the review screen lists exactly what was recognised — so a wrong guess is visible, not silently saved.

**Two shipping targets, one codebase.** The same build runs as an installed PWA and as a native iOS app. Nothing is forked per platform; where behaviour must differ it branches at runtime. Sign-in uses a 6-digit code as well as a magic link, because iOS Safari always opens mail links in Safari — there is no way to land a magic link back inside an installed PWA.

## What I'd tell you about the process

The repo's `CLAUDE.md` and `docs/` are a decision log, not documentation: ~500 lines of *why*, each entry paid for with a round of device testing. Several of the rules in it look redundant until you read the failure that produced them — which is exactly why they're written down. Building solo across web and native, the expensive mistakes weren't the ones I couldn't solve; they were the ones I solved twice because I'd forgotten the constraint.

**Parked deliberately:** preventive-medication adherence and daily reminders (the notification ID space and the native action queue are both typed around attacks — a real migration, not a feature toggle), and editing an existing attack (making snapshots mutable is a data-model decision, not a UI one, so the primary slot holds a working button instead of a dead one).
