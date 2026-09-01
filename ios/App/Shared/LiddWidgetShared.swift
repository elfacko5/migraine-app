import Foundation

// The contract between the app and the widget extension, compiled into both
// targets so there is exactly one definition of it.
//
// A widget runs in its own process. It cannot see `localStorage`, and it
// cannot see `UserDefaults.standard` either — which is why this does not go
// through `@capacitor/preferences` like the notification queue and the Siri
// handoff do. It travels through an App Group suite instead.
//
// **Nothing here derives anything.** Every figure the widget draws was
// computed in `src/utils/widgetSnapshot.ts` by the same functions Today uses.
// The one exception is summing `windowDoses`, and that is deliberate: the
// total decays on its own as doses age out of the rolling 24 hours, so a
// frozen number would over-report exactly when it matters. Resolving units
// from free text, and excluding retired entries, both stay on the web side.
enum LiddWidgetShared {
    /// Must match the App Group on both targets' entitlements.
    static let appGroup = "group.com.sunny.migrainetracker2"

    /// Must match `WIDGET_SNAPSHOT_KEY`'s use in `LiddWidgetPlugin`.
    static let snapshotKey = "widgetSnapshot"

    /// The shape version the web layer writes. A payload from the future is
    /// refused rather than half-read: the app and the extension update
    /// together, but a timeline built before an update can outlive both.
    ///
    /// 2 — `readings` (a count) became `series` (the readings themselves), for
    /// the ongoing state's trajectory line.
    static let supportedVersion = 2

    static let defaults = UserDefaults(suiteName: appGroup)

    static func loadSnapshot() -> LiddSnapshot? {
        guard let raw = defaults?.string(forKey: snapshotKey),
              let data = raw.data(using: .utf8) else { return nil }
        guard let snapshot = try? JSONDecoder().decode(LiddSnapshot.self, from: data) else { return nil }
        return snapshot.v == supportedVersion ? snapshot : nil
    }
}

struct LiddSnapshot: Codable {
    struct Ongoing: Codable {
        struct Reading: Codable {
            let at: String
            let severity: Int
        }

        let id: Double
        let startedAt: String
        let severityNow: Int
        let severityPeak: Int
        /// Every reading, oldest first — each one's own maximum severity,
        /// computed on the web side by `maxSeverity`. The extension positions
        /// them and draws a line; it does not decide what any of them means.
        let series: [Reading]
    }

    struct Dose: Codable {
        struct Event: Codable {
            let at: String
            let units: Double
        }
        let name: String
        let takenAt: String
        let windowDoses: [Event]
        let maxPerDay: Double?
        let nextAllowedAt: String?
    }

    let v: Int
    let updatedAt: String
    let ongoing: Ongoing?
    let lastEndedAt: String?
    let hasAnyAttack: Bool
    let dose: Dose?
}

// ISO strings arrive from `Date.prototype.toISOString`, which always carries
// milliseconds — but parsing is written to accept either, so a payload written
// by anything else can't silently become a nil date and blank the widget.
enum LiddDate {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let plain = ISO8601DateFormatter()

    static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        return withFraction.date(from: value) ?? plain.date(from: value)
    }
}

/// The app's own elapsed-time wording, mirrored from `src/utils/format.ts`.
///
/// The widget originally used `Text(_:style:.relative)`, which the OS ticks for
/// free — but under an hour that renders seconds ("12 min, 34 secs"), so the
/// home screen carried a counter animating once a second. Movement is itself a
/// migraine trigger and the palette works hard to keep this app still; a
/// stopwatch on the home screen is the loudest thing it could have put there.
/// It also said "5 secs" where every other surface in the app says "just now".
///
/// So the string is computed per timeline entry instead, and the provider
/// schedules an entry at each moment the wording actually changes. Entries in
/// one timeline are pre-rendered by WidgetKit and do not each cost a refresh,
/// so minute-granularity is affordable — and once the figure is in days, the
/// next change is a day away and costs almost nothing.
enum LiddElapsed {
    /// `formatElapsed` — "just now" / "45m" / "5h" / "5h 2m". The ongoing
    /// attack's headline, matching the Today hero.
    static func short(since start: Date, at now: Date) -> String {
        let totalMin = max(0, Int(now.timeIntervalSince(start) / 60))
        let h = totalMin / 60
        let m = totalMin % 60
        if h == 0 && m == 0 { return "just now" }
        if h == 0 { return "\(m)m" }
        if m == 0 { return "\(h)h" }
        return "\(h)h \(m)m"
    }

    /// `formatSinceLong` — "8 days" / "3 hours" / "20 minutes". The
    /// attack-free headline, matching `AttackFreeCard`.
    static func long(since start: Date, at now: Date) -> String {
        let seconds = now.timeIntervalSince(start)
        if seconds < 60 { return "just now" }
        let totalMin = Int(seconds / 60)
        let days = totalMin / 1440
        let hours = (totalMin % 1440) / 60
        let mins = totalMin % 60
        func unit(_ n: Int, _ word: String) -> String { "\(n) \(word)\(n == 1 ? "" : "s")" }
        if days > 0 { return unit(days, "day") }
        if hours > 0 { return unit(hours, "hour") }
        return unit(mins, "minute")
    }

    /// When `short(since:at:)` next reads differently — the next whole minute
    /// since the start, so entries land on the boundary rather than drifting.
    static func nextShortChange(since start: Date, after now: Date) -> Date {
        let totalMin = floor(now.timeIntervalSince(start) / 60)
        return start.addingTimeInterval((totalMin + 1) * 60)
    }

    /// When `long(since:at:)` next reads differently. Coarser as it grows: in
    /// days it changes daily, which is why an eight-day-old figure needs
    /// almost no entries at all.
    static func nextLongChange(since start: Date, after now: Date) -> Date {
        let seconds = now.timeIntervalSince(start)
        if seconds < 60 { return start.addingTimeInterval(60) }
        let totalMin = Int(seconds / 60)
        if totalMin >= 1440 {
            return start.addingTimeInterval(Double(totalMin / 1440 + 1) * 86_400)
        }
        if totalMin >= 60 {
            return start.addingTimeInterval(Double(totalMin / 60 + 1) * 3_600)
        }
        return start.addingTimeInterval(Double(totalMin + 1) * 60)
    }
}


// MARK: - Answers given from the widget

/// A reminder answered from the home screen, waiting for the web layer.
///
/// The shape is `PendingAction` in `src/utils/pendingActions.ts`, deliberately
/// — the drain in `App.tsx` is the only place a reminder answer is ever
/// applied, on either platform, and a widget answer is not a different kind of
/// answer. It joins that queue rather than starting a second path.
///
/// **`rescheduled` is always false here, and that is not an oversight.**
/// `NotificationActionHandler` has to reschedule, because answering a
/// *delivered* notification consumes it and the chain would otherwise stall
/// with the app closed. Nothing has fired when the widget button is tapped:
/// the reminder is still pending and still arrives on time. So the drain
/// re-times it exactly as it would for a reading logged by hand, and the
/// widget needs no notification machinery of its own.
struct LiddPendingAction: Codable {
    let attackId: Double
    /// ISO, when the button was tapped — never when the queue was drained. The
    /// app may not be opened for hours, and a reading stamped on arrival would
    /// be a lie about when severity held.
    let time: String
    let action: String
    let rescheduled: Bool
}

extension LiddWidgetShared {
    /// Read by `LiddWidgetPlugin.drainActions`, written by the widget's intent.
    ///
    /// This is a *second* queue, in the App Group, and it has to be: the
    /// notification queue lives in `UserDefaults.standard` under
    /// `CapacitorStorage.pendingNotificationActions`, which a widget in its
    /// own process cannot see. The plugin drains this one and hands it to the
    /// same `consumePendingActions` path, so there is still exactly one place
    /// an answer is applied.
    static let pendingActionsKey = "pendingWidgetActions"

    static let timestamp: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        // Match JavaScript's Date#toISOString, which every other timestamp in
        // the diary comes from.
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f
    }()

    static func pendingActions() -> [LiddPendingAction] {
        guard let raw = defaults?.string(forKey: pendingActionsKey),
              let data = raw.data(using: .utf8),
              let queue = try? JSONDecoder().decode([LiddPendingAction].self, from: data) else { return [] }
        return queue
    }

    /// Appends an answer. Read-modify-write on a shared suite is not atomic
    /// across processes, but the two writers cannot realistically overlap: the
    /// app drains while it is foregrounded, and the button is tapped from a
    /// home screen, which means it is not. Worth knowing rather than guarding
    /// with a file coordinator for a queue that holds one entry at a time.
    static func appendPendingAction(_ entry: LiddPendingAction) {
        guard let defaults else { return }
        var queue = pendingActions()
        queue.append(entry)
        guard let data = try? JSONEncoder().encode(queue),
              let json = String(data: data, encoding: .utf8) else { return }
        defaults.set(json, forKey: pendingActionsKey)
    }

    static func clearPendingActions() {
        defaults?.removeObject(forKey: pendingActionsKey)
    }

    /// Whether an answer is queued for this payload's ongoing attack that the
    /// app has not yet taken up — which is what lets the button confirm
    /// itself. Without it a tap redraws to exactly the same thing it drew
    /// before, which is indistinguishable from the button not working.
    ///
    /// It clears itself: the app drains the queue and republishes a snapshot
    /// with a later `updatedAt`, so the comparison stops holding without
    /// anything having to remember to reset it.
    static func hasUnappliedAnswer(for snapshot: LiddSnapshot?) -> Bool {
        guard let ongoing = snapshot?.ongoing,
              let publishedAt = LiddDate.parse(snapshot?.updatedAt) else { return false }
        return pendingActions().contains { entry in
            entry.attackId == ongoing.id
                && (LiddDate.parse(entry.time).map { $0 > publishedAt } ?? false)
        }
    }
}
