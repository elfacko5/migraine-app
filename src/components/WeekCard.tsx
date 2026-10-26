import type { Attack } from '../types';
import { attacksInLastSevenDays, lastSevenDays } from '../utils/stats';
import { TODAY_CARD } from '../utils/todayCard';

// Today's week strip, shown only when it says something: two or more attacks
// in the last seven days. The week used to sit on Today permanently; most
// weeks it was seven empty circles, which is a screen of nothing to read. Now
// it appears when there is a cluster worth noticing, and the title states the
// count — the same "state the number and stop" rule as every figure here.
//
// **Filled circles, reversing the 2026-09-02 dots decision on Today** (Sunny,
// 2026-10-26). That call replaced cells with dots under the date because
// rounded fills borrowed the segmented control's shape and read as tappable.
// The v3 design wants the circles back, and two things answer the original
// worry: the card is a static block with no hover, press or focus state, and
// a migraine day carries a diamond as well as a fill, so the state is never
// colour alone (FL-41 lenses shift exactly the sage-vs-grey difference).
// Insights' week strip keeps its dots for now.
//
// **A day is marked when any attack touched it** — an attack running past
// midnight marks both days, as on Insights. The card's *trigger* counts
// attacks rather than days, so one long attack never shows it on its own.
export function WeekCard({ attacks }: { attacks: Attack[] }) {
  // Both utils read the clock themselves; a component never derives a value
  // from `Date.now()` during render.
  const count = attacksInLastSevenDays(attacks);
  if (count < 2) return null;
  const days = lastSevenDays(attacks);

  // The label names the days rather than describing the picture: "Migraine on
  // Monday 20 and Wednesday 22". Built from each cell's own key, so it never
  // reads the clock.
  const dayName = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' });
  };
  const hits = days.filter((d) => d.hit).map((d) => dayName(d.key));
  const label = hits.length === 0
    ? 'No migraine days in the last 7 days'
    : `Migraine on ${hits.length === 1 ? hits[0] : `${hits.slice(0, -1).join(', ')} and ${hits[hits.length - 1]}`}`;

  return (
    <div className={`${TODAY_CARD} space-y-3`}>
      <h2 className="text-[1.1875rem] font-semibold text-text-primary">
        {count} attacks in the last 7 days
      </h2>
      <div role="img" aria-label={label} className="flex justify-between">
        {days.map((d, i) => {
          const today = i === days.length - 1;
          return (
            <div key={d.key} aria-hidden="true" className="flex w-10 flex-col items-center">
              <span
                className={`flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-full ${
                  d.hit ? 'bg-accent' : ''
                } ${today ? 'ring-2 ring-text-primary' : d.hit ? '' : 'ring-[1.5px] ring-inset ring-bg-border'}`}
              >
                {d.hit && <MigraineDiamond />}
              </span>
              <span className="mt-1.5 text-xs text-text-secondary">{d.initial}</span>
            </div>
          );
        })}
      </div>
      {/* The legend only names the mark that means something; an empty
          circle needs no key. The prototype's "Checked in" / headache marker
          goes with the headache tile, which has nothing to count. */}
      <p aria-hidden="true" className="flex items-center justify-center gap-1.5 text-xs text-text-secondary">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent">
          <span className="block h-[0.3125rem] w-[0.3125rem] rotate-45 rounded-[1px] bg-bg-base" />
        </span>
        Migraine
      </p>
    </div>
  );
}

/** The 9px diamond inside a migraine day — the non-colour half of the mark. */
function MigraineDiamond() {
  return <span className="block h-[0.5625rem] w-[0.5625rem] rotate-45 rounded-[2px] bg-bg-base" />;
}
