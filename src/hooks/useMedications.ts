import { useState, useCallback, useEffect, useRef } from 'react';
import type { Medication, SyncStatus } from '../types';
import { pullUserPrefs, pushMedications } from '../lib/sync';

const KEY = 'hd_medications';

interface Stored {
  items: Medication[];
  updatedAt: string;
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [], updatedAt: new Date(0).toISOString() };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [], updatedAt: new Date(0).toISOString() };
    return { items: parsed.items, updatedAt: parsed.updatedAt ?? new Date(0).toISOString() };
  } catch {
    return { items: [], updatedAt: new Date(0).toISOString() };
  }
}

function save(items: Medication[]): Stored {
  const next = { items, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function useMedications(userId: string | null) {
  const [medications, setMedicationsState] = useState<Medication[]>(() => load().items);
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
    const stored = save(items);
    setMedicationsState(items);
    if (userId) trackPush(pushMedications(stored.items, stored.updatedAt, userId));
  }, [userId, trackPush]);

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
      const remoteItems = remote?.medications ?? null;
      const remoteAt = remote?.medications_updated_at ?? null;

      if (remoteItems && remoteAt && remoteAt > local.updatedAt) {
        localStorage.setItem(KEY, JSON.stringify({ items: remoteItems, updatedAt: remoteAt }));
        setMedicationsState(remoteItems);
      } else if (local.items.length > 0 || remoteItems) {
        await pushMedications(local.items, local.updatedAt, uid);
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

  return { medications, addMedication, updateMedication, removeMedication, syncStatus, lastSyncedAt };
}
