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
// The inner surface is `bg-elevated`, a step lighter than `bg-raised`: three
// stacked surfaces (page, section, content) need more separation between the
// top two than one step gives.
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
      {/* `h2`, not `h3`. The tab's own title is the `h1` and there is nothing
          between, so an `h3` skipped a level — which is how a screen-reader
          user navigating by heading discovers a page's structure. The size is
          set by the class, not the tag. */}
      <h2 className="text-xs uppercase tracking-wider font-medium text-text-secondary">{title}</h2>

      <div className="space-y-2 rounded-2xl bg-bg-surface p-3">
        {note ? (
          <>
            <p className="text-xs text-text-secondary">{note}</p>
            <div className="rounded-xl bg-bg-elevated p-3">{children}</div>
          </>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
