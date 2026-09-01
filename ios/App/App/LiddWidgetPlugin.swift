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
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise)
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
}
