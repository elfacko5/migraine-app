import type { Snapshot } from '../types';
import { formatTime } from '../utils/format';
import { medIcon, medColor } from '../utils/medDisplay';

function sevColor(s: number): string {
  if (s <= 3) return 'text-severity-low';
  if (s <= 8) return 'text-severity-mid';
  return 'text-severity-high';
}

// A labelled block inside a reading. Everything after the areas line is
// "what else was true at this moment", and each kind of thing is named
// rather than left to be inferred from its punctuation — which is what the
// old "Relief: …" / bare-symptom-list rows relied on.
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-bg-border pt-2.5">
      <p className="text-xs uppercase tracking-wider text-text-secondary label-caps">{label}:</p>
      <div className="mt-1 text-sm text-text-primary">{children}</div>
    </div>
  );
}

// dateLabel is only passed when the attack spans multiple calendar days —
// for a same-day attack the header already states the date, so repeating it
// on every row is noise.
interface Props { snap: Snapshot; dateLabel?: string }

export function SnapshotRow({ snap, dateLabel }: Props) {
  // No "Attack start" label: the oldest reading is already the bottom of a
  // list ordered by time, so the label restated what the position said.
  // A notification-sourced reading still says so — that one isn't derivable
  // from anything on screen, and `no_change` in particular means severity
  // held rather than nobody having looked.
  const sourceLabel =
    snap.source === 'notification_no_change' ? 'No change' :
    snap.source === 'notification_yes' ? 'Via reminder' : null;

  const areas = Object.entries(snap.areas);

  return (
    <div className="flex gap-3">
      {/* Stem — one rail down the left edge, with the times sitting beside it
          rather than across it. The line used to run along the column's right
          edge, which put it behind the timestamps as soon as the text scale
          grew enough for them to fill the column. A fixed column width still
          keeps every time and the rail aligned regardless of whether the time
          is 4 or 5 characters ("9:09" vs "11:03"). */}
      <div className="relative w-16 shrink-0 pl-3">
        <div className="absolute inset-y-0 left-0 w-px bg-bg-border" />
        {dateLabel && (
          <span className="relative block text-[0.65rem] font-medium text-text-secondary whitespace-nowrap">{dateLabel}</span>
        )}
        <span className="relative block pt-3.5 text-xs tabular-nums text-text-secondary whitespace-nowrap">
          {formatTime(snap.time)}
        </span>
      </div>

      <div className="min-w-0 flex-1 pb-4">
        {/* No outline — the card is told apart from the page by being a step
            lighter than it (bg-raised on bg-surface), which is quieter than a
            border on every entry down a long timeline. The section hairlines
            inside stay: those separate things *within* one reading. */}
        <div className="rounded-xl bg-bg-raised px-4 py-3">
          {/* Pain areas: one wrapping line, each zone coloured by its own
              severity. This is the line the timeline exists to be scanned
              for, so nothing sits above it. */}
          {areas.length > 0 && (
            <p className="text-sm font-medium">
              {areas.map(([area, s], i) => (
                <span key={area}>
                  {i > 0 && <span className="text-text-secondary"> · </span>}
                  <span className={sevColor(s)}>{area}: {s}</span>
                </span>
              ))}
            </p>
          )}

          {sourceLabel && (
            <p className={`text-xs text-text-secondary ${areas.length > 0 ? 'mt-1' : ''}`}>{sourceLabel}</p>
          )}

          <div className={areas.length > 0 || sourceLabel ? 'mt-3 space-y-2.5' : 'space-y-2.5'}>
            {snap.medication && (
              <Section label="Medication">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs"
                    style={{ backgroundColor: `${medColor(snap.medication.name)}26` }}
                  >
                    {medIcon(snap.medication.name, snap.medication.dose)}
                  </span>
                  <span className="min-w-0">
                    {snap.medication.name}{snap.medication.dose && ` ${snap.medication.dose}`}
                  </span>
                </span>
              </Section>
            )}

            {(snap.reliefs ?? []).length > 0 && (
              <Section label="Relief">{snap.reliefs!.join(', ')}</Section>
            )}

            {snap.symptoms.length > 0 && (
              <Section label="Symptoms">{snap.symptoms.join(', ')}</Section>
            )}

            {snap.note && <Section label="Note">{snap.note}</Section>}
          </div>
        </div>
      </div>
    </div>
  );
}
