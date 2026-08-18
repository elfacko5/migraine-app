# Notifications — the incidents behind the rules

`CLAUDE.md` states the rules. These are the device failures that produced them; each one shipped broken first.

## The silent-reminder bug (`sound`)

- **`sound` must name a real bundled file or the reminder is delivered silently.** The plugin only assigns `content.sound` when the property is present, and a nil sound on iOS means no tone, *no vibration, and no tap on a paired Apple Watch* — the notification lands in Notification Center and nothing tells the user. It shipped that way and the reminders were unnoticeable on device. The plugin cannot express `UNNotificationSound.default` (it takes a filename only), and **its documented fallback is wrong**: the docs say an unresolvable name plays the system default, but on device a name with no matching file is silent — the same bug wearing a disguise, which cost a second round of device testing to catch. So the app bundles its own `ios/App/App/reminder.wav` (generated, not an Apple system sound, so nothing is being redistributed; Linear PCM, 0.54s, deliberately gentle given what this app is for). It must sit at the **bundle root** — `UNNotificationSound(named:)` doesn't search subfolders — which is what the target's Copy Bundle Resources phase does. `NotificationActionHandler`'s re-schedules inherit it by copying the delivered content, so snooze and follow-ups sound identical; don't substitute `.default` there. If reminders ever go quiet again, check this first.

## Why only one action is `foreground`

- **Only "Something changed" sets `foreground: true`.** It maps to `UNNotificationAction`'s `.foreground`, and it needs it because it opens the wizard. The other two are `false` and are handled in Swift. All three were `true` for a while, which was not a preference: they were handled in JavaScript inside the WebView, so with the app evicted from memory a background action had nothing alive to run it — on device, tapping "Something changed" on a reminder that arrived 30 minutes later dismissed the notification and did nothing. Opening the app was the lesser evil until the native handler existed.

## Why every answer goes through the queue

**Every answer is written to a queue in Swift and applied later by the web layer — including "Something changed".** That one always brings the app to the foreground and could in principle be delivered live, and it was, through Capacitor's `localNotificationActionPerformed` listener. It failed on device twice: the notification cleared and the app did nothing. The path from the OS to a React effect is router → plugin → retained event → async `addListener`, and it assumes the WebView is further along than it is when a reminder launches the app. Nothing in that chain reports a failure — the event is simply dropped. The queue does not care how far along the WebView is: worst case the wizard opens a moment later. **Don't reintroduce a live-event dependency for any action.**

## What was measured, and what couldn't be

Diagnosing that took measuring rather than reasoning, and the measurements ruled out most of the obvious suspects — with `NSLog` probes in the handler it was confirmed on the simulator that our delegate *is* installed at launch, that `willPresent` really is dispatched to it, and that `capacitorRouter()` and its `localNotificationHandler` are both non-nil by `applicationDidBecomeActive`. The break is somewhere past that, in a chain that can't be exercised without a device, which is the reason for not depending on it at all rather than fixing it.

## Why the app owns the `UNUserNotificationCenter` delegate

- **It owns the `UNUserNotificationCenter` delegate, and has to.** Apple's contract is that the delegate is set before launch finishes or a response that launched the app is never delivered; Capacitor's `NotificationRouter` installs itself from `CapacitorBridge.init`, which runs in `CAPBridgeViewController.loadView()` — later than that. So `ios.handleApplicationNotifications: false` in `capacitor.config.ts` keeps Capacitor's hands off, `AppDelegate` installs the handler during launch, and the handler forwards `willPresent` and every response back to Capacitor's router by hand. **Removing that config flag silently disables all of this**, since Capacitor would take the delegate back — and so does a stale bundle: the generated `ios/App/App/capacitor.config.json` is gitignored, so a fresh clone needs a `cap copy` before any of it takes effect.
