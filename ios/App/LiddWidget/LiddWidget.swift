import WidgetKit
import SwiftUI
import UIKit
#if canImport(AppIntents)
import AppIntents
#endif

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
// The one thing the extension owns is *positioning* the readings it is given
// into a line; what each reading's severity is was decided on the web side.

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
    static let liddRaised = Color(hex: 0x302d29)
    static let liddPrimary = Color(hex: 0xcdc7bb)
    static let liddSecondary = Color(hex: 0xa39d92)
    static let liddAccent = Color(hex: 0x7fa187)
    /// `--color-border-control` — the outline of something you *press*, as
    /// opposed to a hairline between two things you read. WCAG 1.4.11 wants
    /// 3:1 for what identifies a control, and this is the value that measures
    /// it against the tightest surface a control sits on.
    static let liddControlBorder = Color(hex: 0x7d7669)

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

// MARK: - Type
//
// Lexend, the app's own face, bundled into the extension as three static
// instances cut from `src/assets/fonts/Lexend-Variable.woff2` — CoreText
// cannot read woff2, and the extension cannot reach the web bundle's copy in
// any case. Instanced rather than shipped as one variable file because
// selecting a weight axis at runtime needs `kCTFontVariationAttribute` and a
// descriptor dance, where three PostScript names are a lookup that either
// works or visibly doesn't.
//
// **400 / 500 / 600 only, and no lighter.** Thin strokes shimmer for
// light-sensitive eyes, which is the same reason the app ships no weight below
// 400; 600 is a real weight here rather than a synthesised jump to 700, which
// is what the variable file bought the app in the first place.
//
// `relativeTo:` is what keeps the labels scaling with the reader's Dynamic
// Type setting. The widget has no text-size control of its own, so the OS
// setting is the only one it answers to — and the figures deliberately opt out
// of it (see `StateBlock`), being numerals in a layout with no room to grow.
private enum LiddFont {
    static let regular = "Lexend-Regular"
    static let medium = "Lexend-Medium"
    static let semibold = "Lexend-SemiBold"

    /// A fixed size that does not scale. For the headline numerals only.
    static func fixed(_ size: CGFloat, _ name: String = semibold) -> Font {
        .custom(name, fixedSize: size)
    }

    static func caption(_ name: String = regular) -> Font { .custom(name, size: 12, relativeTo: .caption) }
    static func footnote(_ name: String = regular) -> Font { .custom(name, size: 13, relativeTo: .footnote) }
    static func subheadline(_ name: String = regular) -> Font { .custom(name, size: 15, relativeTo: .subheadline) }
    static func headline() -> Font { .custom(semibold, size: 17, relativeTo: .headline) }
}

// MARK: - Timeline

struct LiddEntry: TimelineEntry {
    let date: Date
    let snapshot: LiddSnapshot?
    /// An answer given from the button that the app has not taken up yet, so
    /// the button can confirm itself rather than redrawing identically — which
    /// is indistinguishable from the tap having done nothing.
    let answered: Bool
}

struct LiddProvider: TimelineProvider {
    func placeholder(in context: Context) -> LiddEntry {
        LiddEntry(date: Date(), snapshot: nil, answered: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (LiddEntry) -> Void) {
        let snapshot = LiddWidgetShared.loadSnapshot()
        completion(LiddEntry(
            date: Date(),
            snapshot: snapshot,
            answered: LiddWidgetShared.hasUnappliedAnswer(for: snapshot)
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LiddEntry>) -> Void) {
        let now = Date()
        let snapshot = LiddWidgetShared.loadSnapshot()
        let answered = LiddWidgetShared.hasUnappliedAnswer(for: snapshot)

        // One entry now, plus one at each moment a figure on screen stops
        // being true by itself. The app republishes on every write and on
        // backgrounding, so these are only for the stretches where nothing
        // happens and the display would otherwise go quietly wrong.
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
            LiddEntry(date: $0, snapshot: snapshot, answered: answered)
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
/// The label above the headline — the shape both Today hero cards use, with
/// the app's mark ahead of it.
///
/// **The mark moved out of the top-right corner and into this row** on Sunny's
/// call, 2026-09-01. A corner mark is the platform's habit rather than a
/// decision, and it cost the one thing this widget is short of: it reserved the
/// top-right of every layout, and on the artwork variant it would have sat on
/// the picture's brightest region with no gradient protecting it. Inline it
/// reads as the app's byline on its own first line, and it lives in the same
/// gradient-darkened column as the text it labels.
///
/// It is on **every** state, not just the artwork one — a mark that moves
/// depending on what the widget is showing is the drift this file keeps having
/// to fix.
private struct LiddLabel: View {
    let text: String
    var body: some View {
        HStack(spacing: 6) {
            LiddMark(size: 13)
            Text(text)
                .font(LiddFont.caption())
                .foregroundColor(.liddSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

/// The attack's trajectory: every reading so far, in order.
///
/// This is the half two numbers cannot say — whether it is climbing or easing
/// off — and it is most of what someone glancing at a home screen wants to
/// know. It is the same mark the Logs list draws on each row, and follows the
/// same two rules for the same reasons:
///
/// - **The y-domain is pinned to 0…10.** Fitted to its own range, a run of
///   3→4 would draw the identical shape to one of 2→9, every line filling its
///   box regardless of what it describes.
/// - **The colour is the severity ramp at the attack's peak**, not the accent.
///   Colour carries magnitude everywhere else here; a green line under a
///   terracotta 9 would have the widget contradicting itself.
///
/// Readings are spaced evenly rather than by their timestamps, matching
/// `SeveritySparkline`. Reminders are answered when they are answered, so the
/// gaps between them say more about the diary than the attack — and at this
/// width a true time axis would bunch a cluster into a single pixel.
private struct TrajectoryLine: View {
    let series: [LiddSnapshot.Ongoing.Reading]
    let peak: Int
    let height: CGFloat

    var body: some View {
        GeometryReader { geo in
            let inset: CGFloat = 3
            let w = geo.size.width - inset * 2
            let h = geo.size.height - inset * 2
            let points: [CGPoint] = series.enumerated().map { index, reading in
                let x = series.count == 1 ? w / 2 : w * CGFloat(index) / CGFloat(series.count - 1)
                let clamped = min(max(reading.severity, 0), 10)
                return CGPoint(x: inset + x, y: inset + h * (1 - CGFloat(clamped) / 10))
            }
            ZStack {
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    for point in points.dropFirst() { path.addLine(to: point) }
                }
                .stroke(
                    Color.liddSeverity(peak),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                )
                ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                    Circle()
                        .fill(Color.liddSeverity(peak))
                        .frame(width: 5, height: 5)
                        .position(point)
                }
            }
        }
        .frame(height: height)
        // Every value it encodes is printed in the line beneath it, so a
        // screen reader gets numbers rather than a shape — the rule
        // `SeverityBreakdown`'s sparklines already follow.
        .accessibilityHidden(true)
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
                    .font(LiddFont.fixed(prominent ? 34 : 26))
                    .foregroundColor(.liddPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                // **No "since it started" line.** The label above already
                // says an attack is ongoing, and a duration under it cannot
                // mean anything else — the sentence restated its own heading.
                Spacer(minLength: 6)
                severity(ongoing)
            } else if let ended = LiddDate.parse(snapshot?.lastEndedAt) {
                // `AttackFreeCard`'s own label, to the hyphen. It read "Since
                // your last attack", which was drift rather than a decision —
                // and the widget's phrasing was the worse of the two anyway,
                // naming the thing that happened rather than the stretch since
                // it. The app has one string for this; so does the widget.
                LiddLabel(text: "Attack-free for")
                // **The same size as the ongoing duration, deliberately.**
                // It was 34/44, inherited from `AttackFreeCard` where the
                // figure owns a full-width hero and can carry that scale. On a
                // widget it simply dominated — and worst when the number was
                // least interesting, since "just now" and "1 minute" are long
                // strings where "8 days" is short. The headline is the
                // headline whatever the state is; only the content differs.
                Text(LiddElapsed.long(since: ended, at: entryDate))
                    .font(LiddFont.fixed(prominent ? 34 : 26))
                    .foregroundColor(.liddPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            } else if snapshot?.hasAnyAttack == true {
                // An attack is logged but none has ended — a diary that only
                // holds a retrospective log with no end time. There is no
                // duration to state, and inventing one would be worse.
                LiddLabel(text: "Lidd")
                Text("Nothing ongoing")
                    .font(LiddFont.headline())
                    .foregroundColor(.liddPrimary)
            } else {
                LiddLabel(text: "Lidd")
                Text(snapshot == nil ? "Open Lidd to set this up" : "Nothing logged yet")
                    .font(LiddFont.subheadline())
                    .foregroundColor(.liddPrimary)
                    .lineLimit(2)
            }
        }
    }

    /// The trajectory, then the figures it ends on.
    ///
    /// This is direction C off the design canvas, and it replaced a stat tile
    /// — a large coloured numeral with the peak beside it and "Severity now"
    /// beneath. The tile read cleanly but said only where the attack is, and
    /// where it is going is the more useful half at a glance and the half the
    /// app has to open to answer. The numeral stays, smaller, as the line's
    /// endpoint rather than as the headline.
    ///
    /// **The line is dropped on a single reading**, which has no trajectory
    /// and nothing to have peaked against yet — the same rule
    /// `SeveritySparkline` follows in returning nothing below two points. The
    /// figures still render, so the state never goes blank.
    @ViewBuilder
    private func severity(_ ongoing: LiddSnapshot.Ongoing) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if ongoing.series.count > 1 {
                TrajectoryLine(
                    series: ongoing.series,
                    peak: ongoing.severityPeak,
                    height: prominent ? 46 : 38
                )
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                // Fixed rather than a text style: a figure in a layout with no
                // room to grow. Every label around it still scales.
                Text("\(ongoing.severityNow)")
                    .font(LiddFont.fixed(20))
                    .foregroundColor(.liddSeverity(ongoing.severityNow))
                    .lineLimit(1)
                Text(peakLine(ongoing))
                    .font(LiddFont.caption())
                    .foregroundColor(.liddSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
    }

    /// "now · peak 9", or just "now" when there is nothing to compare against.
    /// One reading has not peaked yet, and an attack sitting at its worst says
    /// so rather than printing the same number twice.
    private func peakLine(_ ongoing: LiddSnapshot.Ongoing) -> String {
        if ongoing.severityNow != ongoing.severityPeak { return "now · peak \(ongoing.severityPeak)" }
        return ongoing.series.count > 1 ? "now · at its peak" : "now"
    }
}

private struct DoseBlock: View {
    let dose: LiddSnapshot.Dose
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let taken = LiddDate.parse(dose.takenAt) {
                Text("Taken \(timeOfDay(taken))")
                    .font(LiddFont.footnote())
                    .foregroundColor(.liddSecondary)
                    .lineLimit(1)
            }
            Text(dose.name)
                .font(.custom(LiddFont.medium, fixedSize: 18))
                .foregroundColor(.liddPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let next = LiddDate.parse(dose.nextAllowedAt), next > now {
                // The user's own number, stated. Never an instruction — the
                // rule every medication line in the app follows.
                Text("Next dose from \(timeOfDay(next))")
                    .font(LiddFont.footnote())
                    .foregroundColor(.liddSecondary)
                    .lineLimit(2)
                    .padding(.top, 8)
            }
        }
    }
}

/// "No change", answerable without opening the app.
///
/// The lock-screen reminder button, reachable without a reminder having fired.
/// It is the cheapest answer to give and one of the more valuable to have —
/// a run of held severity is what the plateau analytics are built out of, and
/// it is exactly the reading nobody opens an app to log.
///
/// **It is a secondary button, not a primary one.** Solid accent means *press
/// this* in the app, and a filled sage pill would be the loudest thing on a
/// surface the palette works to keep quiet — the widget has none of the app's
/// protections. So it takes `btn-secondary`'s treatment: the raised surface
/// with a control-token hairline, which is the 3:1 outline WCAG 1.4.11 asks
/// for on the thing that identifies a control.
///
/// **It shows only on the medium family.** The small widget's 120-odd points
/// of height are already spent on the label, the duration, the trajectory and
/// the figures, and a control added there would have to evict one of them —
/// where the point of a widget you tap is that it still shows what you are
/// answering about. A medium widget has the room.
@available(iOS 17.0, *)
private struct NoChangeButton: View {
    let attackId: Double
    /// Already answered, and the app has not taken it up yet. The tap has to
    /// visibly land, or it is indistinguishable from the button not working.
    let answered: Bool

    var body: some View {
        if answered {
            Label("Noted", systemImage: "checkmark")
                .font(LiddFont.footnote(LiddFont.medium))
                .foregroundColor(.liddAccent)
                .labelStyle(.titleAndIcon)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
        } else {
            Button(intent: LiddNoChangeIntent(attackId: attackId)) {
                Text("No change")
                    .font(LiddFont.footnote(LiddFont.medium))
                    .foregroundColor(.liddPrimary)
                    .lineLimit(1)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
            }
            .buttonStyle(.plain)
            .background(Color.liddRaised, in: Capsule())
            .overlay(Capsule().strokeBorder(Color.liddControlBorder, lineWidth: 1))
        }
    }
}

/// The Today hero's artwork, ported to the widget's ground.
///
/// `HomeCard`'s recipe, and the parts of it that are load-bearing carry over
/// unchanged because they are about the same problem — artwork that has to
/// dissolve into the page rather than sit on it as a picture:
///
/// - **The image occupies the trailing 64%**, and the horizontal gradient's
///   opaque stop sits at 40% — *past* the image's left edge at 36%. Anywhere
///   the fade has already begun at that edge, the hard box edge shows as a
///   seam down the widget. Move the band and the stop moves with it.
/// - **Every gradient fades from `liddBase`, the ground colour itself**, and
///   to `liddBase.opacity(0)` rather than `.clear`. In SwiftUI as in CSS,
///   interpolating to a fully transparent *black* greys the mid-stops.
/// - **Three fades, one per edge the image has.** The right needs none: the
///   image reaches the widget's own edge there.
/// - **`.leading` alignment on the crop**, matching `imageAnchor="left"` on
///   `AttackFreeCard` — the moon sits left of centre in the square source, and
///   keeping that edge is what carries it into the visible strip.
///
/// **Only the attack-free state gets it.** The ongoing state is full — label,
/// duration, trajectory, figures, and on medium a dose column — and artwork
/// behind a severity line would be two things competing for the same pixels.
/// This is the state that had nothing to put in its lower two thirds, which is
/// what makes a picture the right answer here and the wrong one there.
private struct LiddArtwork: View {
    /// Resolved once. `Bundle.main` inside an extension is the extension's
    /// own bundle, which is where the file is copied.
    private static let artwork: UIImage? = {
        guard let url = Bundle.main.url(forResource: "LiddCardAttackFree", withExtension: "jpg") else { return nil }
        return UIImage(contentsOfFile: url.path)
    }()

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.liddBase
                // **Loaded by explicit bundle URL, not `UIImage(named:)`.**
                // That call finds a loose `.png` without its extension — which
                // is why `LiddMark` works — but not a loose `.jpg`, and it
                // fails by returning nil, so the widget renders a flat ground
                // and looks like a design decision rather than a missing file.
                // Same class of silent miss as `Image("name")` resolving only
                // against an asset catalog.
                if let image = Self.artwork {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geo.size.width * 0.64, height: geo.size.height, alignment: .leading)
                        .clipped()
                        .frame(width: geo.size.width, height: geo.size.height, alignment: .trailing)
                }
                LinearGradient(
                    stops: [
                        .init(color: .liddBase, location: 0.40),
                        .init(color: Color.liddBase.opacity(0.55), location: 0.66),
                        .init(color: Color.liddBase.opacity(0), location: 0.90),
                    ],
                    startPoint: .leading, endPoint: .trailing
                )
                VStack(spacing: 0) {
                    LinearGradient(
                        stops: [
                            .init(color: .liddBase, location: 0),
                            .init(color: Color.liddBase.opacity(0.45), location: 0.40),
                            .init(color: Color.liddBase.opacity(0), location: 1),
                        ],
                        startPoint: .top, endPoint: .bottom
                    )
                    .frame(height: geo.size.height * 0.30)
                    Spacer(minLength: 0)
                    LinearGradient(
                        stops: [
                            .init(color: Color.liddBase.opacity(0), location: 0),
                            .init(color: Color.liddBase.opacity(0.55), location: 0.60),
                            .init(color: .liddBase, location: 1),
                        ],
                        startPoint: .top, endPoint: .bottom
                    )
                    .frame(height: geo.size.height * 0.40)
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

/// The app's mark.
///
/// Rendered as a template — the artwork is a silhouette with a feathered alpha
/// cut from `assets/icon.png`, so it takes a flat fill and cannot drag the
/// icon's gradient onto a surface the palette keeps quiet. It is the accent
/// sage because that is the brand's own colour and this is the brand's own
/// mark; the "accent means action" rule governs controls, and this is not one.
private struct LiddMark: View {
    var size: CGFloat = 17
    var body: some View {
        if let image = UIImage(named: "LiddMark") {
            Image(uiImage: image)
                .renderingMode(.template)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .foregroundColor(.liddAccent)
                .opacity(0.85)
                .accessibilityHidden(true)
        }
    }
}

struct LiddWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LiddEntry

    /// Artwork only behind the attack-free state — see `LiddArtwork`. An
    /// ongoing attack has a trajectory to draw and no pixels to spare.
    private var showsArtwork: Bool {
        entry.snapshot?.ongoing == nil && entry.snapshot?.lastEndedAt != nil
    }

    var body: some View {
        content
            // **Top-anchored when there is artwork behind it, centred when
            // there is not**, and the two are the same decision rather than
            // an inconsistency. On a flat ground a top-anchored block left two
            // thirds of the widget visibly empty — the "layout that has
            // failed" reading. With the picture there, that space is doing
            // something, and the text sitting above it lets more of the
            // artwork show than centring does. Reinstated on Sunny's call,
            // 2026-09-01, after the artwork made the void argument moot.
            //
            // The no-artwork prominent states — "Nothing ongoing" and the
            // empty diary — keep the centring, since nothing fills the space
            // for them either.
            .frame(
                maxWidth: .infinity,
                maxHeight: .infinity,
                alignment: showsArtwork ? .topLeading : .leading
            )
            .liddContainerBackground(artwork: showsArtwork)
    }

    @ViewBuilder
    private var content: some View {
        if family == .systemMedium, let dose = entry.snapshot?.dose {
            // Two columns. The button sits under the dose block, which is
            // three short lines and has the slack for it — where the state
            // column is full to the bottom with the trajectory.
            HStack(alignment: .top, spacing: 14) {
                StateBlock(snapshot: entry.snapshot, entryDate: entry.date)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Rectangle()
                    .fill(Color.liddSurface)
                    .frame(width: 1)
                VStack(alignment: .leading, spacing: 0) {
                    DoseBlock(dose: dose, now: entry.date)
                    Spacer(minLength: 8)
                    noChangeButton
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else if family == .systemMedium, entry.snapshot?.ongoing != nil {
            // An attack with nothing taken for it: no second column, so the
            // headline takes the width, and the button anchors the bottom.
            VStack(alignment: .leading, spacing: 0) {
                StateBlock(snapshot: entry.snapshot, entryDate: entry.date, prominent: true)
                Spacer(minLength: 8)
                HStack {
                    Spacer()
                    noChangeButton
                }
            }
        } else if family == .systemMedium {
            // **No `Spacer` here, and that is the point.** Off an attack there
            // is no button to anchor the bottom, so a top-aligned block left
            // two thirds of the widget empty below it — the exact "layout that
            // has failed" reading `prominent` exists to prevent, and a
            // regression introduced with the button (caught on device,
            // 2026-09-01). Bare, it inherits the container's vertical centring,
            // the way `AttackFreeCard` centres its one figure in the hero.
            StateBlock(snapshot: entry.snapshot, entryDate: entry.date, prominent: true)
        } else {
            StateBlock(snapshot: entry.snapshot, entryDate: entry.date)
        }
    }

    /// Only while an attack is running — there is nothing for "no change" to
    /// mean otherwise — and only where the OS can draw a widget button at all.
    @ViewBuilder
    private var noChangeButton: some View {
        if #available(iOS 17.0, *), let ongoing = entry.snapshot?.ongoing {
            NoChangeButton(attackId: ongoing.id, answered: entry.answered)
        }
    }
}

private extension View {
    /// iOS 17 stopped letting a widget paint its own background directly and
    /// wants `containerBackground`, which is also what the Lock Screen and
    /// StandBy tint against. Below 17 the padding has to be drawn by hand,
    /// since the system supplied it only from 17 onward.
    @ViewBuilder
    func liddContainerBackground(artwork: Bool) -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                if artwork { LiddArtwork() } else { Color.liddBase }
            }
        } else {
            self.padding(16).background(artwork ? AnyView(LiddArtwork()) : AnyView(Color.liddBase))
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
