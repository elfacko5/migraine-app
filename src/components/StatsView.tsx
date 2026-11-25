import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Attack, DeletedMedName, MedGuides, Medication } from '../types';
import { formatDateShort } from '../utils/format';
import {
  attackMaxSeverity,
  areaFrequency, avgTimeToPeak, avgAttackLength,
  triggerFrequency, symptomFrequency, reliefFrequency, type Freq,
} from '../utils/stats';
import { HeadHeatmap } from './HeadHeatmap';
import { MigraineDaysChart } from './MigraineDaysChart';
import { MedicationInsights } from './MedicationInsights';
import { InsightSection } from './InsightSection';
import { AttackCard } from './AttackCard';
import { PERIOD_MS, type Period } from '../utils/logFilters';
import { useUiTheme, type UiTheme } from '../hooks/useUiTheme';

// Below this many attacks ever logged, the frequency/trend sections (v4
// "InsightsLowData") give way to a plain list and a teaser: a bar chart of
// one or two months, or a "most common symptom" built from a single attack,
// states a pattern before there's one to state. Counts total attacks, not
// `filtered` — the question is "is there enough history yet", which doesn't
// reset every time the period control is touched.
const LOW_DATA_THRESHOLD = 5;

// Recharts takes its colours as literal style/prop values, not CSS custom
// properties — same limitation as an SVG presentation attribute, see
// headDiagram.ts. So the chart chrome (axis ticks, tooltip, the trend line)
// and the frequency-bar colours are mirrored here per theme rather than
// read off index.css. Attack mode gets its own tick/tooltip/text values
// (they're genuinely different tokens — --color-text-secondary etc. differ
// between dark and attack) but shares dark's severity/accent colours, the
// same reuse the diagram palette in headDiagram.ts makes, since those three
// are literally the same values for both themes in index.css.
const CHART_COLORS: Record<UiTheme, {
  tick: string; tooltipBg: string; tooltipBorder: string; label: string; item: string; line: string;
  accent: string;
  chart3: string; chart4: string;
}> = {
  dark: {
    tick: '#a39d92', tooltipBg: '#302d29', tooltipBorder: '#3a3733',
    label: '#a39d92', item: '#cdc7bb', line: '#9bb9a1',
    accent: '#7fa187',
    // Insights categorical palette (v4 decision A7/12) — mirrored here for
    // the same reason the rest of this object is: Recharts and an inline
    // `style` prop both take literal values, never a CSS custom property.
    // Attack reuses dark's hex, like accent above: these clear 6.2:1+
    // against every attack-mode surface (measured), so there's nothing
    // attack-specific to derive.
    chart3: '#d0948c', chart4: '#c9b58c',
  },
  attack: {
    tick: '#9a9689', tooltipBg: '#262218', tooltipBorder: '#34322a',
    label: '#9a9689', item: '#c9c4b8', line: '#93ae99',
    accent: '#7fa187',
    chart3: '#d0948c', chart4: '#c9b58c',
  },
  light: {
    tick: '#5a554c', tooltipBg: '#e2dcd0', tooltipBorder: '#d5cec0',
    label: '#5a554c', item: '#3a3733', line: '#3c5544',
    accent: '#4f6b57',
    // Derived and measured, same method as --color-chart-3/4 in index.css:
    // same hue/saturation as dark, lightness brought down to clear 3:1 on a
    // light page (4.58:1 / 4.63:1 against bg-raised).
    chart3: '#98493e', chart4: '#715d35',
  },
};


/** Calendar months touched by a window, inclusive of both ends. */
function monthsBetween(fromMs: number, toMs: number): number {
  const a = new Date(fromMs), b = new Date(toMs);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

interface Props {
  attacks: Attack[];
  /** Passed straight through to MedicationInsights, for each drug's own
   *  overuse reference point. */
  medications?: Medication[];
  /** The monthly guides, passed through to MedicationInsights. */
  guides?: MedGuides;
  /** Passed through to MedicationInsights: deleted names are not marked as overuse. */
  deleted?: DeletedMedName[];
  /** Opens Monthly guides as a bottom sheet (owned by `App`, like every sheet). */
  onOpenGuides?: () => void;
  /** Owned by `App`, because the control that sets it is rendered in the top
   *  bar rather than on this page. Defaults there to 30 days, not 7: every
   *  clinical figure here is monthly — the overuse thresholds, the 15-day
   *  episodic/chronic line — and a 7-day window in a quiet week showed an
   *  empty page to someone with a perfectly normal number of attacks. */
  period: Period;
  /** Opens that attack's detail sheet — used by the low-data "Your attacks"
   *  list and nowhere else on this page. */
  onAttackClick: (attack: Attack) => void;
  /** Starts a new attack, straight into the wizard (no menu) — the same
   *  shortcut Today's own first-run empty state uses, for the same reason:
   *  there's no ongoing attack to choose between logging now and adding an
   *  update, so the menu would be one tap of nothing to decide. */
  onAdd: () => void;
}

// A figure in the "Typical attack" grid — the board's `.fc`: a value over a
// plain-language label, on its own `bg-surface` cell. The grid's 1px gaps
// show the `bg-raised` behind it as the dividers between cells.
function TypicalStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-bg-surface px-4 py-3.5">
      <p className="text-[1.375rem] font-semibold leading-tight text-text-strong">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-text-secondary">{label}</p>
    </div>
  );
}

// A typical-attack duration as the board writes it: hours to one decimal,
// ".0" dropped ("9 h", "1.5 h"); under an hour, whole minutes ("40 min"),
// since "0.7 h" makes the reader do arithmetic.
function formatTypicalDuration(minutes: number): string {
  // Rounded first, so 59.6 reads "1 h" rather than "60 min".
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.round((m / 60) * 10) / 10;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

// The board's clock glyph for "Typical attack".
const ClockGlyph = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);

// Ranked horizontal frequency bars (most-frequent first).
function FreqBars({ data, color }: { data: Freq[]; color: string }) {
  const max = data[0]?.count ?? 1;
  return (
    <div className="space-y-2.5">
      {data.slice(0, 8).map((f) => (
        <div key={f.name} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-primary truncate pr-2">{f.name}</span>
            <span className="text-text-secondary tabular-nums shrink-0">{f.count}×</span>
          </div>
          <div className="h-2 rounded-full bg-bg-border/40 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(f.count / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// No period in the title. The control is pinned in the top bar now, so it says
// which window every figure answers — repeating it on each section was a line
// apiece saying what is already on screen (2026-09-02).
//
// `info`, not `note` (2026-09-24, Sunny's call — every section on the page
// now carries its explanation behind the "More info" icon rather than some
// behind it and some not, which read as an inconsistency once a few sections
// had it and the rest didn't).
function FreqSection({ title, data, color, info }: { title: string; data: Freq[]; color: string; info?: React.ReactNode }) {
  if (data.length === 0) return null;
  return (
    <InsightSection title={title} info={info}>
      <FreqBars data={data} color={color} />
    </InsightSection>
  );
}

export function StatsView({ attacks, medications = [], guides = {}, deleted = [], period, onAttackClick, onAdd, onOpenGuides }: Props) {
  const theme = useUiTheme();
  const chartColors = CHART_COLORS[theme];

  // The window the whole page answers, derived once. `null` is all time.
  //
  // `monthsShown` is how many calendar months `MigraineDaysChart` renders: the
  // months the window actually touches, so "7 days" shows one or two rather
  // than six. All time is capped at 12 — the bars are one row each, but an
  // unbounded chart is a different component.
  const { since, monthsShown, rangeFrom, rangeTo } = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (period === 'all') {
      const first = attacks.reduce<number>(
        (min, a) => Math.min(min, new Date(a.snapshots[0].time).getTime()), now);
      return { since: null, monthsShown: Math.min(12, monthsBetween(first, now)), rangeFrom: first, rangeTo: now };
    }
    const cutoff = now - PERIOD_MS[period];
    return {
      since: cutoff,
      monthsShown: monthsBetween(cutoff, now),
      rangeFrom: cutoff,
      rangeTo: now,
    };
  }, [period, attacks]);

  const filtered = useMemo(() => {
    if (period === 'all') return attacks;
    // the period filter is relative to now by definition; see the same call
    // in HistoryView.
    // eslint-disable-next-line react-hooks/purity
    const cutoff = Date.now() - PERIOD_MS[period];
    return attacks.filter((a) => new Date(a.snapshots[0].time).getTime() >= cutoff);
  }, [attacks, period]);

  const stats = useMemo(() => {
    const avgSeverity = filtered.length
      ? (filtered.reduce((s, a) => s + attackMaxSeverity(a), 0) / filtered.length).toFixed(1)
      : '—';

    const avgLength = avgAttackLength(filtered);

    const timeToPeak = avgTimeToPeak(filtered);

    // `filtered` is newest-first (see `useAttacks`), so the most recent 12
    // are the *first* 12 — take those, then reverse for left-to-right
    // chronological reading. Found while writing this section's caption
    // (2026-09-24): it used to reverse first and slice second, which took
    // the *oldest* 12 in the period whenever there were more than 12 —
    // silently wrong for anyone logging more than a dozen attacks inside a
    // 3-month or all-time window, which chronic migraine is exactly the case
    // for.
    const severityTrend = [...filtered].slice(0, 12).reverse().map((a) => ({
      // No weekday: a dozen of these sit along one axis and "Fri " on each
      // is three characters of noise per label.
      date: formatDateShort(a.snapshots[0].time),
      severity: attackMaxSeverity(a),
    }));

    const areas = areaFrequency(filtered);

    // Attacks already there on waking. A flag set at logging time, so an
    // attack logged without it counts as not — the denominator is every
    // attack in the period, the same "x of n" the Symptoms section uses.
    const wokeWith = filtered.filter((a) => a.wokeWithMigraine).length;

    return {
      count: filtered.length,
      wokeWith,
      avgSeverity,
      avgLength,
      timeToPeak,
      severityTrend,
      areas,
      triggers: triggerFrequency(filtered),
      symptoms: symptomFrequency(filtered),
      reliefs: reliefFrequency(filtered),
    };
  }, [filtered]);

  if (attacks.length === 0) {
    // v4 "InsightsEmptyDark" — a drawn tile (the Insights tab's own trend-line
    // mark, `BottomNav.tsx`'s `StatsIcon` path, inlined the same way every
    // other icon in this codebase is) replacing a bare emoji, which broke the
    // "no emoji ever" rule (CLAUDE.md, Shared components). The CTA mirrors
    // Today's own first-run shortcut (`App.tsx`): straight into the wizard,
    // no menu, since there's no ongoing attack to choose against.
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
        <span className="flex h-18 w-18 items-center justify-center rounded-full bg-bg-raised text-text-secondary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden="true">
            <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </span>
        <p className="text-lg font-semibold text-text-strong">Nothing to show yet</p>
        <p className="max-w-[17rem] text-sm text-text-secondary">
          Log a few attacks and this page fills in — patterns in timing, medication and what tends to come with them.
        </p>
        <button type="button" onClick={onAdd} className="btn-primary btn-compact mt-1">
          Log an attack
        </button>
      </div>
    );
  }

  const hasEnoughData = attacks.length >= LOW_DATA_THRESHOLD;

  return (
    <div className="space-y-8">
      {/* The period control is not here — it lives in the top bar, so it stays
          on screen while the page scrolls (2026-09-02). As a chip row at the
          top of the content it scrolled away, and half way down the page
          nothing said which period the figures answered. `period` is owned by
          `App` for the same reason. */}

      {/* The window the page answers, in dates, with the attack count folded
          in (it used to be the "Attacks" tile). The averages that were the
          other tiles moved into "Typical attack" below. */}
      {/* Centred at caption size under the period control, as the v4 board's
          `.range` (14px, centred). */}
      <p className="text-center text-xs text-text-secondary">
        {formatDateShort(new Date(rangeFrom).toISOString())} – {formatDateShort(new Date(rangeTo).toISOString())}
        {' · '}{stats.count} attack{stats.count === 1 ? '' : 's'}
      </p>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-text-secondary text-sm">
          No attacks in this period.
        </div>
      )}

      {/* These ignore the period filter — "days per month" and the overuse
          thresholds are monthly figures, and a rolling 7-day window can't
          express either. They also sit outside the empty-period branch above:
          picking "7 days" in a quiet week must not hide the month's
          medication count, which is the number someone would be checking.
          **The section that says so is the caption under the chart**, not a
          heading above it: a "By month" group heading was tried on
          2026-09-02 and removed the same day, because a heading at that level
          reads as owning everything below it — including the period-scoped
          blocks that follow, which is the opposite of what it claimed. */}
      {hasEnoughData && (
        // These ignore the period filter — see the note above. Held out of
        // the low-data branch too: a two-attack bar chart states a monthly
        // pattern before there's one to state, the same reason the frequency
        // sections below wait for `hasEnoughData`.
        <MigraineDaysChart attacks={attacks} months={monthsShown} mode={period === '7d' ? 'week' : 'months'} />
      )}
      <MedicationInsights
        attacks={attacks}
        medications={medications}
        guides={guides}
        deleted={deleted}
        since={since}
        months={monthsShown}
        onOpenGuides={onOpenGuides}
      />

      {!hasEnoughData ? (
        // v4 "InsightsLowData" — below `LOW_DATA_THRESHOLD` attacks ever
        // logged, the frequency/trend sections below give way to a plain
        // list of what's been logged and a teaser for what unlocks with more
        // history. `filtered`, not `attacks`: this list answers the same
        // "attacks in this period" the date-range line above it states.
        <>
          {filtered.length > 0 && (
            <InsightSection title="Your attacks">
              <div className="space-y-2">
                {filtered.map((a) => (
                  <AttackCard key={a.id} attack={a} isOngoing={a.end === null}
                    medications={medications} onClick={() => onAttackClick(a)} />
                ))}
              </div>
            </InsightSection>
          )}
          <InsightSection
            title={`More at ${LOW_DATA_THRESHOLD} attacks`}
            info="Patterns need a few attacks behind them — a chart from one or two reads as a trend when it's really just what happened once. Nothing here is lost: it's all in Logs, and these sections fill in as you go."
          >
            <div className="space-y-3">
              <div
                className="h-2 overflow-hidden rounded-full bg-bg-border/40"
                role="img"
                aria-label={`${attacks.length} of ${LOW_DATA_THRESHOLD} attacks`}
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, (attacks.length / LOW_DATA_THRESHOLD) * 100)}%` }}
                />
              </div>
              <p className="text-sm text-text-secondary">{attacks.length} of {LOW_DATA_THRESHOLD}</p>
              <div className="flex flex-wrap gap-2">
                {['Attack days', 'Pain over time', 'Where it hurt', 'Symptoms', 'What you tried'].map((label) => (
                  <span key={label} className="rounded-chip bg-bg-border/40 px-3 py-1.5 text-sm text-text-primary">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </InsightSection>
        </>
      ) : filtered.length > 0 && (
        <>
          {/* Typical attack — the averages that used to be loose stat tiles,
              grouped (v4). `avgTimeToPeak` and `avgAttackLength` already
              existed; "woke up with it" and the grouping are new. */}
          <InsightSection
            title="Typical attack"
            icon={ClockGlyph}
            iconTone="bg-chart-4/16 text-chart-4"
            // No section card: the grid is the card (`.facts` on the board),
            // its cells divided by 1px gaps rather than padded inside a fill.
            bare
            info="Across the attacks in this period. Peak is each attack's own worst reading, averaged. Length leaves out any attack still going. Time to the peak counts only the attacks that got worse after the first reading — not one still going, or one already there when you woke — and shows once three have. Woke up with it counts the attacks that were already there when you woke."
          >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9.375rem,1fr))] gap-px overflow-hidden rounded-card bg-bg-raised">
              <TypicalStat value={stats.avgSeverity} label="average peak pain" />
              {stats.avgLength !== null && (
                <TypicalStat value={formatTypicalDuration(stats.avgLength)} label="long" />
              )}
              {stats.timeToPeak !== null && (
                <TypicalStat value={formatTypicalDuration(stats.timeToPeak)} label="to the peak" />
              )}
              {/* Was "attack days" (from the v4 board) until 2026-11-25 —
                  replaced because it counts how often, not what an attack is
                  like, and repeated the Attack days chart above. */}
              <TypicalStat value={`${stats.wokeWith} of ${stats.count}`} label="woke up with it" />
              {/* With a figure missing (length or time to peak while every
                  attack is still going) the grid has an empty slot, which
                  would show as a block of the divider colour. Filled with a
                  blank cell instead. */}
              {(stats.avgLength === null) !== (stats.timeToPeak === null) && (
                <div aria-hidden="true" className="bg-bg-surface" />
              )}
            </div>
          </InsightSection>

          {/* Severity trend. Stays on the accent/line colour, never the
              Insights chart-N palette: it plots pain severity, and A7/decision
              12's own text is explicit that the categorical set is "never for
              pain intensity, which stays on the severity ramp... even inside
              an Insights chart" — true even though the source mock draws this
              one line in chart-2 purple, which contradicts its own rule. */}
          {stats.severityTrend.length >= 2 && (
            <InsightSection title="Pain over time"
              info="Peak severity for the most recent attacks in this period, oldest to newest. Up to 12 shown."
            >
              <div>
                {/* left/right and top/bottom were lopsided — measured, not
                    eyeballed (2026-09-23, Sunny's call): the plot area sat
                    40px in from the card's left edge against 8px on the
                    right, and XAxis's default 30px band left ~16px of dead
                    air under a single 10px line of date labels. `left` is
                    pulled in further to match the y-axis labels' own width
                    rather than Recharts' default reservation, and `height`
                    on XAxis is set to what one line of its own tick text
                    actually needs. */}
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={stats.severityTrend} margin={{ top: 4, right: 8, bottom: 0, left: -38 }}>
                    <XAxis dataKey="date" tick={{ fill: chartColors.tick, fontSize: '0.625rem' }} axisLine={false} tickLine={false} interval="preserveStartEnd" height={20} tickMargin={4} />
                    <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: chartColors.tick, fontSize: '0.625rem' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: '0.75rem' }}
                      labelStyle={{ color: chartColors.label }}
                      itemStyle={{ color: chartColors.item }}
                    />
                    <Line type="monotone" dataKey="severity" stroke={chartColors.line} strokeWidth={2} dot={{ r: 3, fill: chartColors.line }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </InsightSection>
          )}

          {/* Area frequency heatmap */}
          {stats.areas.length > 0 && (
            <InsightSection title="Where it hurt"
              info="Attacks that touched each area, not readings — an area counts once per attack no matter how many times it was logged."
            >
              <HeadHeatmap data={stats.areas.map((a) => ({ area: a.area, value: a.count }))} />
            </InsightSection>
          )}

          {/* Trigger / symptom / relief / medication frequency */}
          {/* "In the two days before" — v4 decision A4(ii): a relabel of the
              same `Attack.triggers` data (never a new field), reframed away
              from the causal claim "triggers" makes. Recorded on attack days
              only, so there's no count of days when the same thing happened
              and *no* attack followed — without that denominator the bars
              can't show association, only what was suspected. `stats.triggers`
              already excludes the reserved `NOTHING_UNUSUAL` sentinel
              (`triggerFrequency`, src/utils/stats.ts). */}
          <FreqSection
            title="In the two days before"
            data={stats.triggers}
            color={chartColors.chart4}
            info="What you noted in the two days before each attack — recorded on attack days only, so there's no count of days when the same thing happened and no attack followed. Not something shown to bring one on."
          />
          {/* Symptom/trigger frequency used to reuse the severity-mid/high
              colours (2026-09-02) — the same mismatch `HeadHeatmap`'s own
              comment warns about: severity means *pain intensity* everywhere
              else it appears, and reusing it here for *how often* put two
              different variables behind the same hue. Now chart-3/chart-4,
              the Insights-only categorical palette (A7/decision 12). */}
          <FreqSection title="Symptoms" data={stats.symptoms} color={chartColors.chart3}
            info="Attacks that included each symptom, not readings — one count per attack no matter how many times it was logged."
          />
          <FreqSection title="What you tried"  data={stats.reliefs}  color={chartColors.accent}
            info="Attacks in which each relief was tried at least once. This counts use, not whether it helped."
          />
        </>
      )}
    </div>
  );
}
