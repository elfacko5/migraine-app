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
  /** Push the local copy up (with `guides` only if it has any). */
  | { kind: 'push-local' }
  /** Nothing to do. */
  | { kind: 'nothing' };

export function mergeMedicationPrefs(local: StoredMedications, remote: RemoteMedications | null): MedicationMerge {
  const remoteItems = remote?.medications ?? null;
  const remoteAt = remote?.medications_updated_at ?? null;

  if (remoteItems && remoteAt && remoteAt > local.updatedAt) {
    const remoteGuides = cleanGuides(remote?.medication_guides);
    return {
      kind: 'adopt-remote',
      stored: {
        items: remoteItems,
        // A remote row written by an older client has no guides. That is "this
        // client did not know about them", not "there are none", so the local
        // ones are kept rather than wiped by a newer-stamped copy.
        guides: Object.keys(remoteGuides).length > 0 ? remoteGuides : local.guides,
        updatedAt: remoteAt,
      },
    };
  }
  if (local.items.length > 0 || remoteItems) return { kind: 'push-local' };
  return { kind: 'nothing' };
}

/**
 * The `medication_guides` value to include in a push, or `undefined` to leave
 * the column out of the upsert entirely. **Empty means omit, never `{}`**:
 * omitting leaves whatever the remote holds untouched, and — the reason it
 * matters now — a push that names the column fails outright on a table that
 * has not had the `alter table` run yet, which would break every medications
 * sync for anyone who updates before running it. Nothing writes guides in 0a,
 * so nothing sends the column.
 */
export function guidesForPush(guides: MedGuides): MedGuides | undefined {
  return Object.keys(guides).length > 0 ? guides : undefined;
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
