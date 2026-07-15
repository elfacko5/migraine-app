import { useState, useEffect, useMemo } from 'react';
import type { Tab, Attack, Snapshot } from './types';
import { useAttacks } from './hooks/useAttacks';
import { useUserPrefs } from './hooks/useUserPrefs';
import { useNotifications } from './hooks/useNotifications';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
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

export default function App() {
  const [tab, setTab] = useState<Tab>('log');
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [updateSheetOpen, setUpdateSheetOpen] = useState(false);
  const [detailAttack, setDetailAttack] = useState<Attack | null>(null);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const { attacks, ongoingAttack, startAttack, addSnapshot, endAttack, deleteAttack } = useAttacks(userId);
  const { triggers, symptoms, reliefs, addTrigger, addSymptom, addRelief, defaultNotifConfig } = useUserPrefs(userId);
  const { shouldPrompt, requestPermission } = useNotifications();
  const { textScale, setTextScale, brightness, setBrightness } = useSettings();

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
        setUpdateSheetOpen(true);
        setTab('log');
      } else if (action === 'snooze') {
        // Snooze is handled in the SW; no client action needed.
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [attacks, addSnapshot]);

  function handleLogSave(snapshot: Omit<Snapshot, 'source'>, triggersSel: string[], notifConfig: typeof defaultNotifConfig, end: string | null) {
    startAttack(snapshot, triggersSel, notifConfig, end);
    setLogSheetOpen(false);
    if (notifConfig.enabled && !end && shouldPrompt) requestPermission();
  }

  function handleUpdateSave(snapshot: Omit<Snapshot, 'source'>) {
    if (ongoingAttack) addSnapshot(ongoingAttack.id, snapshot);
    setUpdateSheetOpen(false);
  }

  function handleNoChange() {
    if (!ongoingAttack) return;
    const prev = ongoingAttack.snapshots[ongoingAttack.snapshots.length - 1];
    addSnapshot(ongoingAttack.id, { time: new Date().toISOString(), areas: { ...prev.areas }, symptoms: [...prev.symptoms], reliefs: [...(prev.reliefs ?? [])], medication: null, note: null }, 'notification_no_change');
    setUpdateSheetOpen(false);
  }

  return (
    <div className="min-h-dvh bg-bg-base">
      <BrightnessOverlay brightness={brightness} onOpenSettings={() => setTab('settings')} />

      <TopBar title={TAB_TITLES[tab]} />

      <div className="mx-auto max-w-2xl px-4 pt-5 pb-28 sm:px-6">
        {/* ── Today tab ───────────────────────────── */}
        {tab === 'log' && (
          <section className="space-y-4">
            {ongoingAttack && (
              <OngoingAttackBanner
                attack={ongoingAttack}
                onAddUpdate={() => setUpdateSheetOpen(true)}
                onEnd={() => setEndConfirmOpen(true)}
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
            />
          </section>
        )}
      </div>

      <TextScalePill scale={textScale} onScale={setTextScale} />
      {/* FAB opens Add-update when an attack is already ongoing — you can't
          start a second one until the current attack ends. */}
      <BottomNav
        active={tab}
        onChange={setTab}
        onAdd={() => (ongoingAttack ? setUpdateSheetOpen(true) : setLogSheetOpen(true))}
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

      {/* Quick update sheet */}
      {ongoingAttack && (
        <Sheet open={updateSheetOpen} onClose={() => setUpdateSheetOpen(false)} title="Add update" flush bareHeader>
          <QuickUpdateForm
            attack={ongoingAttack}
            symptoms={sortedSymptoms}
            reliefs={sortedReliefs}
            recentMeds={recentMeds}
            textScale={textScale}
            onTextScale={setTextScale}
            onAddSymptom={addSymptom}
            onAddRelief={addRelief}
            onSave={handleUpdateSave}
            onNoChange={handleNoChange}
            onClose={() => setUpdateSheetOpen(false)}
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
