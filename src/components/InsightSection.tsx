// One card per topic on the Insights page: heading, the note that explains
// it, and the content all sit inside the same surface, so a caption clearly
// belongs to the chart it describes rather than floating between two blocks.
//
// **The note comes before the content, not after.** It says what the figure
// counts — "days with a logged attack, an attack past midnight counts as
// two" — and that has to be known to read the chart at all. Underneath, it
// was a footnote you reached only after guessing; above, it's the sentence
// the numbers answer. Same reason the heading is on top.
//
// **The inner surface only exists when there's a note.** Its job is to
// separate the content from the sentence explaining it; with no note there's
// nothing to separate, and a box inside a box is just a second border. So a
// section either has three tones (page / section / content) or two, and this
// component decides which — callers pass bare content and never wrap it.
//
// **The inner surface is an outline, not a fill** (Sunny, 2026-09-02). It was
// `bg-elevated`, a step lighter again, so a section with a note stacked three
// filled tones — page, card, content — and the chart sat in a visibly layered
// box. A hairline separates the content from the sentence explaining it just
// as well and adds no tone, which is the quieter answer §8.1 asks for. It is
// `bg-border`, the divider token and deliberately not `border-control`: this
// is an edge around something you read, not something you press.
interface Props {
  title: string;
  children: React.ReactNode;
  /** Explanatory line under the content — what the number means, or doesn't. */
  note?: React.ReactNode;
}

export function InsightSection({ title, children, note }: Props) {
  return (
    <section className="space-y-2">
      {/* Title sits above the card, on the page. Inside, it read as part of
          the content it labels; out here it labels the whole card. The stat
          tiles at the top keep their labels inside, because there the label
          and its figure *are* the content. */}
      {/* **The note sits below the content** (changed 2026-08-25, on Sunny's
          instruction). It was above, on the reasoning that a caption defining
          what the figure counts — "migraine days" and not "headache days", an
          attack past midnight counting as two — has to be read *before* the
          chart can be read at all, and that underneath it becomes a footnote
          you only reach after guessing.

          That reasoning is recorded rather than deleted because it is the
          argument for putting it back, and it has not been refuted — what
          changed is the call. The captions here run to five or six lines, and
          leading with a wall of small grey text pushes the thing the section
          exists to show below the fold on a phone. The chart is what the page
          is opened for; the caption qualifies it. Don't flip this back without
          reading both halves. */}
      {/* `h2`, not `h3`. The tab's own title is the `h1` and there is nothing
          between, so an `h3` skipped a level — which is how a screen-reader
          user navigating by heading discovers a page's structure. It was
          briefly an `h3` under a group heading; that grouping is gone (see
          `StatsView`). The size is set by the class, not the tag. */}
      <h2 className="text-xs uppercase tracking-wider font-medium text-text-secondary">{title}</h2>

      {/* `p-4`, matching the stat tiles at the top of the page (Sunny,
          2026-09-02). It was `p-3`, so the two kinds of card on one screen
          held their content at different insets — the sort of mismatch that
          reads as two different apps rather than as a deliberate difference.
          The inner box stays at `p-3`: it is nested inside this one, not a
          peer of the tiles. */}
      <div className="space-y-2 rounded-2xl bg-bg-surface p-4">
        {note ? (
          <>
            <div className="rounded-xl border border-bg-border p-3">{children}</div>
            <p className="text-xs text-text-secondary">{note}</p>
          </>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
