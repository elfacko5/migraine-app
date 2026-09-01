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
    static let supportedVersion = 1

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
        let id: Double
        let startedAt: String
        let severityNow: Int
        let severityPeak: Int
        let readings: Int
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

