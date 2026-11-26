import { useState, useCallback, useEffect, useRef } from 'react';
import { SYNC_NOW_EVENT } from '../utils/syncNow';
import type { Attack, Snapshot, NotificationConfig, SyncStatus } from '../types';
import { scheduleNotification, cancelNotification, nextDelay, medCheckInDelay } from '../utils/notifications';
import { findOngoing } from '../utils/ongoing';
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
    // this is the sync-on-mount pattern the three data hooks share: `sync()`
    // is a subscription to an external system (Supabase), not derived state,
    // and it has to run on mount *and* on every foreground because iOS keeps
    // a backgrounded PWA's page alive rather than reloading it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync(userId);
    const onVisible = () => { if (document.visibilityState === 'visible') sync(userId); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const onRequest = () => sync(userId);
    window.addEventListener(SYNC_NOW_EVENT, onRequest);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener(SYNC_NOW_EVENT, onRequest);
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
    // Same reasoning, same fix, for attack-level metadata a past-attack log
    // can set at creation time: a follow-up `updateAttackDetails(attack.id,
    // ...)` call right after this one would map over this render's own
    // `attacks`, which still doesn't contain the attack just committed here
    // — silently overwriting it back out of existence. Caught on-device
    // (2026-11-23): PastAttackForm's save vanished silently whenever
    // painQuality or endUnknown was set, with nothing in the console.
    endUnknown?: boolean,
    painQuality?: string[],
    // "Woke up without it" with a time: when they woke, an upper bound only
    // — `end` stays a placeholder and `endUnknown` stays set. Only with
    // `endUnknown`; a known end needs no bound.
    wokeAt?: string,
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
      ...(endUnknown ? { endUnknown: true } : {}),
      ...(painQuality && painQuality.length > 0 ? { painQuality } : {}),
      ...(endUnknown && wokeAt ? { wokeAt } : {}),
    };
    commit([attack, ...attacks]);
    if (notificationConfig.enabled && !end) {
      const base = notificationConfig.mode === 'adaptive'
        ? 60 * 60 * 1000
        : notificationConfig.fixedIntervalMinutes * 60 * 1000;
      // A first log can already carry a dose — typed on the medication step,
      // or spoken ("took two tablets an hour ago"), which arrives as its own
      // backdated reading. Either way the check-in is measured from the dose.
      scheduleNotification(attack, medCheckInDelay(attack, base));
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
        // Sorted, not just appended — `mine` can carry a backdated reading
        // (an Update flow entry dated before the attack's own latest one),
        // and everything downstream (the timeline, `followUpReading`'s own
        // scan, "the last snapshot is the current state") assumes the array
        // is in time order the way `startAttack`'s own sort already keeps it.
        snapshots: [...a.snapshots, ...mine.map((e) => ({ ...e.snapshot, source: e.source }))]
          .sort((x, y) => x.time.localeCompare(y.time)),
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

  // `endUnknown` is for "gone when you woke up" with no time added: `end`
  // still gets a real timestamp (so the attack reads as ended everywhere),
  // but the flag says that timestamp is a placeholder, not a fact — every
  // duration figure must check it (`hasKnownDuration` in stats.ts) before
  // treating `end` as trustworthy.
  const endAttack = useCallback((
    attackId: number,
    time?: string,
    impact?: Attack['impact'],
    endUnknown = false,
    // The End flow's own dose-outcome readings and closing "what was it
    // like" snapshot, plus the two-days-before/felt-like attack metadata it
    // can set at the same moment — written in this same commit for the same
    // reason `startAttack`'s own trailing params are (see its comment): a
    // follow-up `addSnapshots`/`updateAttackDetails` call right after this
    // one would map over this render's own `attacks`, which still doesn't
    // reflect the end just committed here.
    extraSnapshots: Array<Omit<Snapshot, 'source'>> = [],
    triggers?: string[],
    painQuality?: string[],
  ) => {
    const end = time ?? new Date().toISOString();
    let updated: Attack | undefined;
    commit(attacks.map((a) => {
      if (a.id !== attackId) return a;
      // Only written when answered — an unanswered question must not land in
      // the record as "no impact".
      updated = {
        ...a,
        ...(extraSnapshots.length ? {
          snapshots: [...a.snapshots, ...extraSnapshots.map((s) => ({ ...s, source: 'manual' as const }))]
            .sort((x, y) => x.time.localeCompare(y.time)),
        } : {}),
        end, endUnknown,
        ...(impact !== undefined ? { impact } : {}),
        ...(triggers !== undefined ? { triggers } : {}),
        // `!== undefined`, not "only when non-empty" — unlike `startAttack`'s
        // own painQuality param (a brand-new attack has nothing to clear),
        // `EndAttackForm` seeds this field from the attack's existing value
        // and lets it edit down to nothing, same as `triggers` just above.
        // Writing only non-empty arrays would make an attack that already
        // had pain quality un-clearable from this flow.
        ...(painQuality !== undefined ? { painQuality } : {}),
        updatedAt: new Date().toISOString(),
      };
      return updated;
    }));
    cancelNotification(attackId);
    if (updated && userId) trackPush(pushAttacks([updated], userId));
  }, [attacks, commit, userId, trackPush]);

  /**
   * Attack-level metadata on an existing record — the "Edit details" path.
   *
   * Deliberately narrow, and the narrowness is the point (see
   * docs/editing-assessment.md). It cannot reach `snapshots`: those are the
   * record of what was reported at the time, and correcting one is a separate,
   * larger job that has to leave a visible trace. This only touches fields
   * that describe the episode as a whole, which `endAttack` already rewrites
   * today.
   *
   * `impact` is **not** in the patch type on purpose. It is asked once, live,
   * as a step of `EndAttackForm`, and left permanently unanswered otherwise —
   * an answer reconstructed later is the recall bias a prospective diary
   * exists to avoid, and a badly remembered level counts in the disability
   * figures where an absent one does not. Adding it here would quietly undo
   * that decision. `endAttack` remains the only writer.
   *
   * `painQuality` and `confirmedReal` (added with the v4 redesign) are stable
   * metadata by the same test impact fails — nothing about them decays with
   * recall the way "how much did this stop you" does — so they belong here.
   *
   * `endUnknown` is in the patch type for the rare case something needs to
   * set it directly (mirrors `endAttack`'s own param). But a caller patching
   * `end` without saying anything about `endUnknown` almost always means
   * "now the time is known" — Detail's existing end-time editor is exactly
   * this case — so that's the default here: giving a real `end` clears the
   * flag unless the patch says otherwise. Otherwise an attack that was never
   * re-opened to say so would stay excluded from duration figures forever
   * after its time was filled in.
   */
  const updateAttackDetails = useCallback((
    attackId: number,
    patch: Partial<Pick<Attack, 'triggers' | 'wokeWithMigraine' | 'end' | 'endUnknown' | 'painQuality' | 'confirmedReal' | 'wokeAt'>>,
  ) => {
    const fullPatch = patch.end !== undefined && !('endUnknown' in patch)
      ? { ...patch, endUnknown: false }
      : patch;
    let updated: Attack | undefined;
    commit(attacks.map((a) => {
      if (a.id !== attackId) return a;
      updated = { ...a, ...fullPatch, updatedAt: new Date().toISOString() };
      return updated;
    }));
    if (updated && userId) trackPush(pushAttacks([updated], userId));
  }, [attacks, commit, userId, trackPush]);

  /**
   * Symptoms or reliefs remembered after an attack ended. **Appended, never
   * written into an existing reading** — snapshots stay the record of what was
   * reported when — as a reading with no pain areas, stamped at the attack's
   * end and marked `addedLater`. Not `addSnapshot`: there is nothing to
   * remind about, and no reading of pain to carry.
   */
  const addLaterDetails = useCallback((
    attackId: number,
    details: { symptoms: string[]; reliefs: string[] },
  ) => {
    if (details.symptoms.length === 0 && details.reliefs.length === 0) return;
    let updated: Attack | undefined;
    commit(attacks.map((a) => {
      if (a.id !== attackId || !a.end) return a;
      const added: Snapshot = {
        time: new Date(a.end).toISOString(), areas: {}, symptoms: details.symptoms, reliefs: details.reliefs,
        medication: null, note: null, source: 'manual', addedLater: true,
      };
      updated = {
        ...a,
        snapshots: [...a.snapshots, added].sort((x, y) => x.time.localeCompare(y.time)),
        updatedAt: new Date().toISOString(),
      };
      return updated;
    }));
    if (updated && userId) trackPush(pushAttacks([updated], userId));
  }, [attacks, commit, userId, trackPush]);

  const deleteAttack = useCallback((attackId: number) => {
    cancelNotification(attackId);
    commit(attacks.filter((a) => a.id !== attackId));
    if (userId) trackPush(deleteAttackRemote(attackId));
  }, [attacks, commit, userId, trackPush]);

  const ongoingAttack = findOngoing(attacks);

  return { attacks, ongoingAttack, startAttack, addSnapshot, addSnapshots, endAttack, updateAttackDetails, addLaterDetails, deleteAttack, syncStatus, lastSyncedAt };
}
