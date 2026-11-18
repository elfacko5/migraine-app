import { useState, useCallback, useEffect, useRef } from 'react';
import type { DeletedMedName, MedGuides, Medication, SyncStatus } from '../types';
import { pullUserPrefs, pushMedications } from '../lib/sync';
import { cleanDeleted, cleanGuides, editMakesDuplicate, findDuplicate, formOf, sameMedName, withDeleted, withGuide, withoutDeleted } from '../utils/medResolve';
import { deletedForPush, guidesForPush, mergeMedicationPrefs, type StoredMedications } from '../utils/medPrefsMerge';
import { markM3Done, runM3 } from '../utils/medMigrations';

const KEY = 'hd_medications';

type Stored = StoredMedications;

const EMPTY = (): Stored => ({ items: [], guides: {}, deleted: [], updatedAt: new Date(0).toISOString() });

// A stored object with no `guides` (everything written before 0a) reads as
// `guides: {}` — migration M2, read-time, nothing written back.
function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY();
    return {
      items: parsed.items,
      guides: cleanGuides(parsed.guides),
      deleted: cleanDeleted(parsed.deleted),
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return EMPTY();
  }
}

// M3 (0b): the one-time move of per-medicine limits into guides, applied to
// what was just loaded. Written back with the **same `updatedAt`** — it is a
// migration, not an edit — so it neither wins nor loses a sync merge by being
// run. See `utils/medMigrations.ts` for the rule and the marker.
function migrate(stored: Stored): Stored {
  const r = runM3(stored.items, stored.guides, localStorage);
  if (!r.changed) return stored;
  const next = { ...stored, guides: r.guides };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* the in-memory guides still apply */ }
  return next;
}

function save(items: Medication[], guides: MedGuides, deleted: DeletedMedName[]): Stored {
  const next = { items, guides, deleted, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function useMedications(userId: string | null) {
  const [initial] = useState(() => migrate(load()));
  const [medications, setMedicationsState] = useState<Medication[]>(initial.items);
  // Held and kept in step with the list, and synced with it. Read through
  // `guideFor` by Today and Insights (0b).
  const [guides, setGuidesState] = useState<MedGuides>(initial.guides);
  // Names deleted from the library, synced under the same stamp. Read by the
  // chips, the voice list and the overuse warnings; never removes a dose.
  const [deleted, setDeletedState] = useState<DeletedMedName[]>(initial.deleted ?? []);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);
  // Whether the remote row held guides at the last pull. In memory, one sync
  // run is enough: every sync pulls first, and a push outside a run (a local
  // edit) uses the last run's answer, defaulting to "no" so a clear never sends
  // a `{}` it cannot justify.
  const remoteHadGuidesRef = useRef(false);
  const remoteHadDeletedRef = useRef(false);

  // Wraps a fire-and-forget remote push so its outcome also feeds the Profile
  // sync indicator, not just the console — same contract as useUserPrefs.
  const trackPush = useCallback((p: Promise<void>) => {
    setSyncStatus('syncing');
    p.then(() => {
      setSyncStatus('synced');
      setLastSyncedAt(new Date().toISOString());
    }).catch((err) => {
      console.error('Medications sync failed:', err);
      setSyncStatus('error');
    });
  }, []);

  const commit = useCallback((items: Medication[], nextDeleted: DeletedMedName[] = deleted) => {
    const stored = save(items, guides, nextDeleted);
    setMedicationsState(items);
    setDeletedState(nextDeleted);
    if (!userId) return;
    const sendingDeleted = deletedForPush(stored.deleted ?? [], remoteHadDeletedRef.current);
    trackPush(pushMedications(stored.items, stored.updatedAt, userId, guidesForPush(stored.guides, remoteHadGuidesRef.current), sendingDeleted).then(() => {
      remoteHadDeletedRef.current = !!sendingDeleted && sendingDeleted.length > 0;
    }));
  }, [userId, trackPush, guides, deleted]);

  // Unlike the trigger/symptom/relief lists — which are add-only, so
  // useUserPrefs can merge them with a plain union() — medications are
  // editable and deletable. A union would resurrect every removed row on the
  // next sync, so the whole list is last-write-wins on its own updatedAt:
  // the same rule Attack already uses, applied to the list rather than to
  // each item.
  const sync = useCallback(async (uid: string) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      const remote = await pullUserPrefs();
      // Read fresh from localStorage rather than closing over state — this
      // runs again on every foreground, not just at mount.
      const local = load();
      // The decision is a pure function (utils/medPrefsMerge.ts) so it can be
      // tested without a network.
      const merge = mergeMedicationPrefs(local, remote);
      if (merge.kind === 'adopt-remote') {
        // A library that has just arrived may be the first one this device has
        // seen, so M3 is given its chance here too (it does nothing on an
        // empty library, and sets no marker then).
        // **Not when the remote row wrote the guides itself** (a set, or a
        // deliberate clear to `{}`): M3 is done for this library, and running
        // it would refill a cleared guide from stale per-medicine limits.
        if (merge.guidesFromRemote) markM3Done(localStorage);
        const adopted = merge.guidesFromRemote ? merge.stored : migrate(merge.stored);
        localStorage.setItem(KEY, JSON.stringify(adopted));
        setMedicationsState(adopted.items);
        setGuidesState(adopted.guides);
        setDeletedState(adopted.deleted ?? []);
        remoteHadDeletedRef.current = merge.deletedFromRemote && (adopted.deleted ?? []).length > 0;
        // What the remote row held, not what is kept: when its guides were not
        // adopted (missing, junk) or M3 just wrote some, the remote had none.
        remoteHadGuidesRef.current = merge.guidesFromRemote && Object.keys(adopted.guides).length > 0;
      } else if (merge.kind === 'push-local') {
        remoteHadGuidesRef.current = merge.remoteHadGuides;
        remoteHadDeletedRef.current = merge.remoteHadDeleted;
        const sending = guidesForPush(local.guides, merge.remoteHadGuides);
        const sendingDeleted = deletedForPush(local.deleted ?? [], merge.remoteHadDeleted);
        await pushMedications(local.items, local.updatedAt, uid, sending, sendingDeleted);
        remoteHadGuidesRef.current = !!sending && Object.keys(sending).length > 0;
        remoteHadDeletedRef.current = !!sendingDeleted && sendingDeleted.length > 0;
      }
      setSyncStatus('synced');
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      console.error('Medications sync failed:', err);
      setSyncStatus('error');
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Sync on mount/sign-in and on every foreground — see useAttacks.ts for why
  // a mount-only sync goes stale on iOS.
  useEffect(() => {
    if (!userId) return;
    // this is the sync-on-mount pattern the three data hooks share: `sync()`
    // is a subscription to an external system (Supabase), not derived state,
    // and it has to run on mount *and* on every foreground because iOS keeps
    // a backgrounded PWA's page alive rather than reloading it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync(userId);
    const onVisible = () => { if (document.visibilityState === 'visible') sync(userId); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [userId, sync]);

  /** Adds a medicine. **Refuses an exact duplicate** (same name, form and strength,
   *  `sameMedicine`) and returns false: the wizard checks on step 2, but a sync can
   *  bring in a twin after that (plan, Q4 item 2). */
  const addMedication = useCallback((med: Omit<Medication, 'id' | 'createdAt'>): boolean => {
    if (findDuplicate(med, medications)) return false;
    // A name that was deleted comes back: its past doses resolve to the new
    // entry by name again, and the name leaves the deleted list (item 216).
    commit([...medications, { ...med, id: crypto.randomUUID(), createdAt: new Date().toISOString() }], withoutDeleted(deleted, med.name));
    return true;
  }, [medications, deleted, commit]);

  type Patch = Partial<Omit<Medication, 'id' | 'createdAt'>>;
  /** Several edits as one write, one stamp and one push: two `updateMedication`
   *  calls in a row would each map the list from the same render and the second
   *  would drop the first. */
  /** **Refuses an edit that would make an exact twin** (Q4 item 2, write time:
   *  the form checks while open, but a sync can bring a twin in afterwards) and
   *  returns the entry it would duplicate. An entry that already matched before
   *  the edit does not count, so an existing pair is never trapped. Returns
   *  null when written. */
  const updateMedications = useCallback((updates: { id: string; patch: Patch }[]): Medication | null => {
    const byId = new Map(updates.map((u) => [u.id, u.patch]));
    for (const m of medications) {
      const patch = byId.get(m.id);
      if (!patch) continue;
      const after = { ...m, ...patch };
      const twin = editMakesDuplicate(m, { name: after.name, form: formOf(after), strength: after.strength, dose: after.dose }, medications);
      if (twin) return twin;
    }
    // A rename to a name on the deleted list is a re-add in effect: the name
    // leaves the list, or it would count as deleted again if the entry were
    // ever renamed away.
    let nextDeleted = deleted;
    for (const u of updates) if (u.patch.name) nextDeleted = withoutDeleted(nextDeleted, u.patch.name);
    commit(medications.map((m) => (byId.has(m.id) ? { ...m, ...byId.get(m.id) } : m)), nextDeleted);
    return null;
  }, [medications, deleted, commit]);

  const updateMedication = useCallback((id: string, patch: Patch) => {
    updateMedications([{ id, patch }]);
  }, [updateMedications]);

  /** Removes the medicine from the library, and nothing else: no snapshot is
   *  touched (item 222). Its name goes on the deleted list — unless another
   *  entry of that name is still in the library — so the chips, the voice list
   *  and the overuse warnings stop offering and counting it. */
  const removeMedication = useCallback((id: string) => {
    const gone = medications.find((m) => m.id === id);
    if (!gone) return;
    const rest = medications.filter((m) => m.id !== id);
    const nameStays = rest.some((m) => sameMedName(m.name, gone.name));
    commit(rest, nameStays ? deleted : withDeleted(deleted, gone.name, new Date().toISOString()));
  }, [medications, deleted, commit]);

  /** Sets one type's monthly guide (days), or clears it back to the guideline
   *  when `days` is undefined. Saved and pushed with the list under one stamp,
   *  the same whole-list last-write-wins as an edit to a medicine. */
  const setGuide = useCallback((key: keyof MedGuides, days: number | undefined) => {
    const next = withGuide(guides, key, days);
    // Nothing changed (Done on the number already shown, Clear with nothing
    // set): write and push nothing. A write stamps the whole list, which can
    // overwrite a newer one from another device, and storing the guideline
    // number would turn "the guideline" into "set by you".
    if (JSON.stringify(next) === JSON.stringify(guides)) return;
    const stored = save(medications, next, deleted);
    setGuidesState(next);
    if (!userId) return;
    const sending = guidesForPush(stored.guides, remoteHadGuidesRef.current);
    const sendingDeleted = deletedForPush(stored.deleted ?? [], remoteHadDeletedRef.current);
    trackPush(pushMedications(stored.items, stored.updatedAt, userId, sending, sendingDeleted).then(() => {
      remoteHadGuidesRef.current = !!sending && Object.keys(sending).length > 0;
      remoteHadDeletedRef.current = !!sendingDeleted && sendingDeleted.length > 0;
    }));
  }, [guides, medications, deleted, userId, trackPush]);

  return { medications, guides, deleted, setGuide, addMedication, updateMedication, updateMedications, removeMedication, syncStatus, lastSyncedAt };
}
