import { useState, useCallback } from 'react';
import type { Attack, Snapshot, NotificationConfig } from '../types';
import { scheduleNotification, cancelNotification, nextDelay } from '../utils/notifications';

const KEY = 'hd_attacks';

function load(): Attack[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch { return []; }
}

function persist(attacks: Attack[]) {
  localStorage.setItem(KEY, JSON.stringify(attacks));
}

export function useAttacks() {
  const [attacks, setAttacks] = useState<Attack[]>(load);

  const commit = useCallback((next: Attack[]) => {
    persist(next);
    setAttacks(next);
  }, []);

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
    };
    commit([attack, ...attacks]);
    // Only schedule check-in notifications for ongoing attacks.
    if (notificationConfig.enabled && !end) {
      const delay = notificationConfig.mode === 'adaptive'
        ? 60 * 60 * 1000
        : notificationConfig.fixedIntervalMinutes * 60 * 1000;
      scheduleNotification(attack, delay);
    }
    return attack;
  }, [attacks, commit]);

  const addSnapshot = useCallback((
    attackId: number,
    snapshot: Omit<Snapshot, 'source'>,
    source: Snapshot['source'] = 'manual',
  ): Attack => {
    let updated!: Attack;
    const next = attacks.map((a) => {
      if (a.id !== attackId) return a;
      updated = { ...a, snapshots: [...a.snapshots, { ...snapshot, source }] };
      return updated;
    });
    commit(next);
    if (updated && updated.notificationConfig.enabled) {
      scheduleNotification(updated, nextDelay(updated));
    }
    return updated;
  }, [attacks, commit]);

  const endAttack = useCallback((attackId: number, time?: string) => {
    const end = time ?? new Date().toISOString();
    commit(attacks.map((a) => a.id === attackId ? { ...a, end } : a));
    cancelNotification(attackId);
  }, [attacks, commit]);

  const deleteAttack = useCallback((attackId: number) => {
    cancelNotification(attackId);
    commit(attacks.filter((a) => a.id !== attackId));
  }, [attacks, commit]);

  const ongoingAttack = attacks.find((a) => a.end === null) ?? null;

  return { attacks, ongoingAttack, startAttack, addSnapshot, endAttack, deleteAttack };
}
