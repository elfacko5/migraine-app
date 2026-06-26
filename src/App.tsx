import { useState, useEffect, useMemo } from 'react';
import type { Tab, Attack, Snapshot } from './types';
import { useAttacks } from './hooks/useAttacks';
import { useUserPrefs } from './hooks/useUserPrefs';
import { useNotifications } from './hooks/useNotifications';
import { useSettings } from './hooks/useSettings';
import { BottomNav } from './components/BottomNav';
import { Sheet } from './components/Sheet';
import { LogForm } from './components/LogForm';
import { QuickUpdateForm } from './components/QuickUpdateForm';
import { OngoingAttackBanner } from './components/OngoingAttackBanner';
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

  const { attacks, ongoingAttack, startAttack, addSnapshot, endAttack, deleteAttack } = useAttacks();
  const { triggers, symptoms, reliefs, addTrigger, addSymptom, addRelief, defaultNotifConfig } = useUserPrefs();
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

      <div className="mx-auto max-w-2xl px-4 pt-6 pb-28 sm:px-6">
        {/* ── Today tab ───────────────────────────── */}
        {tab === 'log' && (
          <section className="space-y-4">
            <h1 className="text-xl font-bold text-text-primary">Migraine Tracker</h1>

            {ongoingAttack && (
              <OngoingAttackBanner
                attack={ongoingAttack}
                onAddUpdate={() => setUpdateSheetOpen(true)}
                onEnd={() => { if (confirm('Mark this attack as ended?')) endAttack(ongoingAttack.id); }}
              />
            )}

            {!ongoingAttack && (
              <div className="rounded-xl border border-dashed border-bg-border p-10 text-center space-y-2">
                <p className="text-text-secondary text-sm">No ongoing attack.</p>
                <button
                  type="button"
                  onClick={() => setLogSheetOpen(true)}
                  className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-bg-base hover:bg-accent-light transition-colors"
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
            <h1 className="text-xl font-bold text-text-primary">Logs</h1>
            <HistoryView attacks={attacks} onAttackClick={(a) => setDetailAttack(a)} />
          </section>
        )}

        {/* ── Insights tab ─────────────────────────── */}
        {tab === 'stats' && (
          <section className="space-y-4">
            <h1 className="text-xl font-bold text-text-primary">Insights</h1>
            <StatsView attacks={attacks} />
          </section>
        )}

        {/* ── Settings tab ─────────────────────────── */}
        {tab === 'settings' && (
          <section className="space-y-4">
            <h1 className="text-xl font-bold text-text-primary">Settings</h1>
            <SettingsView
              textScale={textScale}
              onTextScale={setTextScale}
              brightness={brightness}
              onBrightness={setBrightness}
            />
          </section>
        )}
      </div>

      <TextScalePill scale={textScale} onScale={setTextScale} />
      <BottomNav active={tab} onChange={setTab} onAdd={() => setLogSheetOpen(true)} />

      {/* Log attack sheet */}
      <Sheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} title="Log attack">
        <LogForm
          triggers={triggers}
          symptoms={symptoms}
          reliefs={reliefs}
          defaultNotifConfig={defaultNotifConfig}
          recentMeds={recentMeds}
          onAddTrigger={addTrigger}
          onAddSymptom={addSymptom}
          onAddRelief={addRelief}
          onSave={handleLogSave}
        />
      </Sheet>

      {/* Quick update sheet */}
      {ongoingAttack && (
        <Sheet open={updateSheetOpen} onClose={() => setUpdateSheetOpen(false)} title="Add update">
          <QuickUpdateForm
            attack={ongoingAttack}
            symptoms={symptoms}
            reliefs={reliefs}
            recentMeds={recentMeds}
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
    </div>
  );
}
