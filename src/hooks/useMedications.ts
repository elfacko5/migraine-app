import { useState, useCallback, useEffect, useRef } from 'react';
import type { MedGuides, Medication, SyncStatus } from '../types';
import { pullUserPrefs, pushMedications } from '../lib/sync';
import { cleanGuides } from '../utils/medResolve';
import { guidesForPush, mergeMedicationPrefs, type StoredMedications } from '../utils/medPrefsMerge';

const KEY = 'hd_medications';

type Stored = StoredMedications;

const EMPTY = (): Stored => ({ items: [], guides: {}, updatedAt: new Date(0).toISOString() });

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
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return EMPTY();
  }
}

function save(items: Medication[], guides: MedGuides): Stored {
  const next = { items, guides, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function useMedications(userId: string | null) {
  const [initial] = useState(load);
  const [medications, setMedicationsState] = useState<Medication[]>(initial.items);
  // Held and kept in step with the list, and synced with it, but read by
  // nothing yet: `guideFor` and its callers arrive in 0b.
  const [guides, setGuidesState] = useState<MedGuides>(initial.guides);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

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

  const commit = useCallback((items: Medication[]) => {
    const stored = save(items, guides);
    setMedicationsState(items);
    if (userId) trackPush(pushMedications(stored.items, stored.updatedAt, userId, guidesForPush(stored.guides)));
  }, [userId, trackPush, guides]);

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
        localStorage.setItem(KEY, JSON.stringify(merge.stored));
        setMedicationsState(merge.stored.items);
        setGuidesState(merge.stored.guides);
      } else if (merge.kind === 'push-local') {
        await pushMedications(local.items, local.updatedAt, uid, guidesForPush(local.guides));
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

  const addMedication = useCallback((med: Omit<Medication, 'id' | 'createdAt'>) => {
    commit([...medications, { ...med, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, [medications, commit]);

  const updateMedication = useCallback((id: string, patch: Partial<Omit<Medication, 'id' | 'createdAt'>>) => {
    commit(medications.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, [medications, commit]);

  const removeMedication = useCallback((id: string) => {
    commit(medications.filter((m) => m.id !== id));
  }, [medications, commit]);

  return { medications, guides, addMedication, updateMedication, removeMedication, syncStatus, lastSyncedAt };
}
