import { useState, useCallback, useEffect, useRef } from 'react';
import type { Attack, Snapshot, NotificationConfig } from '../types';
import { scheduleNotification, cancelNotification, nextDelay } from '../utils/notifications';
import { pullAttacks, pushAttacks, deleteAttackRemote } from '../lib/sync';

const KEY = 'hd_attacks';

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
// on sign-in we pull + merge remote data by comparing `updatedAt` per attack
// (last write wins — true concurrent edits to the same attack from two
// devices at once are not a case this app needs to handle well).
export function useAttacks(userId: string | null) {
  const [attacks, setAttacks] = useState<Attack[]>(load);
  const syncedForUser = useRef<string | null>(null);

  const commit = useCallback((next: Attack[]) => {
    persist(next);
    setAttacks(next);
  }, []);

  useEffect(() => {
    if (!userId || syncedForUser.current === userId) return;
    syncedForUser.current = userId;
    (async () => {
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
        if (toPush.length) await pushAttacks(toPush, userId);
      } catch (err) {
        console.error('Attack sync failed:', err);
      }
    })();
  }, [userId, commit]);

  const startAttack = useCallback((
    snapshot: Omit<Snapshot, 'source'>,
    triggers: string[],
    notificationConfig: NotificationConfig,
    end: string | null = null,
  ): Attack => {
    const attack: Attack = {
      id: Date.now(),
      snapshots: [{ ...snapshot, source: 'manual' }],
      end,
      triggers,
      notificationConfig,
      updatedAt: new Date().toISOString(),
    };
    commit([attack, ...attacks]);
    if (notificationConfig.enabled && !end) {
      const delay = notificationConfig.mode === 'adaptive'
        ? 60 * 60 * 1000
        : notificationConfig.fixedIntervalMinutes * 60 * 1000;
      scheduleNotification(attack, delay);
    }
    if (userId) pushAttacks([attack], userId).catch((err) => console.error('Attack sync failed:', err));
    return attack;
  }, [attacks, commit, userId]);

  const addSnapshot = useCallback((
    attackId: number,
    snapshot: Omit<Snapshot, 'source'>,
    source: Snapshot['source'] = 'manual',
  ): Attack => {
    let updated!: Attack;
    const next = attacks.map((a) => {
      if (a.id !== attackId) return a;
      updated = { ...a, snapshots: [...a.snapshots, { ...snapshot, source }], updatedAt: new Date().toISOString() };
      return updated;
    });
    commit(next);
    if (updated && updated.notificationConfig.enabled) {
      scheduleNotification(updated, nextDelay(updated));
    }
    if (updated && userId) pushAttacks([updated], userId).catch((err) => console.error('Attack sync failed:', err));
    return updated;
  }, [attacks, commit, userId]);

  const endAttack = useCallback((attackId: number, time?: string) => {
    const end = time ?? new Date().toISOString();
    let updated: Attack | undefined;
    commit(attacks.map((a) => {
      if (a.id !== attackId) return a;
      updated = { ...a, end, updatedAt: new Date().toISOString() };
      return updated;
    }));
    cancelNotification(attackId);
    if (updated && userId) pushAttacks([updated], userId).catch((err) => console.error('Attack sync failed:', err));
  }, [attacks, commit, userId]);

  const deleteAttack = useCallback((attackId: number) => {
    cancelNotification(attackId);
    commit(attacks.filter((a) => a.id !== attackId));
    if (userId) deleteAttackRemote(attackId).catch((err) => console.error('Attack sync failed:', err));
  }, [attacks, commit, userId]);

  const ongoingAttack = attacks.find((a) => a.end === null) ?? null;

  return { attacks, ongoingAttack, startAttack, addSnapshot, endAttack, deleteAttack };
}
