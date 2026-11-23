import { localInputToIso } from './format';
import { doseOptions, effectiveDoseMode, resolveDoseMs, type DoseMode } from './doseTime';

// Pick-any medication entry with per-dose cards (v4 redesign, 2026-11-23):
// any number of medicines, and any number of doses of one medicine, in a
// single step. No data-model change — `Attack`/`Snapshot` already support
// several readings sharing one timestamp ("two medicines at one moment would
// be two readings at one timestamp"), so this is purely a richer *draft*
// shape that the flow converts to snapshots at submit time (see
// doseEntrySnapshots below and each flow's own submit()).

export interface DoseEntry {
  /** Stable key for list rendering/removal — not persisted. */
  key: string;
  mode: DoseMode;
  /** Local-input form, used only when `mode === 'manual'`. */
  time: string;
  amount: number;
}

export interface SelectedMedication {
  name: string;
  /** Display dose text — "50mg", "2 tablets · 50mg" — same role as
   *  `Snapshot.medication.dose`. */
  dose: string;
  /** At least one once the medicine is selected. */
  doses: DoseEntry[];
}

export function newDoseEntry(mode: DoseMode = 'now'): DoseEntry {
  return { key: crypto.randomUUID(), mode, time: '', amount: 1 };
}

/** A dose entry's own resolved time, clamped into the attack's window —
 *  `effectiveDoseMode` first, so a mode the window no longer allows (the
 *  start/end changed after it was picked) falls back the same way
 *  `DoseTimeCard` already does, rather than resolving to something stale. */
export function doseEntryMs(entry: DoseEntry, startMs: number, endMs: number | null, nowMs: number): number {
  const mode = effectiveDoseMode(entry.mode, doseOptions(startMs, endMs, nowMs));
  const manualIso = entry.time ? localInputToIso(entry.time) : new Date(nowMs).toISOString();
  return resolveDoseMs(mode, manualIso, startMs, endMs, nowMs);
}
