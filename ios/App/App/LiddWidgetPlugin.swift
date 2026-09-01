import Foundation
import Capacitor
import WidgetKit

/// Hands the widget its copy of the diary.
///
/// One method, because the write and the redraw have to be one call: a payload
/// stored without a reload leaves the widget showing the previous state until
/// WidgetKit next feels like asking, which is indistinguishable from the write
/// having failed.
///
/// This exists instead of reusing `@capacitor/preferences` because Preferences
/// writes to `UserDefaults.standard`, which the extension cannot read, and its
/// `configure({ group: })` switches the store *globally* — moving
/// `pendingNotificationActions` and `pendingVoiceEntry` out from under the
/// `CapacitorStorage.` paths that `NotificationActionHandler.swift` and
/// `LogMigraineIntent.swift` write to by hand, breaking both silently.
@objc(LiddWidgetPlugin)
public class LiddWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiddWidgetPlugin"
    public let jsName = "LiddWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drainActions", returnType: CAPPluginReturnPromise)
    ]

    @objc func publish(_ call: CAPPluginCall) {
        guard let value = call.getString("value") else {
            call.reject("Must provide a value")
            return
        }
        guard let defaults = LiddWidgetShared.defaults else {
            // The App Group is missing from the entitlements — a build
            // configuration problem, not a runtime one, so it is worth
            // rejecting loudly rather than quietly writing nowhere. The web
            // side logs and carries on either way; a save must never fail
            // because the widget could not be told about it.
            call.reject("App Group \(LiddWidgetShared.appGroup) is not available to this build")
            return
        }
        defaults.set(value, forKey: LiddWidgetShared.snapshotKey)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    /// Hands over every reminder answered from the widget, and clears them.
    ///
    /// The widget's "No change" button writes into the App Group, which is the
    /// only place the extension can write and the app can read. This drains
    /// that queue so `consumePendingActions` can merge it with the
    /// notification queue and apply both through one path — a widget answer is
    /// not a different kind of answer.
    ///
    /// **Clearing here, before the web layer has written the snapshot,** is the
    /// same trade `consumePendingActions` already makes: clearing afterwards
    /// risks replaying the queue on every foreground and silently multiplying
    /// readings in a health record, which is much worse than losing one if the
    /// write then fails.
    @objc func drainActions(_ call: CAPPluginCall) {
        let queue = LiddWidgetShared.pendingActions()
        LiddWidgetShared.clearPendingActions()
        let entries: [[String: Any]] = queue.map {
            [
                "attackId": $0.attackId,
                "time": $0.time,
                "action": $0.action,
                "rescheduled": $0.rescheduled
            ]
        }
        call.resolve(["entries": entries])
    }
}
