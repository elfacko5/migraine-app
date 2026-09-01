import { Capacitor } from '@capacitor/core';
import { LiddWidget } from './liddWidgetPlugin';
import type { Attack, Medication } from '../types';
import { attackLatestSeverity, attackMaxSeverity, maxSeverity } from './stats';
import { isRetired } from './retired';
import { DAY_MS, checkDose, doseUnits, findMedication, lastDoseSnapshot } from './medGuardrails';

// What the home-screen widget reads.
//
// A widget extension is a separate process: it cannot reach `localStorage`,
// and it must not try to. This is the same wall the Siri intent and the
// notification handler already hit, and the answer is the same one — a flat
// payload handed across, built by the web layer which is the only thing that
// can read the diary.
//
// It is deliberately a **snapshot, not the data**. The widget never sees
// `hd_attacks` and never derives anything: every figure it draws is computed
// here, by the same functions Today uses, so the two can't drift into
// disagreeing about the same attack. That is the `sevFill`/impact-labels rule
// applied across a process boundary, where drift would be far harder to spot —
// nothing about a wrong widget shows up while you are looking at the app.
//
// **The handoff is not `@capacitor/preferences`**, unlike the two existing
// ones. Preferences writes to `UserDefaults.standard`, which a widget in its
// own process cannot see; sharing needs an App Group suite, and the plugin's
// `configure({ group })` switches the store *globally* — which would move
// `pendingNotificationActions` and `pendingVoiceEntry` out from under the
// hardcoded `CapacitorStorage.` paths in `NotificationActionHandler.swift` and
// `LogMigraineIntent.swift` and silently break both. So this one key travels
// through its own tiny native plugin, which also asks WidgetKit to reload —
// the write and the redraw being one call is what stops a stale widget after a
// successful write.

/** Bumped whenever the shape changes. The widget refuses a version it doesn't
 *  know rather than reading fields it may no longer understand — an app update
 *  and an extension update are installed together, but a widget's timeline can
 *  outlive both by minutes.
 *
 *  2 — `readings` (a count) became `series` (the readings themselves), for the
 *  ongoing state's trajectory sparkline. */
export const WIDGET_SNAPSHOT_VERSION = 2;

export interface WidgetDosePosition {
  name: string;
  /** ISO — when the last dose of this drug was taken. */
  takenAt: string;
  /**
   * Every logged dose of this drug inside the rolling 24h, with its units
   * already resolved — the widget sums what is still in the window and
   * nothing more.
   *
   * The count is handed over as events rather than as a total because the
   * total decays on its own: a dose ages out of the window while the app is
   * closed, and a widget holding a frozen number would over-report exactly
   * when it matters. Summing is arithmetic the extension can safely own;
   * *resolving* units is not, so `doseUnits`' deliberately narrow parse and
   * the retired-entry filter both stay on this side of the boundary. It also
   * lets the widget put a timeline entry at each expiry and be right in
   * between refreshes.
   */
  windowDoses: { at: string; units: number }[];
  /** The user's own `maxPerDay`, or null when they entered none. Never a
   *  guideline number: the widget states a limit only when it was given one. */
  maxPerDay: number | null;
  /** ISO, when a minimum gap was entered and has not yet elapsed. */
  nextAllowedAt: string | null;
}

export interface WidgetSnapshot {
  v: number;
  /** When this payload was built — not when the widget drew it. */
  updatedAt: string;
  ongoing: {
    id: number;
    startedAt: string;
    /** Where it is now, and the worst it has been: the same pair the Today
     *  hero shows, for the same reason — a live card must never announce a
     *  severity in the present tense that the attack has already left. */
    severityNow: number;
    severityPeak: number;
    /**
     * Every reading in the attack, oldest first, as the same figure the Logs
     * sparkline plots — each snapshot's own maximum severity.
     *
     * This is the one place the payload carries a series rather than a
     * finished figure, and it is what the widget's trajectory line is drawn
     * from: whether an attack is climbing or easing off is the thing two
     * numbers cannot say, and it is most of what someone glancing at a home
     * screen wants to know. The **severity of each reading is still computed
     * here** — `maxSeverity` is the app's definition of "how bad was it then",
     * and the extension only positions what it is given.
     *
     * It replaced a plain count in v2. The count is `series.length`, so
     * nothing was lost — but a count could not be derived back into this,
     * which is why the field is worth its size.
     */
    series: { at: string; severity: number }[];
  } | null;
  /** ISO end of the most recently *ended* attack, for the "14 days" figure.
   *  Null when an attack is ongoing or nothing has ever been logged. */
  lastEndedAt: string | null;
  /** False only on a genuinely empty diary. Without it the widget cannot tell
   *  a first run from a gap it has no end date for, and would render "0 days
   *  since your last attack" at someone who has never had one. */
  hasAnyAttack: boolean;
  /**
   * The running position for the last drug taken — **only while an attack is
   * ongoing**, which is the rule Today already applies to this row. Off an
   * attack it is a fact about the past, and the widget carries only what bears
   * on the next hour.
   */
  dose: WidgetDosePosition | null;
}

/**
 * Every logged dose of one drug inside the rolling 24h ending at `nowMs`,
 * oldest first. Mirrors `unitsInWindow`'s window and its exclusions — the
 * same doses, itemised instead of totalled.
 */
function dosesInWindow(attacks: Attack[], name: string, nowMs: number): { at: string; units: number }[] {
  const wanted = name.trim().toLowerCase();
  if (!wanted || isRetired(wanted)) return [];
  const from = nowMs - DAY_MS;
  const out: { at: string; units: number }[] = [];
  for (const attack of attacks) {
    for (const snap of attack.snapshots) {
      const med = snap.medication;
      if (!med?.name || med.name.trim().toLowerCase() !== wanted) continue;
      const at = new Date(snap.time).getTime();
      if (at <= from || at > nowMs) continue;
      out.push({ at: snap.time, units: doseUnits(med) });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Builds the payload. Pure apart from the clock, which it reads itself — the
 * rule the medication guardrails already follow, so no component computes
 * `Date.now()` during a render to call this.
 */
export function buildWidgetSnapshot(
  attacks: Attack[],
  medications: Medication[],
  nowMs: number = Date.now(),
): WidgetSnapshot {
  const ongoing = attacks.find((a) => !a.end) ?? null;

  // The latest *ended* attack by end time, which is what "since your last
  // attack" means. Not the latest by start: a long attack logged
  // retrospectively can start before a short one and end after it.
  let lastEndedAt: string | null = null;
  for (const attack of attacks) {
    if (!attack.end) continue;
    if (!lastEndedAt || attack.end > lastEndedAt) lastEndedAt = attack.end;
  }

  const lastDose = ongoing ? lastDoseSnapshot(ongoing) : null;
  const doseName = lastDose?.medication?.name ?? '';
  const library = findMedication(medications, doseName);
  // Asked with zero further units, exactly as Today asks it: this reports
  // where the *last* dose left things, rather than pre-judging a dose nobody
  // has said they are taking.
  const position = lastDose ? checkDose(library, attacks, doseName, 0, new Date(nowMs).toISOString()) : null;

  return {
    v: WIDGET_SNAPSHOT_VERSION,
    updatedAt: new Date(nowMs).toISOString(),
    ongoing: ongoing
      ? {
          id: ongoing.id,
          startedAt: ongoing.snapshots[0].time,
          severityNow: attackLatestSeverity(ongoing),
          severityPeak: attackMaxSeverity(ongoing),
          series: ongoing.snapshots.map((snap) => ({ at: snap.time, severity: maxSeverity(snap) })),
        }
      : null,
    lastEndedAt: ongoing ? null : lastEndedAt,
    hasAnyAttack: attacks.length > 0,
    dose: lastDose?.medication
      ? {
          name: lastDose.medication.name,
          takenAt: lastDose.time,
          windowDoses: dosesInWindow(attacks, doseName, nowMs),
          maxPerDay: library?.maxPerDay ?? null,
          // Only while it hasn't elapsed — a gap that has passed is not a fact
          // the widget has any use for.
          nextAllowedAt: position?.tooSoon ? position.nextAllowedAt : null,
        }
      : null,
  };
}

/**
 * Hands the payload to the widget. A no-op on web, where there is no widget
 * and `registerPlugin` would throw "not implemented" on the first call.
 *
 * Failures are logged and swallowed, like every other push in the app: a
 * widget that is one write behind is a far smaller problem than a save that
 * fails because the widget could not be told about it.
 */
export async function publishWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LiddWidget.publish({ value: JSON.stringify(snapshot) });
  } catch (err) {
    console.error('Failed to publish widget snapshot:', err);
  }
}
