import type { Snapshot } from '../types';
import { formatTime } from '../utils/format';
import { MedIcon } from './drawnIcons';
// Was a local copy of the ramp with `<= 8` as the middle bound, which put a
// severity 8 in amber here and terracotta everywhere else. Shared now.
import { sevTextClass as sevColor } from '../utils/severity';

// A labelled block inside a reading. Everything after the areas line is
// "what else was true at this moment", and each kind of thing is named
// rather than left to be inferred from its punctuation — which is what the
// old "Relief: …" / bare-symptom-list rows relied on.
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-bg-border pt-2.5">
      <p className="text-xs uppercase tracking-wider text-text-secondary label-caps">{label}:</p>
      {/* 14px, a step below the pain-area line above it. The values ended up
          the same size as the headline and, being longer runs of much higher
          contrast text, dominated the card. Same size as the label now — the
          two are told apart by case and colour, since taking the label to
          12px would break the spec's 14px caption floor. */}
      <div className="mt-1 text-xs text-text-primary">{children}</div>
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
  const sourceLabel = snap.source === 'notification_yes' ? 'Via reminder' : null;

  const areas = Object.entries(snap.areas);

  // A no-change reading is one statement, so the card makes one statement.
  // Its severities are carried forward in the data — the breakdown and the
  // plateau stats need them — but repeating them here would fill the card
  // with figures identical to the row below it.
  const noChange = snap.source === 'notification_no_change';

  return (
    <div className="flex gap-2">
      {/* Stem — one continuous rail with the times sitting *on* it: each
          timestamp carries the page background and a little vertical padding,
          so it knocks a clean gap in the line rather than being crossed by
          it. The rail is centred in a fixed-width column, so every gap lines
          up whether the time is 4 or 5 characters ("9:09" vs "11:03").

          The column is only as wide as the widest timestamp needs — in `rem`,
          so it grows with the text scale rather than clipping — and the gap to
          the card is 8px. It was 64px + 12px, which left a band of dead space
          down the left of every entry. */}
      <div className="relative flex w-12 shrink-0 flex-col items-center">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-bg-border" />
        {dateLabel && (
          <span className="relative bg-bg-surface px-1.5 py-1 text-[0.65rem] font-medium text-text-secondary whitespace-nowrap">{dateLabel}</span>
        )}
        <span className="relative mt-1.5 bg-bg-surface px-1.5 py-1.5 text-xs tabular-nums text-text-secondary whitespace-nowrap">
          {formatTime(snap.time)}
        </span>
      </div>

      {/* Cards have no outline — they're told apart from the page by being a
          step lighter than it (bg-raised on bg-surface), which is quieter
          than a border on every entry down a long timeline. The section
          hairlines inside stay: those separate things *within* one reading. */}
      <div className="min-w-0 flex-1 pb-4">
        {noChange ? (
          <div className="rounded-xl bg-bg-raised px-4 py-3">
            <p className="text-sm text-text-secondary">No change</p>
          </div>
        ) : (
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
                  <span aria-hidden="true" className="shrink-0">
                    <MedIcon name={snap.medication.name} dose={snap.medication.dose} className="inline h-3.5 w-3.5 align-[-0.15em]" />
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
        )}
      </div>
    </div>
  );
}
