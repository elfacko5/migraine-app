import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Tab, Attack, Snapshot } from './types';
import { useAttacks } from './hooks/useAttacks';
import { useUserPrefs, PAIN_AREAS } from './hooks/useUserPrefs';
import { useNotifications } from './hooks/useNotifications';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { useViewportHeight } from './hooks/useViewportHeight';
import { triggerFrequency, symptomFrequency, reliefFrequency, sortByFrequency } from './utils/stats';
import { parseVoiceEntry, type VoiceDraft } from './utils/voiceParse';
import { onNotificationAction } from './utils/notifications';
import { consumePendingVoiceEntry } from './utils/pendingVoice';
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
  // Set when either sheet below was opened from the "log a migraine" Siri
  // Shortcut deep link (see the voice-param effect below) — cleared whenever
  // that sheet closes so a stray prefill never leaks into a later manual open.
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);

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

  // Voice logging has two entry points, both ending here:
  //
  // - **Siri App Intent** (native) — `LogMigraineIntent` captures what was said
  //   and leaves it in Preferences under PENDING_VOICE_KEY. Native code can't
  //   write an attack itself (attacks live in localStorage inside the WebView),
  //   so it hands over the transcript and this side does the rest.
  // - **Siri Shortcut deep link** (PWA, and still valid natively) — opens the
  //   app at `?voice=<transcript>`.
  //
  // Either way the transcript is parsed into a draft and the matching sheet
  // opens prefilled — LogForm for a new attack, QuickUpdateForm if one is
  // already ongoing, the same routing the FAB uses. Nothing auto-saves.
  //
  // The ref guard (rather than relying on the URL param being stripped) keeps
  // this to one fire per delivery even if the dependencies below change first.
  const voiceHandledRef = useRef(false);
  const applyVoiceText = useCallback((text: string) => {
    if (voiceHandledRef.current) return;
    voiceHandledRef.current = true;
    setVoiceDraft(parseVoiceEntry(text, {
      painAreas: PAIN_AREAS,
      symptoms: sortedSymptoms,
      reliefs: sortedReliefs,
      triggers: sortedTriggers,
      recentMeds,
    }));
    if (ongoingAttack) setUpdateAttackId(ongoingAttack.id);
    else setLogSheetOpen(true);
  }, [ongoingAttack, recentMeds, sortedTriggers, sortedSymptoms, sortedReliefs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voiceText = params.get('voice');
    if (voiceText) {
      window.history.replaceState({}, '', window.location.pathname);
      applyVoiceText(voiceText);
      return;
    }
    // The intent runs in the native process and may have written its transcript
    // before the web layer even started, or while the app sat in the background
    // — so check on mount *and* on every foreground, not just once.
    const drainPending = async () => {
      if (voiceHandledRef.current) return;
      const pending = await consumePendingVoiceEntry();
      if (pending) applyVoiceText(pending);
    };
    drainPending();
    const onVisible = () => { if (document.visibilityState === 'visible') drainPending(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [applyVoiceText]);

  // Handle reminder button taps. The source is the OS on native and the
  // service worker on web — onNotificationAction hides that difference and
  // absorbs `snooze` itself, so only data-changing actions arrive here.
  useEffect(() => {
    return onNotificationAction(({ action, attackId }) => {
      const attack = attacks.find((a) => a.id === attackId);
      if (!attack) return;
      if (action === 'no_change') {
        const prev = attack.snapshots[attack.snapshots.length - 1];
        addSnapshot(attackId, { time: new Date().toISOString(), areas: { ...prev.areas }, symptoms: [...prev.symptoms], reliefs: [...(prev.reliefs ?? [])], medication: null, note: null }, 'notification_no_change');
      } else if (action === 'update') {
        setUpdateAttackId(attackId);
        setTab('log');
      }
    });
  }, [attacks, addSnapshot]);

  // Releasing the voice guard on close is what lets Siri be used more than once
  // per app session: the intent can run again at any time (it only backgrounds
  // the app), unlike the `?voice=` deep link which is consumed once per load.
  function closeLogSheet() {
    setLogSheetOpen(false);
    setVoiceDraft(null);
    voiceHandledRef.current = false;
  }

  function closeUpdateSheet() {
    setUpdateAttackId(null);
    setVoiceDraft(null);
    voiceHandledRef.current = false;
  }

  async function handleLogSave(snapshot: Omit<Snapshot, 'source'>, triggersSel: string[], notifConfig: typeof defaultNotifConfig, end: string | null, wokeWithMigraine: boolean) {
    const wantsReminders = notifConfig.enabled && !end;
    // Ask before scheduling, not after. startAttack schedules as a side effect,
    // and a reminder scheduled while permission is still undecided is accepted
    // by iOS but silently never delivered if the user then declines — the
    // attack looks like it has reminders when it has none. Awaiting first
    // means the decision is known before anything is queued.
    // Never let a permission failure cost the user the log entry itself.
    if (wantsReminders && shouldPrompt) {
      try { await requestPermission(); } catch (err) { console.error('Notification permission request failed:', err); }
    }
    startAttack(snapshot, triggersSel, notifConfig, end, wokeWithMigraine);
    closeLogSheet();
  }

  function handleUpdateSave(snapshot: Omit<Snapshot, 'source'>) {
    if (updateAttackId !== null) addSnapshot(updateAttackId, snapshot);
    closeUpdateSheet();
  }

  // "Nothing changed" only applies to an ongoing attack — a past attack has
  // no "right now" to log against, so QuickUpdateForm doesn't offer this
  // option once attack.end is set.
  function handleNoChange() {
    if (!updateAttack || updateAttack.end) return;
    const prev = updateAttack.snapshots[updateAttack.snapshots.length - 1];
    addSnapshot(updateAttack.id, { time: new Date().toISOString(), areas: { ...prev.areas }, symptoms: [...prev.symptoms], reliefs: [...(prev.reliefs ?? [])], medication: null, note: null }, 'notification_no_change');
    closeUpdateSheet();
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
      style={{
        height: 'var(--app-height, 100dvh)',
        // Offsets the shell onto the *visible* region when the keyboard
        // pushes it (see useViewportHeight) — 0 the rest of the time. This is
        // a plain translate, not the `will-change: transform` containing-block
        // trick that broke Sheet's overlay behaviour before: every overlay is
        // `absolute` and already anchors to this element, so nothing depends
        // on it not establishing a containing block.
        transform: 'translateY(var(--app-offset, 0px))',
      }}
    >
      <BrightnessOverlay brightness={brightness} onOpenSettings={() => setTab('settings')} />

      <div className="h-full overflow-y-auto">
        <TopBar title={TAB_TITLES[tab]} />
        <div
          className="mx-auto max-w-2xl px-4 pt-5 sm:px-6"
          // Fixed pb-28 isn't enough on devices with a taller home-indicator
          // safe area: BottomNav's own height grows with
          // env(safe-area-inset-bottom), so a flat reserve tuned against a
          // zero-inset preview leaves the last bit of content hidden behind
          // the nav on real devices. Every other bottom-clearance spot in
          // the app (Sheet, LogForm, QuickUpdateForm) already adds the inset
          // explicitly — this one was the one place that didn't.
          style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
        >
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
        onClose={closeLogSheet}
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
          onClose={closeLogSheet}
          onSave={handleLogSave}
          voiceDraft={voiceDraft}
        />
      </Sheet>

      {/* Quick update sheet — targets the ongoing attack (FAB/banner) or any
          past attack (its own detail sheet's "Add update") */}
      {updateAttack && (
        <Sheet open={!!updateAttackId} onClose={closeUpdateSheet} title="Add update" flush bareHeader>
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
            onClose={closeUpdateSheet}
            voiceDraft={voiceDraft}
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
