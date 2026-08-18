// One card per topic on the Insights page: heading, content, and the note
// that explains it all sit inside the same surface, so a caption clearly
// belongs to the chart above it rather than floating between two blocks.
//
// Three tones are in play — the page (`bg-base`), the section (`bg-surface`)
// and whatever the section puts inside it (`bg-raised`). Content nested in
// here should use `bg-bg-raised`, not `bg-bg-surface`, or it disappears into
// its own container.
interface Props {
  title: string;
  children: React.ReactNode;
  /** Explanatory line under the content — what the number means, or doesn't. */
  note?: React.ReactNode;
}

export function InsightSection({ title, children, note }: Props) {
  return (
    <section className="space-y-2 rounded-2xl bg-bg-surface p-3">
      <h3 className="text-xs uppercase tracking-wider font-medium text-text-secondary">{title}</h3>
      {children}
      {note && <p className="text-xs text-text-secondary">{note}</p>}
    </section>
  );
}
