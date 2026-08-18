import { useState, useCallback, useEffect, useRef } from 'react';
import type { Attack, Snapshot, NotificationConfig, SyncStatus } from '../types';
import { scheduleNotification, cancelNotification, nextDelay } from '../utils/notifications';
import { pullAttacks, pushAttacks, deleteAttackRemote } from '../lib/sync';

const KEY = 'hd_attacks';

export interface SnapshotEntry {
  attackId: number;
  snapshot: Omit<Snapshot, 'source'>;
  source: Snapshot['source'];
  /** Whether this reading should queue the next reminder itself. */
  reschedule: boolean;
}

function load(): Attack[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch { return []; }
}

function persist(attacks: Attack[]) {
  localStorage.setItem(KEY, JSON.stringify(attacks));
}

// localStorage stays the source of truth for reads — it's instant and works
// offline. When signed in, every write also gets pushed to Supabase (best
// effort; a failure there doesn't block or roll back the local write), and
// we pull + merge remote data by comparing `updatedAt` per attack (last
// write wins — true concurrent edits to the same attack from two devices at
// once are not a case this app needs to handle well).
export function useAttacks(userId: string | null) {
  const [attacks, setAttacks] = useState<Attack[]>(load);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const commit = useCallback((next: Attack[]) => {
    persist(next);
    setAttacks(next);
  }, []);

  // Wraps a fire-and-forget remote push so its outcome also feeds the
  // Settings sync indicator, not just the console.
  const trackPush = useCallback((p: Promise<void>) => {
    setSyncStatus('syncing');
    p.then(() => {
      setSyncStatus('synced');
      setLastSyncedAt(new Date().toISOString());
    }).catch((err) => {
      console.error('Attack sync failed:', err);
      setSyncStatus('error');
    });
  }, []);

  const sync = useCallback(async (uid: string) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      const remote = await pullAttacks();
      const local = load();
      const merged = new Map<number, Attack>(local.map((a) => [a.id, a]));
      for (const r of remote) {
        const l = merged.get(r.id);
        if (!l || (r.updatedAt ?? '') > (l.updatedAt ?? '')) merged.set(r.id, r);
      }
      const mergedList = [...merged.values()].sort((a, b) => b.id - a.id);
      commit(mergedList);

      const remoteById = new Map(remote.map((r) => [r.id, r]));
      const toPush = mergedList.filter((a) => {
        const r = remoteById.get(a.id);
        return !r || (a.updatedAt ?? '') > (r.updatedAt ?? '');
      });
      if (toPush.length) await pushAttacks(toPush, uid);
      setSyncStatus('synced');
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      console.error('Attack sync failed:', err);
      setSyncStatus('error');
    } finally {
      syncingRef.current = false;
    }
  }, [commit]);

  // Sync on mount/sign-in, and again whenever the app is foregrounded — iOS
  // often keeps a backgrounded PWA's page alive in memory rather than
  // reloading it when reopened, so re-checking on visibility/focus is the
  // only way it picks up changes made on other devices meanwhile.
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

  const startAttack = useCallback((
    snapshot: Omit<Snapshot, 'source'>,
    triggers: string[],
    notificationConfig: NotificationConfig,
    end: string | null = null,
    wokeWithMigraine = false,
    // Readings that belong to the attack from the moment it's created — a
    // voice log describing doses already taken. They're committed with it
    // rather than added afterwards, because `addSnapshots` maps over the
    // `attacks` of the current render, which can't yet contain this one.
    extraSnapshots: Array<Omit<Snapshot, 'source'>> = [],
  ): Attack => {
    const attack: Attack = {
      id: Date.now(),
      snapshots: ([
        { ...snapshot, source: 'manual' },
        ...extraSnapshots.map((s) => ({ ...s, source: 'manual' })),
      ] as Snapshot[]).sort((a, b) => a.time.localeCompare(b.time)),
      end,
      triggers,
      notificationConfig,
      updatedAt: new Date().toISOString(),
      wokeWithMigraine,
    };
    commit([attack, ...attacks]);
    if (notificationConfig.enabled && !end) {
      const delay = notificationConfig.mode === 'adaptive'
        ? 60 * 60 * 1000
        : notificationConfig.fixedIntervalMinutes * 60 * 1000;
      scheduleNotification(attack, delay);
    }
    if (userId) trackPush(pushAttacks([attack], userId));
    return attack;
  }, [attacks, commit, userId, trackPush]);

  // Applies several readings in one commit. Draining the pending-notification
  // queue can carry more than one "no change" answer — a reminder chain
  // answered repeatedly while the app stayed closed — and calling addSnapshot
  // in a loop would drop all but the last: each call maps over the `attacks`
  // captured in the current render, so the second overwrites the first.
  const addSnapshots = useCallback((entries: SnapshotEntry[]): Attack[] => {
    if (entries.length === 0) return [];
    const updatedAt = new Date().toISOString();
    const touched: Attack[] = [];

    const next = attacks.map((a) => {
      const mine = entries.filter((e) => e.attackId === a.id);
      if (mine.length === 0) return a;
      const updated: Attack = {
        ...a,
        snapshots: [...a.snapshots, ...mine.map((e) => ({ ...e.snapshot, source: e.source }))],
        updatedAt,
      };
      touched.push(updated);
      return updated;
    });
    commit(next);

    for (const attack of touched) {
      // Only an ongoing attack should ever get a future reminder scheduled —
      // this is also reachable for backfilled updates on an already-ended
      // (past-logged) attack, which must never queue a notification.
      if (!attack.notificationConfig.enabled || attack.end) continue;
      // `reschedule: false` means the reminder was already queued by whoever
      // handled the tap — the native handler does it at tap time. Scheduling
      // again here would push it out by however long the app stayed closed.
      if (!entries.some((e) => e.attackId === attack.id && e.reschedule)) continue;
      scheduleNotification(attack, nextDelay(attack));
    }

    if (touched.length && userId) trackPush(pushAttacks(touched, userId));
    return touched;
  }, [attacks, commit, userId, trackPush]);

  const addSnapshot = useCallback((
    attackId: number,
    snapshot: Omit<Snapshot, 'source'>,
    source: Snapshot['source'] = 'manual',
  ): Attack => {
    const [updated] = addSnapshots([{ attackId, snapshot, source, reschedule: true }]);
    return updated;
  }, [addSnapshots]);

  const endAttack = useCallback((attackId: number, time?: string, impact?: Attack['impact']) => {
    const end = time ?? new Date().toISOString();
    let updated: Attack | undefined;
    commit(attacks.map((a) => {
      if (a.id !== attackId) return a;
      // Only written when answered — an unanswered question must not land in
      // the record as "no impact".
      updated = { ...a, end, ...(impact !== undefined ? { impact } : {}), updatedAt: new Date().toISOString() };
      return updated;
    }));
    cancelNotification(attackId);
    if (updated && userId) trackPush(pushAttacks([updated], userId));
  }, [attacks, commit, userId, trackPush]);

  // Sets impact on an attack that has already ended. `endAttack` can only take
  // it at the moment of ending, which made the answer all-or-nothing: miss it
  // in the end dialog and it was unanswerable forever.
  //
  // **This does not break the immutability rule.** What is never rewritten is
  // `snapshots` — the record of what was logged at each moment. `impact` is
  // attack-level metadata *about* the finished episode, and it was already
  // being written after every snapshot existed. So this is not the parked
  // "Edit details" feature; it touches nothing a reading holds.
  //
  // Serves the Today prompt, a late answer from AttackDetail, and — if an
  // "It's over" notification action is ever added — an end that necessarily
  // leaves impact for later.
  const setImpact = useCallback((attackId: number, impact: Attack['impact']) => {
    let updated: Attack | undefined;
    commit(attacks.map((a) => {
      if (a.id !== attackId) return a;
      // Clearing back to unanswered has to *remove* the key, not write 0 — the
      // same rule endAttack follows, and what sync.ts maps null back to. Done
      // with a delete rather than rest-destructuring because the lint config
      // doesn't accept an unused `_`-prefixed binding.
      const next: Attack = { ...a, updatedAt: new Date().toISOString() };
      if (impact === undefined) delete next.impact;
      else next.impact = impact;
      updated = next;
      return updated;
    }));
    if (updated && userId) trackPush(pushAttacks([updated], userId));
  }, [attacks, commit, userId, trackPush]);

  const deleteAttack = useCallback((attackId: number) => {
    cancelNotification(attackId);
    commit(attacks.filter((a) => a.id !== attackId));
    if (userId) trackPush(deleteAttackRemote(attackId));
  }, [attacks, commit, userId, trackPush]);

  const ongoingAttack = attacks.find((a) => a.end === null) ?? null;

  return { attacks, ongoingAttack, startAttack, addSnapshot, addSnapshots, endAttack, setImpact, deleteAttack, syncStatus, lastSyncedAt };
}
