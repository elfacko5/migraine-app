import { useState, useCallback, useEffect, useRef } from 'react';
import type { Hit6Entry, SyncStatus } from '../types';
import { pullUserPrefs, pushHit6 } from '../lib/sync';
import { hit6Score } from '../utils/hit6';

const KEY = 'hd_hit6';

interface Stored {
  items: Hit6Entry[];
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

function save(items: Hit6Entry[]): Stored {
  const next = { items, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/**
 * Completed HIT-6 questionnaires, oldest first.
 *
 * Merge strategy is medications' rather than the trigger lists': whole-list
 * last-write-wins on its own `updatedAt`. Entries are only ever appended
 * today, so a union would in fact behave — but the list is the kind of thing
 * a wrong answer will eventually want deleting from, and a union would
 * resurrect it on the next sync. Matching useMedications now costs nothing and
 * means delete works whenever it arrives.
 */
export function useHit6(userId: string | null) {
  const [entries, setEntries] = useState<Hit6Entry[]>(() => load().items);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const trackPush = useCallback((p: Promise<void>) => {
    setSyncStatus('syncing');
    p.then(() => {
      setSyncStatus('synced');
      setLastSyncedAt(new Date().toISOString());
    }).catch((err) => {
      console.error('HIT-6 sync failed:', err);
      setSyncStatus('error');
    });
  }, []);

  const commit = useCallback((items: Hit6Entry[]) => {
    const stored = save(items);
    setEntries(items);
    if (userId) trackPush(pushHit6(stored.items, stored.updatedAt, userId));
  }, [userId, trackPush]);

  const sync = useCallback(async (uid: string) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      const remote = await pullUserPrefs();
      const local = load();
      const remoteItems = remote?.hit6 ?? null;
      const remoteAt = remote?.hit6_updated_at ?? null;

      if (remoteItems && remoteAt && remoteAt > local.updatedAt) {
        localStorage.setItem(KEY, JSON.stringify({ items: remoteItems, updatedAt: remoteAt }));
        setEntries(remoteItems);
      } else if (local.items.length > 0 || remoteItems) {
        await pushHit6(local.items, local.updatedAt, uid);
      }
      setSyncStatus('synced');
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      console.error('HIT-6 sync failed:', err);
      setSyncStatus('error');
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    // Sync on mount *and* every foreground — see useAttacks.ts for why a
    // mount-only sync goes stale on iOS.
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

  const addHit6 = useCallback((answers: number[]) => {
    const entry: Hit6Entry = {
      id: crypto.randomUUID(),
      takenAt: new Date().toISOString(),
      answers,
      score: hit6Score(answers),
    };
    commit([...entries, entry]);
    return entry;
  }, [entries, commit]);

  const removeHit6 = useCallback((id: string) => {
    commit(entries.filter((e) => e.id !== id));
  }, [entries, commit]);

  return { hit6Entries: entries, addHit6, removeHit6, syncStatus, lastSyncedAt };
}
