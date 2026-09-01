import AppIntents
import Foundation
import WidgetKit

/// "No change", answered from the home screen.
///
/// This is the lock-screen reminder button, moved somewhere it can be reached
/// without a reminder having fired — the answer that costs the least to give
/// and is worth the most to have, since a stretch of held severity is what
/// `longestPlateauMinutes` and `hasMedicationNonResponse` are built out of and
/// it is exactly the reading nobody opens an app to log.
///
/// ## It cannot write the reading, and does not try
///
/// The same wall the Siri intent and the notification handler hit: attacks
/// live in `localStorage` inside the WebView, which no other process can
/// reach. So the answer is queued and the web layer applies it, through
/// `consumePendingActions` — the single place a reminder answer is ever
/// applied on either platform. A widget answer is not a different kind of
/// answer and does not get a different path.
///
/// ## Why a second queue
///
/// `pendingNotificationActions` lives in `UserDefaults.standard`, which an
/// extension in its own process cannot see, and `@capacitor/preferences`'
/// `configure({ group })` switches its store *globally* — which would move
/// that key and `pendingVoiceEntry` out from under the hardcoded
/// `CapacitorStorage.` paths in `NotificationActionHandler.swift` and
/// `LogMigraineIntent.swift` and break both silently. So this writes an App
/// Group queue that `LiddWidgetPlugin` drains and merges into the other one.
///
/// ## Nothing is rescheduled here
///
/// The notification handler has to reschedule, because answering a delivered
/// reminder consumes it. Nothing has fired when this button is tapped: the
/// reminder is still pending and still arrives on time. The drain re-times it
/// exactly as a reading logged by hand would, so this needs no notification
/// machinery, no `notifId()` folding, and no access to `notificationConfig`.
///
/// App Intents need iOS 16 and interactive widgets need 17, so the button is
/// gated at 17 and simply absent below it — the widget still reads correctly,
/// it just isn't tappable.
@available(iOS 17.0, *)
struct LiddNoChangeIntent: AppIntent {
    static var title: LocalizedStringResource = "No change"
    static var description = IntentDescription(
        "Record that the migraine is holding where it was, without opening Lidd."
    )

    /// The whole point. Opening the app to say nothing has changed is the work
    /// this removes.
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Attack")
    var attackId: Double

    init() {}

    init(attackId: Double) {
        self.attackId = attackId
    }

    func perform() async throws -> some IntentResult {
        // The tap time *is* the reading. The app may not be opened for hours,
        // and a reading stamped when the queue was finally drained would be a
        // lie about when severity held — the same rule the notification queue
        // follows.
        LiddWidgetShared.appendPendingAction(
            LiddPendingAction(
                attackId: attackId,
                time: LiddWidgetShared.timestamp.string(from: Date()),
                action: "no_change",
                rescheduled: false
            )
        )
        // So the button can confirm itself. WidgetKit redraws after an intent
        // on its own, but only for the widget that was tapped; this covers the
        // case of the same attack shown on more than one.
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
