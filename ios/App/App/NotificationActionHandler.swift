import Capacitor
import UIKit
import UserNotifications

/// Resolves the reminder's "No change" and "Snooze" buttons in Swift, so they
/// no longer have to open the app.
///
/// Both were `foreground: true` before, which was not a preference — it was the
/// only thing that worked. They are handled in JavaScript inside the WebView,
/// and a reminder is most likely to be answered exactly when the app has been
/// evicted from memory, at which point there is no JavaScript alive to run: the
/// action dismissed the notification and did nothing. Opening the app was the
/// lesser evil. Handling them here removes the choice — iOS launches the app in
/// the *background* to deliver a non-foreground action, and this delegate runs
/// with or without a WebView.
///
/// "Something changed" and a tap on the body still open the app, as they must:
/// they lead to the update wizard. They are queued here all the same rather
/// than left to Capacitor's notification event, because that event reaching a
/// React effect in time is exactly what could not be relied on — the button
/// opened the app and did nothing, twice. Queue first, and the worst case is
/// the wizard opening a moment late instead of never.
///
/// ## Why this object owns the delegate
///
/// Capacitor's `NotificationRouter` normally installs itself as the
/// `UNUserNotificationCenter` delegate, from `CapacitorBridge.init` — which
/// runs in `CAPBridgeViewController.loadView()`, i.e. *after*
/// `didFinishLaunchingWithOptions` has returned. Apple's contract is that the
/// delegate must be set before launch finishes or a response that launched the
/// app is not delivered at all. So `ios.handleApplicationNotifications` is
/// `false` in `capacitor.config.ts`, this object is installed from the app
/// delegate instead, and everything the web layer still needs is forwarded to
/// Capacitor's router by hand. Removing that config flag silently hands the
/// delegate back to Capacitor and disables everything in this file.
final class NotificationActionHandler: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationActionHandler()

    /// Read by `consumePendingActions()` in `src/utils/pendingActions.ts`.
    /// `@capacitor/preferences` maps to `UserDefaults.standard` with this
    /// prefix, which is what lets native and web share a queue with no custom
    /// bridge — the same trick `LogMigraineIntent` uses for voice. **The key is
    /// duplicated in Swift and TS: change one, change the other.**
    private static let pendingActionsKey = "CapacitorStorage.pendingNotificationActions"

    private static let snoozeInterval: TimeInterval = 30 * 60

    /// Responses that arrived with no Capacitor bridge to forward them to,
    /// held until one exists. A background launch has no WebView at all, so
    /// this is the normal case there rather than an error; the durable record
    /// is the `UserDefaults` queue, and this only exists so a foreground
    /// action isn't dropped when it lands before the bridge is ready.
    private var undelivered: [UNNotificationResponse] = []
    private static let maxUndelivered = 20

    /// Must be called before `didFinishLaunchingWithOptions` returns.
    func install() {
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        guard let router = capacitorRouter() else {
            // No bridge yet: fall back to what Capacitor's handler defaults to,
            // rather than presenting nothing.
            completionHandler([.badge, .sound, .banner, .list])
            return
        }
        router.userNotificationCenter(center, willPresent: notification, withCompletionHandler: completionHandler)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        switch response.actionIdentifier {
        case "no_change":
            record(response, action: "no_change")
        case "snooze":
            reschedule(response, after: Self.snoozeInterval)
        case "update", UNNotificationDefaultActionIdentifier:
            // A tap on the body reports the default identifier and means the
            // same thing as the button: open the wizard.
            record(response, action: "update")
        default:
            break
        }

        // The queue above is what actually carries the answer. This is only a
        // cue for a WebView that happens to already be running, so it sees the
        // answer now rather than on next foreground — nothing depends on it
        // arriving, which is the whole point of queueing first.
        forward(response)
        completionHandler()
    }

    // MARK: - Recording the answer

    /// Queues the user's answer for the web layer to apply.
    ///
    /// Nothing can be written to an attack here: they live in `localStorage`
    /// inside the WebView, which native code has no access to. So the answer is
    /// queued with its own timestamp and applied on next launch — for
    /// `no_change` the tap time *is* the reading, and it would otherwise be
    /// lost by however long the app stays closed.
    private func record(_ response: UNNotificationResponse, action: String) {
        let extra = response.notification.request.content.userInfo["cap_extra"] as? [String: Any] ?? [:]
        guard let attackId = (extra["attackId"] as? NSNumber)?.int64Value else { return }

        // Only a no-change answer continues the reminder chain. Scheduling the
        // follow-up here rather than leaving it to the web layer is the
        // difference between a chain that continues and one that stalls until
        // the app is next opened. The interval is computed at schedule time and
        // carried in `extra`, because working it out needs the attack's
        // notificationConfig and snapshot count. "Something changed" opens the
        // wizard, and saving there schedules the next reminder as usual.
        var rescheduled = false
        if action == "no_change" {
            let followUpMs = (extra["followUpMs"] as? NSNumber)?.doubleValue ?? 0
            rescheduled = reschedule(response, after: followUpMs / 1000)
        }

        appendPendingAction([
            "attackId": NSNumber(value: attackId),
            "time": Self.timestamp.string(from: Date()),
            "action": action,
            "rescheduled": rescheduled
        ])
    }

    /// Re-queues the delivered reminder under its own id, which replaces any
    /// pending copy rather than stacking a second one — the same guarantee the
    /// web layer gets from `notifId()` being deterministic.
    ///
    /// Reusing the delivered content is correct for both callers: snoozing
    /// defers an unanswered question, and "no change" means the state it
    /// describes still holds. The body is an absolute clock time
    /// ("Started 14:05 · Right temple · severity 7") precisely so it survives
    /// being read later.
    @discardableResult
    private func reschedule(_ response: UNNotificationResponse, after interval: TimeInterval) -> Bool {
        guard interval > 0 else { return false }
        let request = response.notification.request
        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else { return false }

        // The copy carries the original's sound (`reminder.wav`), so a snooze
        // or follow-up is as audible as the reminder it came from and sounds
        // the same. Don't substitute `.default` here — it would make the
        // follow-up a different noise from the first alert for no reason. A
        // silent reminder produces no vibration and no wrist tap, so one that
        // arrives unnoticed is one that didn't happen.

        UNUserNotificationCenter.current().add(
            UNNotificationRequest(
                identifier: request.identifier,
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            )
        )
        return true
    }

    // MARK: - The shared queue

    private static let timestamp: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        // Match JavaScript's Date#toISOString, which the rest of the app's
        // timestamps come from.
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f
    }()

    private func appendPendingAction(_ entry: [String: Any]) {
        let defaults = UserDefaults.standard
        var queue: [[String: Any]] = []
        if let raw = defaults.string(forKey: Self.pendingActionsKey),
           let data = raw.data(using: .utf8),
           let existing = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] {
            queue = existing
        }
        queue.append(entry)

        guard let data = try? JSONSerialization.data(withJSONObject: queue),
              let json = String(data: data, encoding: .utf8) else { return }
        defaults.set(json, forKey: Self.pendingActionsKey)
        // The app may be running and merely backgrounded, in which case nothing
        // else forces the write out before the web layer reads it back.
        defaults.synchronize()
    }

    // MARK: - Forwarding to Capacitor

    /// Flushes anything that arrived before the bridge existed. Called from
    /// `applicationDidBecomeActive`, which is guaranteed to run shortly after
    /// any action that brings the app forward.
    func flushUndelivered() {
        guard !undelivered.isEmpty, let router = capacitorRouter() else { return }
        let pending = undelivered
        undelivered.removeAll()
        for response in pending {
            router.userNotificationCenter(.current(), didReceive: response) {}
        }
    }

    private func forward(_ response: UNNotificationResponse) {
        guard let router = capacitorRouter() else {
            if undelivered.count >= Self.maxUndelivered { undelivered.removeFirst() }
            undelivered.append(response)
            return
        }
        router.userNotificationCenter(.current(), didReceive: response) {}
    }

    private func capacitorRouter() -> NotificationRouter? {
        guard let root = (UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController else {
            return nil
        }
        return Self.bridgeViewController(in: root)?.bridge?.notificationRouter
    }

    private static func bridgeViewController(in controller: UIViewController) -> CAPBridgeViewController? {
        if let bridgeController = controller as? CAPBridgeViewController { return bridgeController }
        for child in controller.children {
            if let found = bridgeViewController(in: child) { return found }
        }
        if let presented = controller.presentedViewController {
            return bridgeViewController(in: presented)
        }
        return nil
    }
}
