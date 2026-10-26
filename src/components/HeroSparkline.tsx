import type { Attack } from '../types';
import { maxSeverity } from '../utils/stats';

// The ongoing hero's trajectory: one point per reading, oldest first, so the
// question someone opens the app with mid-attack — is it getting better? —
// is answered by a shape rather than by comparing two numbers.
//
// **The y-domain is pinned to 0…10**, the rule the Logs sparkline and the
// widget's line both follow: fitted to its own range, a run of 3→4 draws the
// same slope as 2→9. Readings are spaced evenly, not by timestamp — reminders
// are answered when they are answered, so the gaps say more about the diary
// than about the attack.
//
// **Accent, not the severity ramp**, which is a deliberate difference from the
// Logs row and the widget: the hero sits over artwork, and the headline's own
// detail line already prints the numbers in plain text for the same reason
// (a tinted figure over illustration reads as part of the picture). The end
// dot marks "now". Drawn in rem so it scales with the text-size control.
//
// Rendered only with two or more readings: one point has no trajectory, and
// the caller drops it rather than drawing a lone dot.
export function HeroSparkline({ attack }: { attack: Attack }) {
  const values = attack.snapshots.map(maxSeverity);
  const n = values.length;
  const x = (i: number) => 6 + (i * (200 - 12)) / (n - 1);
  const y = (v: number) => 4 + (1 - v / 10) * 38;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox="0 0 200 48"
      role="img"
      aria-label={`Pain readings so far: ${values.join(', ')}`}
      className="block h-12 w-[12.5rem]"
    >
      <line x1="0" y1="45" x2="200" y2="45" className="stroke-bg-border" strokeWidth="1.5" />
      <path d={d} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r="5" className="fill-accent" />
    </svg>
  );
}
