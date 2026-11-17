import type { MedGuides, Medication } from '../types';
import { cleanGuides } from './medResolve';

// The medications half of a sync, as a pure function so it can be tested with
// fixtures and no network (0a of the medication flows). `useMedications.sync`
// does the I/O; this decides what it should do.
//
// Whole-list last-write-wins on `updatedAt`, exactly as before — medications
// are editable and deletable, so a union would resurrect removed rows. The one
// addition is `guides`, which travels with the list under the same stamp.

export interface StoredMedications {
  items: Medication[];
  guides: MedGuides;
  updatedAt: string;
}

/** The medications columns of the remote `user_prefs` row. `medication_guides`
 *  is absent on a table that predates it, or a row an older client wrote. */
export interface RemoteMedications {
  medications?: Medication[] | null;
  medications_updated_at?: string | null;
  medication_guides?: unknown;
}

export type MedicationMerge =
  /** The remote copy is newer: store it. */
  | { kind: 'adopt-remote'; stored: StoredMedications }
  /** Push the local copy up. `remoteHadGuides` is whether the remote row last
   *  pulled held any guides: it is what lets an emptied local list be pushed as
   *  an explicit `{}` (see `guidesForPush`). */
  | { kind: 'push-local'; remoteHadGuides: boolean }
  /** Nothing to do. */
  | { kind: 'nothing' };

/** Is this the raw column value an explicit object (including `{}`)? Missing,
 *  null and anything that is not a plain object are "this client did not write
 *  guides", not "there are none". */
const isGuidesObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The guides to take from a newer remote row, or `null` for "keep the local
 * ones whole". Adopted only when the raw value is **a literal empty `{}`** (a
 * clear another device pushed) or **every key in it cleans to a valid number**.
 * Anything else — missing, null, a non-object, or an object with any key that
 * does not clean (a junk value, an unknown key) — is not a trustworthy
 * statement about the guides, and adopting its cleaned remainder could wipe
 * guides that are really set: a guide gone back to the guideline moves a
 * warning later, the direction that must not happen by accident.
 */
function guidesFromRemote(raw: unknown): MedGuides | null {
  if (!isGuidesObject(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length === 0) return {};
  const cleaned = cleanGuides(raw);
  return Object.keys(cleaned).length === keys.length ? cleaned : null;
}

export function mergeMedicationPrefs(local: StoredMedications, remote: RemoteMedications | null): MedicationMerge {
  const remoteItems = remote?.medications ?? null;
  const remoteAt = remote?.medications_updated_at ?? null;
  const rawGuides = remote?.medication_guides;
  const remoteGuides = cleanGuides(rawGuides);
  const adoptedGuides = guidesFromRemote(rawGuides);

  if (remoteItems && remoteAt && remoteAt > local.updatedAt) {
    return {
      kind: 'adopt-remote',
      stored: {
        items: remoteItems,
        // **The raw column decides, not its cleaned value** (see
        // `guidesFromRemote`): missing or null is a row written by an older
        // client or a table that predates the column; a literal `{}` is a clear
        // and is adopted, so a second device does not put its old guides back;
        // an object that does not fully clean keeps the local guides whole.
        guides: adoptedGuides ?? local.guides,
        updatedAt: remoteAt,
      },
    };
  }
  if (local.items.length > 0 || remoteItems) {
    return { kind: 'push-local', remoteHadGuides: Object.keys(remoteGuides).length > 0 };
  }
  return { kind: 'nothing' };
}

/**
 * The `medication_guides` value to include in a push, or `undefined` to leave
 * the column out of the upsert entirely.
 *  - local guides non-empty → send them;
 *  - local guides empty **and the remote row last pulled held guides** → send
 *    an explicit `{}`, the only way a clear reaches the remote (omitting the
 *    column leaves the old values in place);
 *  - otherwise omit: a push that names the column fails outright on a table
 *    that has not had the `alter table` run, which would break every
 *    medications sync. A remote row without the column never holds guides, so
 *    that case never sends one.
 * Decided from the pulled row, not from "what was just cleared", so a clear
 * whose push failed is retried by the next sync.
 */
export function guidesForPush(guides: MedGuides, remoteHadGuides = false): MedGuides | undefined {
  if (Object.keys(guides).length > 0) return guides;
  return remoteHadGuides ? {} : undefined;
}

/** The `user_prefs` row `pushMedications` upserts — separate from the I/O so
 *  the column names and the omit-when-empty rule can be checked without a
 *  client. `medication_guides` is present only when `guides` is. */
export function medicationsUpsertRow(
  items: Medication[],
  updatedAt: string,
  userId: string,
  guides: MedGuides | undefined,
  nowIso: string,
) {
  return {
    user_id: userId,
    medications: items,
    medications_updated_at: updatedAt,
    ...(guides ? { medication_guides: guides } : {}),
    updated_at: nowIso,
  };
}
