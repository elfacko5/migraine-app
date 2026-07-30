import { useState, useEffect, useMemo } from 'react';
import type { Tab, Attack, Snapshot } from './types';
import { useAttacks } from './hooks/useAttacks';
import { useUserPrefs } from './hooks/useUserPrefs';
import { useNotifications } from './hooks/useNotifications';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { useViewportHeight } from './hooks/useViewportHeight';
import { triggerFrequency, symptomFrequency, reliefFrequency, sortByFrequency } from './utils/stats';
import { BottomNav } from './components/BottomNav';
import { TopBar } from './components/TopBar';
import { Sheet } from './components/Sheet';
import { EndAttackDialog } from './components/EndAttackDialog';

const TAB_TITLES: Record<Tab, string> = {
  log: 'Migraine Tracker',
  history: 'Logs',
  stats: 'Insights',
  settings: 'Settings',
};
import { LogForm } from './components/LogForm';
import { QuickUpdateForm } from './components/QuickUpdateForm';
import { OngoingAttackBanner } from './components/OngoingAttackBanner';
import { AttackFreeCard } from './components/AttackFreeCard';
import { AttackDetail } from './components/AttackDetail';
import { StatsView } from './components/StatsView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { TextScalePill } from './components/TextScalePill';
import { BrightnessOverlay } from './components/BrightnessOverlay';
import { ViewportDebug } from './components/ViewportDebug';

export default function App() {
  useViewportHeight();
  const [tab, setTab] = useState<Tab>('log');
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  // The attack an "Add update" sheet targets — the ongoing one (via the FAB
  // or its Today-tab banner) or any past attack (via its detail sheet).
  // Looked up fresh from `attacks` by id rather than stashing the object, so
  // it always reflects the latest snapshots even if this stays open a while.
  const [updateAttackId, setUpdateAttackId] = useState<number | null>(null);
  const [detailAttack, setDetailAttack] = useState<Attack | null>(null);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const {
    attacks, ongoingAttack, startAttack, addSnapshot, endAttack, deleteAttack,
    syncStatus: attacksSyncStatus, lastSyncedAt: attacksLastSyncedAt,
  } = useAttacks(userId);
  const {
    triggers, symptoms, reliefs, addTrigger, addSymptom, addRelief, defaultNotifConfig,
    syncStatus: prefsSyncStatus, lastSyncedAt: prefsLastSyncedAt,
  } = useUserPrefs(userId);
  const { shouldPrompt, requestPermission } = useNotifications();
  const { textScale, setTextScale, brightness, setBrightness } = useSettings();

  // Combine the two independent sync hooks into one status for Settings:
  // an error in either takes priority, then in-flight, then the more
  // recent successful sync of the two.
  const syncStatus = useMemo(() => {
    if (attacksSyncStatus === 'error' || prefsSyncStatus === 'error') return 'error' as const;
    if (attacksSyncStatus === 'syncing' || prefsSyncStatus === 'syncing') return 'syncing' as const;
    if (attacksLastSyncedAt || prefsLastSyncedAt) return 'synced' as const;
    return 'idle' as const;
  }, [attacksSyncStatus, prefsSyncStatus, attacksLastSyncedAt, prefsLastSyncedAt]);
  const lastSyncedAt = useMemo(() => {
    if (attacksLastSyncedAt && prefsLastSyncedAt) return attacksLastSyncedAt > prefsLastSyncedAt ? attacksLastSyncedAt : prefsLastSyncedAt;
    return attacksLastSyncedAt ?? prefsLastSyncedAt;
  }, [attacksLastSyncedAt, prefsLastSyncedAt]);

  // Collect unique medications from history, most-recently-used first.
  const recentMeds = useMemo(() => {
    const seen = new Map<string, string>();
    for (const attack of attacks) {
      for (const snap of [...attack.snapshots].reverse()) {
        const name = snap.medication?.name?.trim();
        if (name && !seen.has(name)) {
          seen.set(name, snap.medication!.dose);
        }
      }
    }
    return Array.from(seen.entries()).map(([name, dose]) => ({ name, dose }));
  }, [attacks]);

  // Most recent attack end (ISO strings compare chronologically) — for the
  // "attack-free" card shown when nothing is ongoing.
  const lastAttackEnd = useMemo(() => {
    const ends = attacks.map((a) => a.end).filter((e): e is string => !!e);
    return ends.length ? ends.reduce((max, e) => (e > max ? e : max)) : null;
  }, [attacks]);

  // Order the pickers' options by how often they've been selected historically,
  // so the most-used surface at the top.
  const sortedTriggers = useMemo(() => sortByFrequency(triggers, triggerFrequency(attacks)), [triggers, attacks]);
  const sortedSymptoms = useMemo(() => sortByFrequency(symptoms, symptomFrequency(attacks)), [symptoms, attacks]);
  const sortedReliefs = useMemo(() => sortByFrequency(reliefs, reliefFrequency(attacks)), [reliefs, attacks]);

  const updateAttack = attacks.find((a) => a.id === updateAttackId) ?? null;

  // Handle SW notification action messages.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { type, action, attackId } = e.data ?? {};
      if (type !== 'NOTIFICATION_ACTION') return;
      const attack = attacks.find((a) => a.id === attackId);
      if (!attack) return;
      if (action === 'no_change') {
        const prev = attack.snapshots[attack.snapshots.length - 1];
        addSnapshot(attackId, { time: new Date().toISOString(), areas: { ...prev.areas }, symptoms: [...prev.symptoms], reliefs: [...(prev.reliefs ?? [])], medication: null, note: null }, 'notification_no_change');
      } else if (action === 'update') {
        setUpdateAttackId(attackId);
        setTab('log');
      } else if (action === 'snooze') {
        // Snooze is handled in the SW; no client action needed.
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [attacks, addSnapshot]);

  function handleLogSave(snapshot: Omit<Snapshot, 'source'>, triggersSel: string[], notifConfig: typeof defaultNotifConfig, end: string | null, wokeWithMigraine: boolean) {
    startAttack(snapshot, triggersSel, notifConfig, end, wokeWithMigraine);
    setLogSheetOpen(false);
    if (notifConfig.enabled && !end && shouldPrompt) requestPermission();
  }

  function handleUpdateSave(snapshot: Omit<Snapshot, 'source'>) {
    if (updateAttackId !== null) addSnapshot(updateAttackId, snapshot);
    setUpdateAttackId(null);
  }

  // "Nothing changed" only applies to an ongoing attack — a past attack has
  // no "right now" to log against, so QuickUpdateForm doesn't offer this
  // option once attack.end is set.
  function handleNoChange() {
    if (!updateAttack || updateAttack.end) return;
    const prev = updateAttack.snapshots[updateAttack.snapshots.length - 1];
    addSnapshot(updateAttack.id, { time: new Date().toISOString(), areas: { ...prev.areas }, symptoms: [...prev.symptoms], reliefs: [...(prev.reliefs ?? [])], medication: null, note: null }, 'notification_no_change');
    setUpdateAttackId(null);
  }

  return (
    <div
      // `relative` + an explicit height from --app-height (rather than
      // min-h-dvh + letting the page itself scroll) makes this div a fixed,
      // never-scrolling box: the containing block every `absolute`-positioned
      // overlay below (BottomNav, the floating pills, Sheet) anchors against.
      // Confirmed via live Safari Web Inspector testing on-device: after a
      // cold PWA relaunch, WebKit doesn't just miscalculate `position: fixed`
      // — it hard-clips fixed-position content to its own broken, short
      // native viewport (icons showed, labels below them didn't, no matter
      // what top/bottom values were used). Only escaping `position: fixed`
      // entirely — anchoring to this correctly-sized non-scrolling root
      // instead — actually renders past that clip.
      className="relative overflow-hidden bg-bg-base"
      style={{ height: 'var(--app-height, 100dvh)' }}
    >
      <ViewportDebug />
      <BrightnessOverlay brightness={brightness} onOpenSettings={() => setTab('settings')} />

      <TopBar title={TAB_TITLES[tab]} />

      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pt-5 pb-28 sm:px-6">
        {/* ── Today tab ───────────────────────────── */}
        {tab === 'log' && (
          <section className="space-y-4">
            {ongoingAttack && (
              <OngoingAttackBanner
                attack={ongoingAttack}
                onAddUpdate={() => setUpdateAttackId(ongoingAttack.id)}
                onEnd={() => setEndConfirmOpen(true)}
                onOpenDetail={() => setDetailAttack(ongoingAttack)}
              />
            )}

            {!ongoingAttack && lastAttackEnd && (
              <AttackFreeCard lastEnd={lastAttackEnd} onStart={() => setLogSheetOpen(true)} />
            )}

            {!ongoingAttack && !lastAttackEnd && (
              <div className="rounded-xl border border-dashed border-bg-border p-10 text-center space-y-2">
                <p className="text-text-secondary text-sm">No attacks logged yet.</p>
                <button
                  type="button"
                  onClick={() => setLogSheetOpen(true)}
                  className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
                >
                  Start logging
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Logs tab ─────────────────────────────── */}
        {tab === 'history' && (
          <section className="space-y-4">
            <HistoryView attacks={attacks} onAttackClick={(a) => setDetailAttack(a)} />
          </section>
        )}

        {/* ── Insights tab ─────────────────────────── */}
        {tab === 'stats' && (
          <section className="space-y-4">
            <StatsView attacks={attacks} />
          </section>
        )}

        {/* ── Settings tab ─────────────────────────── */}
        {tab === 'settings' && (
          <section className="space-y-4">
            <SettingsView
              textScale={textScale}
              onTextScale={setTextScale}
              brightness={brightness}
              onBrightness={setBrightness}
              auth={auth}
              syncStatus={syncStatus}
              lastSyncedAt={lastSyncedAt}
            />
          </section>
        )}
        </div>
      </div>

      <TextScalePill scale={textScale} onScale={setTextScale} />
      {/* FAB opens Add-update when an attack is already ongoing — you can't
          start a second one until the current attack ends. */}
      <BottomNav
        active={tab}
        onChange={setTab}
        onAdd={() => (ongoingAttack ? setUpdateAttackId(ongoingAttack.id) : setLogSheetOpen(true))}
      />

      {/* Log attack sheet */}
      <Sheet
        open={logSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        title="Log an attack"
        flush
        bareHeader
      >
        <LogForm
          triggers={sortedTriggers}
          symptoms={sortedSymptoms}
          reliefs={sortedReliefs}
          defaultNotifConfig={defaultNotifConfig}
          recentMeds={recentMeds}
          textScale={textScale}
          onTextScale={setTextScale}
          onAddTrigger={addTrigger}
          onAddSymptom={addSymptom}
          onAddRelief={addRelief}
          onClose={() => setLogSheetOpen(false)}
          onSave={handleLogSave}
        />
      </Sheet>

      {/* Quick update sheet — targets the ongoing attack (FAB/banner) or any
          past attack (its own detail sheet's "Add update") */}
      {updateAttack && (
        <Sheet open={!!updateAttackId} onClose={() => setUpdateAttackId(null)} title="Add update" flush bareHeader>
          <QuickUpdateForm
            attack={updateAttack}
            symptoms={sortedSymptoms}
            reliefs={sortedReliefs}
            recentMeds={recentMeds}
            textScale={textScale}
            onTextScale={setTextScale}
            onAddSymptom={addSymptom}
            onAddRelief={addRelief}
            onSave={handleUpdateSave}
            onNoChange={handleNoChange}
            onClose={() => setUpdateAttackId(null)}
          />
        </Sheet>
      )}

      {/* Attack detail sheet */}
      <Sheet open={!!detailAttack} onClose={() => setDetailAttack(null)} title="Attack detail">
        {detailAttack && (
          <AttackDetail
            attack={detailAttack}
            onDelete={() => deleteAttack(detailAttack.id)}
            onClose={() => setDetailAttack(null)}
            onAddUpdate={() => { setUpdateAttackId(detailAttack.id); setDetailAttack(null); }}
          />
        )}
      </Sheet>

      {/* End-attack confirmation — lets the user end it now or at an earlier time */}
      {ongoingAttack && (
        <EndAttackDialog
          open={endConfirmOpen}
          minTime={ongoingAttack.snapshots[ongoingAttack.snapshots.length - 1].time}
          onCancel={() => setEndConfirmOpen(false)}
          onConfirm={(endTime) => { endAttack(ongoingAttack.id, endTime); setEndConfirmOpen(false); }}
        />
      )}
    </div>
  );
}
