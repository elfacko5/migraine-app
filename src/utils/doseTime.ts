// When a dose logged in the new-attack wizard was taken (Flow 1, 2026-10-28).
//
// `Snapshot.medication` has no time of its own — a dose's time is the time of
// the reading it sits on, and `medCheckInDelay`, `checkDose`/`lastDoseAt` and
// `followUpReading` all read it from there. So a dose taken at a different
// moment from the attack's start is not a new field: it becomes **its own
// reading**, the same way a timed dose from a voice log already does. Only a
// dose taken at the start stays on the first reading.
//
// **A dose can't precede the attack it treats, or follow its end.** Presets
// outside that window are not offered at all, rather than offered and left to
// produce a nonsensical record; "Pick a time" is bounded the same way, and the
// resolved time is clamped again on save, since the picker is minute-precision
// and the attack's own times are not.

export type DoseMode = 'now' | 'min30' | 'hour_ago' | 'start' | 'manual';

const MIN = 60_000;

/** Minutes before now, for the relative presets. */
const OFFSET_MIN: Partial<Record<DoseMode, number>> = { now: 0, min30: 30, hour_ago: 60 };

/** Tolerance either side of the window: "Just now" on an attack that started
 *  "Just now" is the same moment, read a few seconds apart. */
const SLACK_MS = MIN;

export const DOSE_LABELS: Record<DoseMode, string> = {
  now: 'Just now',
  min30: '30 min ago',
  hour_ago: '1h ago',
  start: 'When it started',
  manual: 'Pick a time',
};

/**
 * The presets that fall inside the attack, in display order. "When it
 * started" is offered only when the start isn't itself "just now" — the two
 * would be the same chip twice. "Pick a time" is always there.
 */
export function doseOptions(startMs: number, endMs: number | null, nowMs: number): DoseMode[] {
  const upper = (endMs ?? nowMs) + SLACK_MS;
  const lower = startMs - SLACK_MS;
  const relative = (['now', 'min30', 'hour_ago'] as const).filter((m) => {
    const t = nowMs - (OFFSET_MIN[m] ?? 0) * MIN;
    return t >= lower && t <= upper;
  });
  const startIsNow = nowMs - startMs < SLACK_MS;
  return [...relative, ...(startIsNow ? [] : (['start'] as const)), 'manual'];
}

/** A chosen mode that the window no longer allows (the start or end was
 *  changed after picking it) falls back to the start — the old behaviour, a
 *  dose on the first reading. */
export function effectiveDoseMode(mode: DoseMode, options: DoseMode[]): DoseMode {
  if (options.includes(mode)) return mode;
  return options.includes('start') ? 'start' : options[0];
}

/** The dose's own time, clamped into [start, end-or-now]. */
export function resolveDoseMs(
  mode: DoseMode,
  manualIso: string,
  startMs: number,
  endMs: number | null,
  nowMs: number,
): number {
  const raw =
    mode === 'start'  ? startMs
    : mode === 'manual' ? new Date(manualIso).getTime()
    : nowMs - (OFFSET_MIN[mode] ?? 0) * MIN;
  const upper = endMs ?? nowMs;
  return Math.min(Math.max(raw, startMs), Math.max(upper, startMs));
}

/** True when the dose sits on the attack's first reading rather than its own. */
export const doseAtStart = (doseMs: number, startMs: number) => Math.abs(doseMs - startMs) < SLACK_MS;
