import WidgetKit
import SwiftUI
import UIKit

// The home-screen widget.
//
// It carries what Today carries and for the same reason: only what bears on
// the next hour. Where an attack is now, and where the last dose left things.
// The monthly figures deliberately stay on Insights — a migraine-day count
// pinned to a home screen and seen thirty times a day is a score for a health
// outcome, which §9.2 of the dossier is explicit about not building.
//
// **Nothing here computes a figure.** Every number was worked out in
// `src/utils/widgetSnapshot.ts` by the same functions Today calls, so the two
// cannot drift into disagreeing — and a widget disagreeing with the app is
// invisible from inside the app, which is what makes it worth this much care.

// MARK: - Palette
//
// The tokens from `src/index.css`, by hand — a SwiftUI view can no more read a
// CSS variable than an SVG presentation attribute can, which is the same
// arrangement `headDiagram.ts` and the Recharts call sites already live with.
// Change a token there and these change with it.
//
// The widget gets none of the app's protections: no BrightnessOverlay, no
// attack-mode theme, no text-size control. So it stays at the quiet end on its
// own — warm charcoal ground, never a large accent fill, and no #fff.
private extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: 1
        )
    }

    static let liddBase = Color(hex: 0x1b1a18)
    static let liddSurface = Color(hex: 0x262421)
    static let liddPrimary = Color(hex: 0xcdc7bb)
    static let liddSecondary = Color(hex: 0xa39d92)
    static let liddAccent = Color(hex: 0x7fa187)

    /// The app's shared severity ramp — the same three bands and the same
    /// values as `sevTextClass` in `src/utils/severity.ts` and `sevFill` in
    /// `headDiagram.ts`. Mirrored by hand like the rest of the palette; all
    /// four have to change together.
    static func liddSeverity(_ n: Int) -> Color {
        if n <= 3 { return Color(hex: 0x8fb096) }
        if n <= 7 { return Color(hex: 0xc39257) }
        return Color(hex: 0xc68880)
    }
}

// MARK: - Timeline

struct LiddEntry: TimelineEntry {
    let date: Date
    let snapshot: LiddSnapshot?
}

struct LiddProvider: TimelineProvider {
    func placeholder(in context: Context) -> LiddEntry {
        LiddEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (LiddEntry) -> Void) {
        completion(LiddEntry(date: Date(), snapshot: LiddWidgetShared.loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LiddEntry>) -> Void) {
        let now = Date()
        let snapshot = LiddWidgetShared.loadSnapshot()

        // One entry now, plus one at each moment a figure on screen stops
        // being true by itself: a dose ageing out of the rolling 24 hours, and
        // a minimum gap elapsing. The app republishes on every write and on
        // backgrounding, so these are only for the stretches where nothing
        // happens and the display would otherwise go quietly wrong.
        //
        // Elapsed times are not in here — those tick natively via
        // `Text(_:style:.relative)` and cost no timeline entries at all.
        var dates: [Date] = [now]

        // One entry at each moment the elapsed wording changes. These are
        // pre-rendered by WidgetKit rather than costing a refresh each, which
        // is what makes minute-granularity affordable — and a figure already
        // in days changes daily, so a long attack-free stretch needs a handful
        // of entries to stay correct for weeks.
        if let started = LiddDate.parse(snapshot?.ongoing?.startedAt) {
            var next = LiddElapsed.nextShortChange(since: started, after: now)
            for _ in 0..<90 {
                dates.append(next)
                next = LiddElapsed.nextShortChange(since: started, after: next)
            }
        } else if let ended = LiddDate.parse(snapshot?.lastEndedAt) {
            var next = LiddElapsed.nextLongChange(since: ended, after: now)
            for _ in 0..<30 {
                dates.append(next)
                next = LiddElapsed.nextLongChange(since: ended, after: next)
            }
        }

        // The minimum-gap line is the only dose figure that expires on its
        // own, so it is the only one that needs an entry.
        //
        // The rolling 24-hour count used to need one at each dose's expiry —
        // that count is no longer shown (the design trimmed this column to
        // the time, the name and the next dose), so those entries would be
        // refreshes for a figure nobody reads. `windowDoses` stays in the
        // payload: it is what the count would be rebuilt from, and it is the
        // half that cannot be recomputed on the widget's side.
        if let dose = snapshot?.dose, let next = LiddDate.parse(dose.nextAllowedAt), next > now {
            dates.append(next)
        }

        let entries = Array(Set(dates)).sorted().prefix(120).map {
            LiddEntry(date: $0, snapshot: snapshot)
        }
        // Come back for a fresh timeline once the entries run out, so a widget
        // whose app has not been opened for days keeps going rather than
        // sitting on its last entry indefinitely.
        let policy: TimelineReloadPolicy = entries.last.map { .after($0.date) } ?? .after(now.addingTimeInterval(60 * 60))
        completion(Timeline(entries: Array(entries), policy: policy))
    }
}

// MARK: - Views

private func timeOfDay(_ date: Date) -> String {
    let f = DateFormatter()
    f.timeStyle = .short
    f.dateStyle = .none
    return f.string(from: date)
}

/// The label above the headline — the shape both Today hero cards use.
private struct LiddLabel: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.caption)
            .foregroundColor(.liddSecondary)
    }
}

private struct StateBlock: View {
    let snapshot: LiddSnapshot?
    /// The moment this timeline entry represents — never `Date()`. A view that
    /// read the clock itself would be right when first rendered and wrong for
    /// every pre-rendered entry after it.
    let entryDate: Date
    /// True on the medium family when there is no dose column beside this —
    /// off an attack, or during one where nothing has been taken. The block
    /// then owns the full width, so the headline grows to match: at the
    /// small-family size it left two thirds of the widget empty and read as a
    /// layout that had failed rather than one with nothing more to say.
    var prominent: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let ongoing = snapshot?.ongoing, let started = LiddDate.parse(ongoing.startedAt) {
                LiddLabel(text: "Ongoing attack")
                // The app's own wording, computed for this entry's moment —
                // see `LiddElapsed`. `Text(_:style:.relative)` ticked itself
                // for free but rendered seconds under the hour, putting a
                // stopwatch on the home screen of an app built to sit still.
                Text(LiddElapsed.short(since: started, at: entryDate))
                    .font(.system(size: prominent ? 34 : 26, weight: .semibold))
                    .foregroundColor(.liddPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                // **No "since it started" line.** The label above already
                // says an attack is ongoing, and a duration under it cannot
                // mean anything else — the sentence restated its own heading.
                Spacer(minLength: 6)
                // **Severity is a figure, not a sentence.** It read as
                // "Severity now 7 · peak 9" — the Today hero's line lifted
                // onto a surface with none of the hero's width, where it
                // became a run of caption text with no hierarchy in it. The
                // numeral carries it now, coloured by the app's own severity
                // ramp so magnitude registers before the digit is read, the
                // peak beside it as the quieter figure and the label beneath:
                // the stat-tile shape Insights already uses.
                //
                // **It matches the duration's size rather than beating it.**
                // At 40pt against a 26pt headline the digit was the loudest
                // thing on the widget and the balance tipped the other way —
                // the first version had no hierarchy, that one had too much.
                // The two figures are peers; the ramp colour and the weight
                // are what separate severity from the duration, not size.
                //
                // Both are fixed sizes rather than text styles because they
                // are figures in a layout with no room to grow; every label
                // around them still scales with the reader's text setting.
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(ongoing.severityNow)")
                            .font(.system(size: prominent ? 32 : 26, weight: .semibold))
                            .foregroundColor(.liddSeverity(ongoing.severityNow))
                            .lineLimit(1)
                        if let peak = peakLine(ongoing) {
                            Text(peak)
                                .font(.footnote)
                                .foregroundColor(.liddSecondary)
                                .lineLimit(1)
                        }
                    }
                    Text("Severity now")
                        .font(.caption)
                        .foregroundColor(.liddSecondary)
                        .lineLimit(1)
                }
            } else if let ended = LiddDate.parse(snapshot?.lastEndedAt) {
                LiddLabel(text: "Since your last attack")
                Text(LiddElapsed.long(since: ended, at: entryDate))
                    .font(.system(size: prominent ? 44 : 34, weight: .semibold))
                    .foregroundColor(.liddPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            } else if snapshot?.hasAnyAttack == true {
                // An attack is logged but none has ended — a diary that only
                // holds a retrospective log with no end time. There is no
                // duration to state, and inventing one would be worse.
                LiddLabel(text: "Lidd")
                Text("Nothing ongoing")
                    .font(.headline)
                    .foregroundColor(.liddPrimary)
            } else {
                LiddLabel(text: "Lidd")
                Text(snapshot == nil ? "Open Lidd to set this up" : "Nothing logged yet")
                    .font(.subheadline)
                    .foregroundColor(.liddPrimary)
                    .lineLimit(2)
            }
        }
    }

    /// The quieter second figure under the severity, or nothing at all. One
    /// reading has nothing to have peaked against yet, so it gets no line
    /// rather than a peak equal to itself said twice.
    private func peakLine(_ ongoing: LiddSnapshot.Ongoing) -> String? {
        if ongoing.severityNow != ongoing.severityPeak { return "peak \(ongoing.severityPeak)" }
        return ongoing.readings > 1 ? "at its peak" : nil
    }
}

private struct DoseBlock: View {
    let dose: LiddSnapshot.Dose
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let taken = LiddDate.parse(dose.takenAt) {
                Text("Taken \(timeOfDay(taken))")
                    .font(.footnote)
                    .foregroundColor(.liddSecondary)
                    .lineLimit(1)
            }
            Text(dose.name)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(.liddPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let next = LiddDate.parse(dose.nextAllowedAt), next > now {
                // The user's own number, stated. Never an instruction — the
                // rule every medication line in the app follows.
                Text("Next dose from \(timeOfDay(next))")
                    .font(.footnote)
                    .foregroundColor(.liddSecondary)
                    .lineLimit(2)
                    .padding(.top, 10)
            }
        }
    }
}

/// The app's mark, in the corner.
///
/// Rendered as a template — the artwork is a silhouette with a feathered alpha
/// cut from `assets/icon.png`, so it takes a flat fill and cannot drag the
/// icon's gradient onto a surface the palette keeps quiet. It is the accent
/// sage because that is the brand's own colour and this is the brand's own
/// mark; the "accent means action" rule governs controls, and this is not one.
private struct LiddMark: View {
    var body: some View {
        if let image = UIImage(named: "LiddMark") {
            Image(uiImage: image)
                .renderingMode(.template)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 17, height: 17)
                .foregroundColor(.liddAccent)
                .opacity(0.85)
                .accessibilityHidden(true)
        }
    }
}

struct LiddWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LiddEntry

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .overlay(alignment: .topTrailing) { LiddMark() }
            .liddContainerBackground()
    }

    @ViewBuilder
    private var content: some View {
        if family == .systemMedium, let dose = entry.snapshot?.dose {
            HStack(alignment: .top, spacing: 14) {
                StateBlock(snapshot: entry.snapshot, entryDate: entry.date)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Rectangle()
                    .fill(Color.liddSurface)
                    .frame(width: 1)
                DoseBlock(dose: dose, now: entry.date)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            StateBlock(
                snapshot: entry.snapshot,
                entryDate: entry.date,
                prominent: family == .systemMedium
            )
        }
    }
}

private extension View {
    /// iOS 17 stopped letting a widget paint its own background directly and
    /// wants `containerBackground`, which is also what the Lock Screen and
    /// StandBy tint against. Below 17 the padding has to be drawn by hand,
    /// since the system supplied it only from 17 onward.
    @ViewBuilder
    func liddContainerBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(Color.liddBase, for: .widget)
        } else {
            self.padding(16).background(Color.liddBase)
        }
    }
}

// MARK: - Widget

struct LiddStatusWidget: Widget {
    let kind = "LiddStatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LiddProvider()) { entry in
            LiddWidgetView(entry: entry)
        }
        .configurationDisplayName("Lidd")
        .description("Where an attack is now, and when you last took something.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct LiddWidgetBundle: WidgetBundle {
    var body: some Widget {
        LiddStatusWidget()
    }
}
