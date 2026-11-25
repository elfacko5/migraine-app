import type { Attack, Medication, Snapshot } from '../types';
import { formatTime } from '../utils/format';
import { isRetired } from '../utils/retired';
import { resolveDose } from '../utils/medResolve';
import { unitsLabel } from '../utils/medGuardrails';
import { MedIcon } from './drawnIcons';
import { MarkChips, SevBox } from './AttackDetailParts';
import { isDetailOnly } from '../utils/readings';

const weekday = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
const kept = (names: string[]) => names.filter((n) => !isRetired(n));

/**
 * Every reading, oldest first, then the end. Each kind of thing has its own
 * shape so a row can be scanned: a solid number box per pain area, an outlined
 * letter box per medicine, icon chips for symptoms and what was tried, a speech
 * mark for a note.
 *
 * A "No change" reply lists no areas: its severities are carried forward, not
 * re-reported. Symptoms added after the attack ended are shown on the end row
 * as "Added later", never slotted into the readings.
 */
export function AttackTimeline({ attack, medications, letterFor }: {
  attack: Attack;
  medications: Medication[];
  letterFor: (name: string) => string | null;
}) {
  const start = attack.snapshots[0].time;
  const spansDays = new Date(start).toDateString() !== new Date(attack.end ?? attack.snapshots[attack.snapshots.length - 1].time).toDateString();
  const later = attack.snapshots.filter((s) => s.addedLater);
  // Details-only answers sit on the end row wherever their timestamp falls: the
  // end may have been edited since they were saved.
  const onEndRow = (s: Snapshot) => attack.end !== null && isDetailOnly(s);
  const atEnd = attack.snapshots.filter((s) => !s.addedLater && onEndRow(s));
  const readings = attack.snapshots.filter((s) => !onEndRow(s));
  const uniq = (list: Snapshot[], key: 'symptoms' | 'reliefs') => [...new Set(list.flatMap((s) => kept(s[key] ?? [])))];

  return (
    <ol className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
      {readings.map((s, i) => {
        const noChange = s.source === 'notification_no_change';
        const areas = noChange ? [] : Object.entries(s.areas).sort((a, b) => b[1] - a[1]);
        const med = s.medication?.name && !isRetired(s.medication.name) ? s.medication : null;
        const lib = med ? resolveDose(med, medications).med : null;
        return (
          <Entry key={`${s.time}-${i}`} time={formatTime(s.time)} day={spansDays ? weekday(s.time) : null}
            title={noChange ? 'No change' : i === 0 ? 'Started' : 'Update'}>
            {areas.length > 0 && (
              <ul className="space-y-1.5">
                {areas.map(([name, v]) => (
                  <li key={name} className="flex items-center gap-2.5 text-sm text-text-primary">
                    <SevBox value={v} className="h-6 w-7 text-xs" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
                  </li>
                ))}
              </ul>
            )}
            {med && (
              <p className="flex items-center gap-2.5 text-sm text-text-primary">
                <span aria-hidden="true" className="flex h-6 w-7 shrink-0 items-center justify-center rounded-badge bg-bg-base text-xs font-bold ring-[1.5px] ring-inset ring-accent">
                  {letterFor(med.name) ?? <MedIcon name={med.name} dose={med.dose} className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  {[med.name, med.amount ? unitsLabel(med.amount, lib) : med.dose].filter(Boolean).join(' · ')}
                </span>
              </p>
            )}
            <Group label="Symptoms" kind="symptom" names={kept(s.symptoms ?? [])} />
            <Group label="Tried" kind="relief" names={kept(s.reliefs ?? [])} />
            {s.note && (
              <p className="flex items-start gap-2.5 text-xs text-text-secondary">
                <span aria-hidden="true" className="flex h-6 w-7 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-[1.125rem] w-[1.125rem]">
                    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <span className="min-w-0 py-0.5 [overflow-wrap:anywhere]">“{s.note}”</span>
              </p>
            )}
          </Entry>
        );
      })}
      {attack.end !== null && (
        // An unknown end shows no time at all rather than the placeholder.
        <Entry
          time={attack.endUnknown ? null : formatTime(attack.end)}
          day={spansDays && !attack.endUnknown ? weekday(attack.end) : null}
          title="Attack ended"
        >
          {attack.endUnknown && <p className="text-xs text-text-secondary">Gone when you woke up</p>}
          <Group label="Symptoms" kind="symptom" names={uniq(atEnd, 'symptoms')} />
          <Group label="Tried" kind="relief" names={uniq(atEnd, 'reliefs')} />
          {later.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-text-secondary">Added later</p>
              <MarkChips kind="symptom" names={uniq(later, 'symptoms')} />
              <MarkChips kind="relief" names={uniq(later, 'reliefs')} />
            </div>
          )}
        </Entry>
      )}
    </ol>
  );
}

function Entry({ time, day, title, children }: { time: string | null; day: string | null; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="w-12 shrink-0 text-xs tabular-nums text-text-secondary">
        {day && <span className="block">{day}</span>}
        {time ?? <span className="sr-only">Time not recorded</span>}
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {children}
      </div>
    </li>
  );
}

function Group({ label, kind, names }: { label: string; kind: 'symptom' | 'relief'; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs text-text-secondary">{label}</p>
      <MarkChips kind={kind} names={names} />
    </div>
  );
}
