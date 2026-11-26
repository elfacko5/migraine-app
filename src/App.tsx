import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { requestSync } from './utils/syncNow';
import type { Tab, Snapshot, Medication, Attack } from './types';
import { useAttacks, type SnapshotEntry } from './hooks/useAttacks';
import { useUserPrefs, PAIN_AREAS } from './hooks/useUserPrefs';
import { useMedications } from './hooks/useMedications';
import { isDeletedName, isLogged, medLabel, stampSnapshot } from './utils/medResolve';
import { useHit6 } from './hooks/useHit6';
import { useNotifications } from './hooks/useNotifications';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { AppRoot } from 'code-ds';
import { useScrolledFromTop } from './hooks/useScrolledFromTop';
import { triggerFrequency, symptomFrequency, reliefFrequency, sortByFrequency } from './utils/stats';
import { isRetired } from './utils/retired';
import { parseVoiceEntry, type VoiceDraft } from './utils/voiceParse';
import { onNotificationAction, cancelNotification } from './utils/notifications';
import { awaitPendingVoiceEntry } from './utils/pendingVoice';
import { consumePendingActions } from './utils/pendingActions';
import { useWidgetSnapshot } from './hooks/useWidgetSnapshot';
import { BottomNav } from './components/BottomNav';
import { AddSheet } from './components/AddSheet';
import { formatTime } from './utils/format';
import { TopBar } from './components/TopBar';
import { Sheet } from './components/Sheet';
import { EndAttackForm } from './components/EndAttackForm';
import { AttackEndedSummary } from './components/AttackEndedSummary';

const TAB_TITLES: Record<Tab, string> = {
  // A greeting rather than the app's name: the user already knows which app
  // they opened, and the Today tab is the one screen that isn't a list of
  // something, so naming it after its contents would say nothing either.
  log: 'Hello',
  history: 'Logs',
  stats: 'Insights',
  profile: 'Settings',
};
import { LogForm } from './components/LogForm';
import { LiveAttackForm } from './components/LiveAttackForm';
import { PastAttackForm } from './components/PastAttackForm';
import { QuickUpdateForm } from './components/QuickUpdateForm';
import { UpdateAttackForm } from './components/UpdateAttackForm';
import { OngoingAttackBanner } from './components/OngoingAttackBanner';
import { AttackFreeCard } from './components/AttackFreeCard';
import { Hit6Prompt } from './components/Hit6Prompt';
import { hit6Due } from './utils/hit6';
import { TodaySummary } from './components/TodaySummary';
import { WeekCard } from './components/WeekCard';
import { CheckInCard } from './components/CheckInCard';
import { AttackDetail } from './components/AttackDetail';
import { StatsView } from './components/StatsView';
import { SegmentedControl } from './components/SegmentedControl';
import { HistoryView } from './components/HistoryView';
import { LogsFilterPanel, LogsFilterReset } from './components/LogsFilterPanel';
import { DEFAULT_FILTERS, PERIOD_SEGMENTS, type LogFilters, type SortOrder, type Period } from './utils/logFilters';
import { ProfileView, DisplayPanel, RemindersPanel, AccountPanel, DataPanel, AboutPanel, type ProfileSection } from './components/ProfileView';
import { MedicationsView } from './components/MedicationsView';
import { GuidesView } from './components/GuidesView';
import { Hit6View } from './components/Hit6View';
import { EditMedicationForm } from './components/EditMedicationForm';
import { AddMedicationWizard } from './components/AddMedicationWizard';
import { Toast } from './components/Toast';
import { DELETED_FLAG } from './utils/backup';
import { AttackModePill } from './components/AttackModePill';
import { BrightnessOverlay } from './components/BrightnessOverlay';

// Not `hd_`: sync bookkeeping for this device, not diary data to export.
const ALL_SYNCED_KEY = 'lidd_all_synced_at';
function readAllSynced(uid: string | null): string | null {
  if (!uid) return null;
  try {
    const v = JSON.parse(localStorage.getItem(ALL_SYNCED_KEY) ?? 'null') as { uid?: string; at?: string } | null;
    return v?.uid === uid && typeof v.at === 'string' ? v.at : null;
  } catch { return null; }
}
function writeAllSynced(uid: string, at: string) {
  try { localStorage.setItem(ALL_SYNCED_KEY, JSON.stringify({ uid, at })); } catch { /* best effort */ }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('log');
  // Owned here, not in `StatsView`, because the control that sets it is
  // rendered in `TopBar` — see the comment on that control below. 30 days and
  // not 7: every clinical figure on Insights is monthly, and a 7-day window in
  // a quiet week showed an empty page to someone with a perfectly normal
  // number of attacks.
  const [statsPeriod, setStatsPeriod] = useState<Period>('30d');
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  // Bumped by "Add another past attack" to remount PastAttackForm blank.
  const [pastFormKey, setPastFormKey] = useState(0);
  // Opened from the + menu's "Add a past attack": the same wizard, starting
  // with an end time to pick rather than "Still going".
  const [logPast, setLogPast] = useState(false);
  // The attack an "Add update" sheet targets — the ongoing one (via the FAB
  // or its Today-tab banner) or any past attack (via its detail sheet).
  // Looked up fresh from `attacks` by id rather than stashing the object, so
  // it always reflects the latest snapshots even if this stays open a while.
  const [updateAttackId, setUpdateAttackId] = useState<number | null>(null);
  // The *id*, not the attack — looked up fresh from `attacks` each render,
  // the same rule `updateAttackId` follows. Stashing the object meant an
  // "Edit details" save left the sheet rendering its own pre-edit copy.
  const [detailAttackId, setDetailAttackId] = useState<number | null>(null);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  // The attack the End flow just ended, while its sheet shows the summary.
  // `ongoingAttack` is null the moment the end is saved, so the sheet would
  // otherwise unmount under it. Cleared on every open, so a later End never
  // starts on an old summary.
  const [endedAttackId, setEndedAttackId] = useState<number | null>(null);
  const openEndFlow = () => { setEndedAttackId(null); setEndConfirmOpen(true); };
  // Set by handleEndFlowSave when the auto setting should turn attack mode
  // off; acted on once the End sheet closes (the effect below).
  const autoOffPendingRef = useRef(false);
  const [profileSheet, setProfileSheet] = useState<ProfileSection | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Logs list state lives up here, not in HistoryView, because its filter
  // Sheet has to be rendered from this component — a Sheet inside the tab's
  // scroll container anchors to the wrong ancestor (see the viewport rules).
  // It also means the choices survive leaving the tab and coming back, which
  // is the behaviour you want from a filter you deliberately set.
  const [logsFilters, setLogsFilters] = useState<LogFilters>(DEFAULT_FILTERS);
  const [logsSort, setLogsSort] = useState<SortOrder>('newest');
  const [logsFilterOpen, setLogsFilterOpen] = useState(false);

  // Which medication the editor sheet is open on: an existing one, or a new
  // one of a given kind. Kept here rather than inside MedicationsView because
  // Sheet anchors to the app root — see the Profile tab notes in CLAUDE.md.
  // Monthly guides opened from Insights — its own bottom sheet, separate from
  // the Settings drill-down (`profileSheet === 'guides'`), so closing it
  // returns to Insights rather than to My medications.
  const [insightsGuidesOpen, setInsightsGuidesOpen] = useState(false);
  const [medEditor, setMedEditor] = useState<{ med: Medication } | { isNew: true } | null>(null);
  // Seeded once from the flag Data → Delete all data leaves before reloading,
  // so the message lands on the fresh, empty app.
  // The initialiser only reads (StrictMode runs it twice); the effect clears.
  const [toastMessage, setToastMessage] = useState<string | null>(() => {
    try {
      if (sessionStorage.getItem(DELETED_FLAG)) return 'All data on this phone was deleted.';
    } catch { /* no sessionStorage: no message */ }
    return null;
  });
  useEffect(() => {
    try { sessionStorage.removeItem(DELETED_FLAG); } catch { /* nothing to clear */ }
  }, []);
  // The edit form's own answer to a close request (Escape, the backdrop).
  const editCloseRef = useRef<(() => void) | null>(null);
  // Set when either sheet below was opened by voice — the Siri App Intent or
  // the Shortcut deep link (see the voice effect below) — and cleared whenever
  // that sheet closes so a stray prefill never leaks into a later manual open.
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);

  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const {
    attacks, ongoingAttack, startAttack, addSnapshot, addSnapshots, endAttack, updateAttackDetails, addLaterDetails, deleteAttack,
    syncStatus: attacksSyncStatus, lastSyncedAt: attacksLastSyncedAt,
  } = useAttacks(userId);
  const {
    triggers, symptoms, reliefs, addTrigger, addSymptom, addRelief, defaultNotifConfig, setDefaultNotifConfig,
    syncStatus: prefsSyncStatus, lastSyncedAt: prefsLastSyncedAt,
  } = useUserPrefs(userId);
  const {
    medications, guides, deleted, setGuide, addMedication, updateMedications, removeMedication,
    syncStatus: medsSyncStatus, lastSyncedAt: medsLastSyncedAt,
  } = useMedications(userId);
  const {
    hit6Entries, hit6DismissedAt, addHit6, removeHit6, dismissHit6,
    syncStatus: hit6SyncStatus, lastSyncedAt: hit6LastSyncedAt,
  } = useHit6(userId);
  const { shouldPrompt, requestPermission } = useNotifications();
  const {
    textScale, setTextScale, brightness, theme, setTheme, attackMode, setAttackMode,
    font, setFont, attackModeAuto, setAttackModeAuto, systemText, setSystemText,
  } = useSettings();

  // Mirrors what the home-screen widget shows out to the App Group. Watches
  // the data rather than the writers, so no future save path can forget it.
  useWidgetSnapshot(attacks, medications);

  // The shell's nested scroll container — watched by the Insights header to
  // collapse its title. Nothing else may scroll at page level.
  const scrollRef = useRef<HTMLDivElement>(null);
  const insightsScrolled = useScrolledFromTop(scrollRef);

  // Combine the independent sync hooks into one status for Profile: an error
  // in any takes priority, then in-flight, then the most recent successful
  // sync of the three.
  const syncStatus = useMemo(() => {
    const all = [attacksSyncStatus, prefsSyncStatus, medsSyncStatus, hit6SyncStatus];
    if (all.includes('error')) return 'error' as const;
    if (all.includes('syncing')) return 'syncing' as const;
    if (attacksLastSyncedAt || prefsLastSyncedAt || medsLastSyncedAt || hit6LastSyncedAt) return 'synced' as const;
    return 'idle' as const;
  }, [attacksSyncStatus, prefsSyncStatus, medsSyncStatus, hit6SyncStatus, attacksLastSyncedAt, prefsLastSyncedAt, medsLastSyncedAt, hit6LastSyncedAt]);
  const lastSyncedAt = useMemo(() => {
    const stamps = [attacksLastSyncedAt, prefsLastSyncedAt, medsLastSyncedAt, hit6LastSyncedAt].filter(Boolean) as string[];
    return stamps.length ? stamps.reduce((a, b) => (a > b ? a : b)) : null;
  }, [attacksLastSyncedAt, prefsLastSyncedAt, medsLastSyncedAt, hit6LastSyncedAt]);

  // When *everything* last synced, kept across launches (2026-11-26). The
  // hooks' own stamps live in memory and each covers one kind of data, so a
  // paused sync's "Not synced since…" read "Not synced yet" after any offline
  // launch, or a moment ago when only one kind had failed. Written only while
  // the combined status is 'synced' (nothing failing, nothing in flight).
  //
  // Stored with the account it belongs to and read back only for that
  // account — never cleared on a null session, which is also what the first
  // render and an offline launch with an expired token look like. The first
  // render after the account changes is skipped: the hooks still hold the
  // previous account's 'synced' and stamp until their own sync starts.
  const uid = auth.user?.id ?? null;
  const allSyncedUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (uid !== allSyncedUidRef.current) { allSyncedUidRef.current = uid; return; }
    if (uid && syncStatus === 'synced' && lastSyncedAt) writeAllSynced(uid, lastSyncedAt);
  }, [uid, syncStatus, lastSyncedAt]);
  const allSyncedAt = syncStatus === 'synced' ? lastSyncedAt : readAllSynced(uid);

  // A paused sync retries when the connection comes back, as well as on
  // focus and on the next write — the notice promises it catches up.
  useEffect(() => {
    window.addEventListener('online', requestSync);
    return () => window.removeEventListener('online', requestSync);
  }, []);

  // Whether the Profile row shows its "Due" marker. Recomputed per render
  // rather than on a tick: the window is four weeks, so it does not need to
  // turn over live, and the Profile tab is re-entered often enough.
  // Two different questions, and they must not share an answer. The Profile
  // row reports *status* and ignores the dismissal — "Not now" silences an
  // interruption, it doesn't make the questionnaire un-due, and a settings
  // page that hid that would be lying. The Today card is the interruption, so
  // it is the one the dismissal applies to.
  const hit6IsDue = useMemo(() => hit6Due(hit6Entries), [hit6Entries]);
  const hit6Prompting = useMemo(() => hit6Due(hit6Entries, hit6DismissedAt), [hit6Entries, hit6DismissedAt]);

  // Medications offered in the logging wizard and used to correct spoken drug
  // names in voiceParse: the user's own acute library first, in their order,
  // then anything found in history that isn't already there.
  //
  // The history scan is what makes this work with no setup at all — someone
  // who never opens Profile → My medications keeps exactly today's behaviour.
  // The library half is what lets a newly-added medication appear before it
  // has ever been logged, which is the point of curating one.
  //
  // Preventives are excluded: this list feeds the "what did you take for this
  // attack" step, and a daily dose taken regardless is not a treatment for
  // the attack it happens to coincide with.
  const recentMeds = useMemo(() => {
    const seen = new Map<string, string>();
    for (const med of medications) {
      if (med.kind !== 'acute') continue;
      const name = med.name.trim();
      if (name && !seen.has(name)) seen.set(name, med.dose);
    }
    for (const attack of attacks) {
      for (const snap of [...attack.snapshots].reverse()) {
        // The history half is also where a retired entry would come back:
        // it isn't in the library, so nothing else filters it, and it would
        // be offered as a chip on every log from now on.
        const name = snap.medication?.name?.trim();
        // A deleted medicine's doses stay in the diary, but its name is not
        // offered again: it is in no entry and on the deleted list.
        if (name && !isRetired(name) && !seen.has(name) && !isDeletedName(name, medications, deleted)) {
          seen.set(name, snap.medication!.dose);
        }
      }
    }
    return Array.from(seen.entries()).map(([name, dose]) => ({ name, dose }));
  }, [attacks, medications, deleted]);

  // Most recent attack end (ISO strings compare chronologically) — for the
  // "attack-free" card shown when nothing is ongoing.
  const lastAttackEnd = useMemo(() => {
    const ends = attacks.map((a) => a.end).filter((e): e is string => !!e);
    return ends.length ? ends.reduce((max, e) => (e > max ? e : max)) : null;
  }, [attacks]);

  // Whether Today is showing its hero. The hero owns the top of the screen in
  // that state, so TopBar stands down — see the note at its call site.
  const heroOnToday = tab === 'log' && !!(ongoingAttack || lastAttackEnd);
  // The attack mode pill's Today placement: the hero's top-left corner. It
  // renders nothing while attack mode is on — the way out is then the strip
  // on the nav.
  const heroAttackMode = <AttackModePill active={attackMode} onToggle={setAttackMode} />;

  // Order the pickers' options by how often they've been selected historically,
  // so the most-used surface at the top.
  const sortedTriggers = useMemo(() => sortByFrequency(triggers, triggerFrequency(attacks)), [triggers, attacks]);
  const sortedSymptoms = useMemo(() => sortByFrequency(symptoms, symptomFrequency(attacks)), [symptoms, attacks]);
  const sortedReliefs = useMemo(() => sortByFrequency(reliefs, reliefFrequency(attacks)), [reliefs, attacks]);

  const updateAttack = attacks.find((a) => a.id === updateAttackId) ?? null;
  const detailAttack = attacks.find((a) => a.id === detailAttackId) ?? null;
  const endedAttack = endedAttackId === null ? null : attacks.find((a) => a.id === endedAttackId && a.end !== null) ?? null;

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
  // Attack mode's automatic "off", once the End sheet (and its summary) has
  // closed, by whichever path: Done, the X, or opening the entry.
  useEffect(() => {
    if (endConfirmOpen || !autoOffPendingRef.current) return;
    autoOffPendingRef.current = false;
    setAttackMode(false);
  }, [endConfirmOpen, setAttackMode]);

  const voiceHandledRef = useRef(false);
  const applyVoiceText = useCallback((text: string, startedText = '') => {
    if (voiceHandledRef.current) return;
    voiceHandledRef.current = true;
    setVoiceDraft(parseVoiceEntry(text, {
      painAreas: PAIN_AREAS,
      symptoms: sortedSymptoms,
      reliefs: sortedReliefs,
      triggers: sortedTriggers,
      recentMeds,
    }, startedText));
    if (ongoingAttack) setUpdateAttackId(ongoingAttack.id);
    else setLogSheetOpen(true);
  }, [ongoingAttack, recentMeds, sortedTriggers, sortedSymptoms, sortedReliefs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voiceText = params.get('voice');
    if (voiceText) {
      window.history.replaceState({}, '', window.location.pathname);
      // the voice transcript arrives from outside React (a URL param, or the
      // Siri intent's handoff), so opening the sheet from it is synchronising
      // with an external system. There is no render-time value to derive it
      // from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applyVoiceText(voiceText);
      return;
    }
    // The intent runs in the native process and may have written its transcript
    // before the web layer even started, or while the app sat in the background
    // — so check on mount *and* on every foreground, not just once.
    let polling = false;
    const drainPending = async () => {
      if (voiceHandledRef.current || polling) return;
      polling = true;
      try {
        // Waits rather than reads once — the intent's write may not be visible
        // to this process yet, and there is no second event coming to retry on.
        const pending = await awaitPendingVoiceEntry();
        if (pending) applyVoiceText(pending.note, pending.started);
      } finally {
        polling = false;
      }
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

  // Applies every reminder answer given outside the app — the only place they
  // are ever applied, on both platforms.
  //
  // Nothing here is driven by the notification event itself. On iOS the buttons
  // are handled in Swift with the app closed, so an answer may be hours old by
  // the time this runs: a no-change reading keeps its own tap time rather than
  // being stamped now, and "Something changed" opens the wizard from the queue
  // rather than from a live event that may arrive before the app can act on it.
  const drainingRef = useRef(false);
  const drainNotificationAnswers = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      const pending = await consumePendingActions();
      if (pending.length === 0) return;

      const entries: SnapshotEntry[] = [];
      let openFor: number | null = null;

      for (const answer of pending) {
        const attack = attacks.find((a) => a.id === answer.attackId);
        // The attack may have been ended or deleted while the reminder sat
        // unanswered: cancelNotification only drops *pending* reminders, so one
        // already sitting in Notification Center keeps working buttons. An
        // ended attack can still be opened for a backfilled update, but it must
        // never take a "no change" reading against right now.
        if (!attack) {
          cancelNotification(answer.attackId);
          continue;
        }
        if (answer.action === 'update') {
          openFor = answer.attackId;
          continue;
        }
        if (attack.end) {
          cancelNotification(answer.attackId);
          continue;
        }
        const prev = attack.snapshots[attack.snapshots.length - 1];
        entries.push({
          attackId: answer.attackId,
          snapshot: {
            // Only the severities carry forward — that's what "no change"
            // asserts. Copying the previous symptoms and reliefs across made
            // the timeline show things the user never re-reported.
            time: answer.time,
            areas: { ...prev.areas },
            symptoms: [],
            reliefs: [],
            medication: null,
            note: null,
          },
          source: 'notification_no_change',
          reschedule: !answer.rescheduled,
        });
      }

      if (entries.length) addSnapshots(entries);
      // After the readings, so the wizard opens onto an attack that already
      // includes them.
      if (openFor !== null) {
        setUpdateAttackId(openFor);
        setTab('log');
      }
    } finally {
      drainingRef.current = false;
    }
  }, [attacks, addSnapshots]);

  // Same reasoning as the voice handoff: the answer may have been queued before
  // the web layer started, or while the app sat in the background.
  useEffect(() => {
    void drainNotificationAnswers();
    const onVisible = () => { if (document.visibilityState === 'visible') void drainNotificationAnswers(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [drainNotificationAnswers]);

  // A reminder was answered while the app happened to be running. The answer is
  // already in the queue by now, so this only says "look at it now" instead of
  // waiting for the next foreground — see onNotificationAction for why nothing
  // is allowed to depend on this arriving.
  useEffect(() => onNotificationAction(() => {
    void drainNotificationAnswers();
  }), [drainNotificationAnswers]);

  // Releasing the voice guard on close is what lets Siri be used more than once
  // per app session: the intent can run again at any time (it only backgrounds
  // the app), unlike the `?voice=` deep link which is consumed once per load.
  function closeLogSheet() {
    setLogSheetOpen(false);
    setLogPast(false);
    setVoiceDraft(null);
    voiceHandledRef.current = false;
  }

  function closeUpdateSheet() {
    setUpdateAttackId(null);
    setVoiceDraft(null);
    voiceHandledRef.current = false;
  }

  // Saves and returns the stored attack without closing the sheet —
  // PastAttackForm stays open on its summary screen. `handleLogSave` below is
  // this plus the close, for the flows that end on Today.
  async function saveLog(
    snapshot: Omit<Snapshot, 'source'>, triggersSel: string[], notifConfig: typeof defaultNotifConfig, end: string | null, wokeWithMigraine: boolean, doseReadings: Array<Omit<Snapshot, 'source'>> = [],
    // Past-attack-only metadata, passed straight into `startAttack` rather
    // than set with a follow-up `updateAttackDetails` call — that call would
    // map over this render's own `attacks`, which still doesn't contain the
    // attack `startAttack` just committed, and silently overwrite it back
    // out of existence (caught on-device: a past-attack save with
    // painQuality or endUnknown set vanished with nothing in the console).
    // Deliberately no `impact` param here: asking it at past-log time would
    // be exactly the recall bias `impact.ts`'s own reasoning rejects (a
    // judgement about what the attack cost, reconstructed after the fact).
    // Impact is now only ever asked live, as a step of `EndAttackForm`; a
    // past-logged attack stays unanswered.
    endUnknown?: boolean,
    painQuality?: string[],
    wokeAt?: string,
  ): Promise<Attack> {
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
    // New doses carry the library entry's id, so a dose can later be told from
    // another entry of the same name. Only written when exactly one entry owns
    // the name (and dose text); typed-in names stay as they were.
    const attack = startAttack(
      stampSnapshot(snapshot, medications), triggersSel, notifConfig, end, wokeWithMigraine,
      doseReadings.map((r) => stampSnapshot(r, medications)),
      endUnknown, painQuality, wokeAt,
    );
    // "Attack mode when I start an attack" (Display page, opt-in). Only for
    // an attack that's still going — a retrospective log is someone looking
    // back, not someone in the middle of one.
    if (attackModeAuto && !end && !attackMode) setAttackMode(true);
    return attack;
  }

  async function handleLogSave(...args: Parameters<typeof saveLog>) {
    await saveLog(...args);
    closeLogSheet();
  }

  function handleUpdateSave(snapshot: Omit<Snapshot, 'source'>, source: Snapshot['source'] = 'manual') {
    if (updateAttackId !== null) addSnapshot(updateAttackId, stampSnapshot(snapshot, medications), source);
    closeUpdateSheet();
  }

  // UpdateAttackForm's own save — a primary reading plus any new doses and
  // dose-outcome readings, all at their own real times, committed together
  // the same way `handleLogSave` bundles `extraSnapshots` into one call. One
  // entry per attack carries `reschedule: true`; `addSnapshots` only checks
  // whether *any* of an attack's entries ask for it.
  function handleUpdateFlowSave(snapshot: Omit<Snapshot, 'source'>, extraSnapshots: Array<Omit<Snapshot, 'source'>>) {
    if (updateAttackId === null) return;
    const entries: SnapshotEntry[] = [
      { attackId: updateAttackId, snapshot: stampSnapshot(snapshot, medications), source: 'manual', reschedule: true },
      ...extraSnapshots.map((s) => ({ attackId: updateAttackId, snapshot: stampSnapshot(s, medications), source: 'manual' as const, reschedule: false })),
    ];
    addSnapshots(entries);
    closeUpdateSheet();
  }

  // EndAttackForm's own save — the end time/flag/impact plus any dose-
  // outcome readings and the closing "what was it like" snapshot, and the
  // two attack-level fields (triggers, painQuality) this flow can also set,
  // all in the one `endAttack` call (see that hook's own comment on why).
  function handleEndFlowSave(
    endTime: string,
    endUnknown: boolean,
    impact: Attack['impact'] | undefined,
    extraSnapshots: Array<Omit<Snapshot, 'source'>>,
    triggersSel: string[],
    painQuality: string[],
  ) {
    if (!ongoingAttack) return;
    endAttack(
      ongoingAttack.id, endTime, impact, endUnknown,
      extraSnapshots.map((s) => stampSnapshot(s, medications)),
      triggersSel, painQuality,
    );
    // "When I log an attack" (Display page) covers both ends of the attack:
    // on when it starts, off once it ends. Off waits for the End sheet to
    // close — flipping the whole palette under the summary someone is still
    // reading would be the jolt attack mode exists to avoid.
    if (attackModeAuto && attackMode) autoOffPendingRef.current = true;
    // The sheet stays open on the summary (`AttackEndedSummary`).
    setEndedAttackId(ongoingAttack.id);
    if (updateAttackId === ongoingAttack.id) closeUpdateSheet();
    if (detailAttack?.id === ongoingAttack.id) setDetailAttackId(null);
  }
  return (
    <AppRoot>
    <div
      // `relative` + a height that fills AppRoot's frame (it was --app-height),
      // rather than min-h-dvh + letting the page itself scroll, makes this div a fixed,
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
      // Height and the keyboard offset belong to the package's AppRoot now
      // (see the mount in the return below); this fills the frame it gives.
      style={{ height: '100%' }}
    >
      <BrightnessOverlay brightness={brightness} attackMode={attackMode} />

      {/* The app's only scroll region (the document itself never scrolls —
          see docs/viewport-architecture.md), so it's also the only place a
          floating control can learn which way the user is going. */}
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {/* Today gives its top edge to the hero, which bleeds to the screen
            edges and runs under the status bar — a "Hello" bar above it would
            put a strip of chrome between the status bar and artwork that is
            meant to start at the top. The hero's own label and headline are
            the page's heading in that state. Every other tab, and Today's
            first-run state (which has no hero), keep the bar. */}
        {!heroOnToday && (
          <TopBar
            title={TAB_TITLES[tab]}
            // The Insights period rides in the sticky header so it stays on
            // screen while the page scrolls — as a chip row at the top of the
            // content it scrolled away, and half way down there was nothing
            // saying which period the figures answered.
            //
            // Rendered here rather than in `StatsView` because `TopBar` is
            // here; a second sticky element inside the page would have to be
            // offset against this header's height, which varies with the
            // safe-area inset and the text-size setting and so cannot be a
            // constant.
            // On Today this is the first-run state — no hero yet — and the
            // attack mode button lives here instead, so attack mode is
            // reachable before the first attack is ever logged.
            control={tab === 'log' ? (
              <AttackModePill active={attackMode} onToggle={setAttackMode} />
            ) : tab === 'stats' && attacks.length > 0 ? (
              <SegmentedControl
                options={PERIOD_SEGMENTS}
                value={statsPeriod}
                onChange={setStatsPeriod}
                label="Period"
                fill
              />
            ) : undefined}
            // The page opens with its title, and gives it up only once you
            // have scrolled away from the top — where the control alone is
            // what you need, and a 34px headline pinned above it is chrome on
            // every screen of a long page. It comes back at the top and only
            // there: see `useScrolledFromTop` for why this watches position
            // rather than direction the way the floating pill does.
            titleHidden={insightsScrolled}
          />
        )}
        {/* No top padding on Insights: its date line belongs to the period
            control above it, so it sits on the top bar's own 12px under the
            control (the v4 board's `.top` gap is 10) rather than 32px away. */}
        <div
          className={`mx-auto max-w-2xl px-gutter sm:px-gutter-wide ${tab === 'stats' ? '' : 'pt-5'}`}
          // The reserve clears the nav and the FAB in it. It was 10rem while
          // AttackModePill floated over every tab; that pill is gone (v3,
          // 2026-10-26 — attack mode lives in Today's hero and on the Display
          // page), so nothing floats over the content any more. **Anything
          // added to a floating layer later has to be checked against this.**
          //
          // The inset is added rather than assumed: BottomNav's own height
          // grows with env(safe-area-inset-bottom), so a flat reserve tuned
          // against a zero-inset preview leaves content behind the nav on a
          // real device.
          //
          // While attack mode is on, the nav carries its strip (56px + its 1px hairline, pinned
          // in px so it doesn't grow with the text size) and the reserve
          // grows by that much on every tab.
          style={{ paddingBottom: `calc(7rem + ${attackMode ? '57px' : '0px'} + env(safe-area-inset-bottom))` }}
        >
        {/* ── Today tab ───────────────────────────── */}
        {/* Order, top to bottom: hero → week card → two-hour check-in → the
            ongoing dose → overuse warnings → the two tiles → the medication
            card → HIT-6. Roughly "what bears on the next hour" first and
            "what can wait" last. In attack mode only the hero, check-in and
            dose survive. 14px between blocks, to the v3 spec — the other
            tabs keep 16. The impact question (2026-11-22's `ImpactPrompt`)
            was removed 2026-11-25 — it's now asked live, as a step of
            `EndAttackForm`, instead of as a 24h Today fallback. */}
        {tab === 'log' && (
          <section className="space-y-3.5">
            {ongoingAttack && (
              <OngoingAttackBanner
                attack={ongoingAttack}
                topAction={heroAttackMode}
                onEnd={openEndFlow}
                onAddUpdate={() => setUpdateAttackId(ongoingAttack.id)}
                onOpenDetail={() => setDetailAttackId(ongoingAttack.id)}
              />
            )}

            {!ongoingAttack && lastAttackEnd && (
              <AttackFreeCard lastEnd={lastAttackEnd} topAction={heroAttackMode} />
            )}

            {/* Only when two or more attacks overlap the last seven days —
                it renders nothing otherwise. Off in attack mode: what that
                mode shows is being redesigned separately, so nothing new
                joins it except the check-in, which bears on the next hour. */}
            {!attackMode && <WeekCard attacks={attacks} />}

            {/* The two-hour check-in after a dose, ongoing attacks only. Kept
                in attack mode — it bears on the next hour. Tapping it opens
                the ordinary Add update flow for this attack. */}
            {ongoingAttack && (
              <CheckInCard attack={ongoingAttack} onOpen={() => setUpdateAttackId(ongoingAttack.id)} />
            )}

            {/* Below the hero card: the month's two figures, and — only when
                they apply — an overuse warning and the last dose taken.
                Ranked above the HIT-6 prompt (2026-09-25, Sunny's call): the
                last dose is the "next hour" question Today exists to answer,
                where HIT-6 is a four-week retrospective that's never urgent —
                so the actionable figure outranks the one that can wait. */}
            {(ongoingAttack || lastAttackEnd) && (
              <TodaySummary
                attacks={attacks}
                ongoing={ongoingAttack}
                medications={medications}
                guides={guides}
                deleted={deleted}
                attackMode={attackMode}
                onOpenInsights={() => setTab('stats')}
              />
            )}

            {/* Offered on Today when it's due, on Sunny's instruction — see
                Hit6Prompt for why that reverses the original "Profile row
                only" call, and for the two things that keep it from nagging.
                Hidden in attack mode: it changes nothing about the next hour. */}
            {hit6Prompting && !attackMode && (
              <Hit6Prompt
                first={hit6Entries.length === 0}
                onStart={() => { setTab('profile'); setProfileSheet('hit6'); }}
                onDismiss={dismissHit6}
              />
            )}

            {!ongoingAttack && !lastAttackEnd && (
              <div className="rounded-card border border-dashed border-bg-border p-10 text-center space-y-2">
                {/* "when you're ready" is the dossier's §9.4 empty state: the
                    app doesn't chase, and a first entry shouldn't feel owed. */}
                <p className="text-text-secondary text-sm">
                  Nothing logged yet. Add your first entry when you're ready.
                </p>
                <button
                  type="button"
                  onClick={() => setLogSheetOpen(true)}
                  className="btn-primary rounded-control px-6 py-2.5 text-sm font-medium transition-colors"
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
            <HistoryView
              attacks={attacks}
              filters={logsFilters}
              onFilters={setLogsFilters}
              sort={logsSort}
              onSort={setLogsSort}
              onOpenFilters={() => setLogsFilterOpen(true)}
              onAttackClick={(a) => setDetailAttackId(a.id)}
              onAdd={() => { setLogPast(false); setLogSheetOpen(true); }}
            />
          </section>
        )}

        {/* ── Insights tab ─────────────────────────── */}
        {tab === 'stats' && (
          <section className="space-y-4">
            <StatsView
              attacks={attacks}
              medications={medications}
              guides={guides}
              deleted={deleted}
              period={statsPeriod}
              onAttackClick={(a) => setDetailAttackId(a.id)}
              onAdd={() => { setLogPast(false); setLogSheetOpen(true); }}
              onOpenGuides={() => setInsightsGuidesOpen(true)}
            />
          </section>
        )}

        {/* ── Settings tab ─────────────────────────── */}
        {tab === 'profile' && (
          <section className="space-y-4">
            <ProfileView
              onOpen={setProfileSheet}
              accountEnabled={auth.enabled}
              hit6Due={hit6IsDue}
              remindersOn={defaultNotifConfig.enabled}
              signedIn={!!auth.user}
              syncPaused={syncStatus === 'error'}
              signedOutElsewhere={auth.signedOutElsewhere}
            />
          </section>
        )}
        </div>
      </div>

      {/* The + opens a menu (2026-10-28). While an attack is ongoing it
          offers only what bears on that attack — you can't start a second one
          until it ends, and someone mid-attack shouldn't have to think about
          a past one. Otherwise: log one now, or add one from before. */}
      <BottomNav
        active={tab}
        onChange={setTab}
        onAddPress={() => setAddSheetOpen(true)}
        addOpen={addSheetOpen}
        attackMode={attackMode}
        onAttackMode={setAttackMode}
      />
      <AddSheet
        open={addSheetOpen}
        ongoing={!!ongoingAttack}
        onClose={() => setAddSheetOpen(false)}
        actions={ongoingAttack
          ? [
              { label: 'Add an update', detail: `Started ${formatTime(ongoingAttack.snapshots[0].time)}`, onSelect: () => setUpdateAttackId(ongoingAttack.id) },
              { label: 'End attack', onSelect: openEndFlow },
            ]
          : [
              { label: 'Log an attack', detail: 'Starting now', onSelect: () => { setLogPast(false); setLogSheetOpen(true); } },
              { label: 'Add a past attack', onSelect: () => { setLogPast(true); setLogSheetOpen(true); } },
            ]}
      />

      {/* Log attack sheet. The v4 LiveAttackForm/PastAttackForm replace
          LogForm for manual entry — voice drafts (live or past) still open
          LogForm, which keeps the step-0 voice review screen and the
          symptoms/reliefs/triggers steps a dictated log still needs. See
          LiveAttackForm's own doc comment. */}
      <Sheet
        open={logSheetOpen}
        onClose={closeLogSheet}
        title={logPast ? 'Add a past attack' : 'Log an attack'}
        flush
        bareHeader
      >
        {voiceDraft ? (
          <LogForm
            past={logPast}
            triggers={sortedTriggers}
            symptoms={sortedSymptoms}
            reliefs={sortedReliefs}
            defaultNotifConfig={defaultNotifConfig}
            recentMeds={recentMeds}
            medications={medications}
            attacks={attacks}
            onAddTrigger={addTrigger}
            onAddSymptom={addSymptom}
            onAddRelief={addRelief}
            onClose={closeLogSheet}
            onSave={handleLogSave}
            voiceDraft={voiceDraft}
          />
        ) : logPast ? (
          <PastAttackForm
            key={pastFormKey}
            triggers={sortedTriggers}
            symptoms={sortedSymptoms}
            reliefs={sortedReliefs}
            recentMeds={recentMeds}
            medications={medications}
            attacks={attacks}
            defaultNotifConfig={defaultNotifConfig}
            onAddSymptom={addSymptom}
            onAddRelief={addRelief}
            onAddTrigger={addTrigger}
            onClose={closeLogSheet}
            onAddAnother={() => setPastFormKey((k) => k + 1)}
            onSave={saveLog}
          />
        ) : (
          <LiveAttackForm
            recentMeds={recentMeds}
            medications={medications}
            attacks={attacks}
            defaultNotifConfig={defaultNotifConfig}
            onClose={closeLogSheet}
            onSave={handleLogSave}
          />
        )}
      </Sheet>

      {/* Quick update sheet — targets the ongoing attack (FAB/banner) or any
          past attack (its own detail sheet's "Add update"). The v4
          UpdateAttackForm replaces QuickUpdateForm for manual entry only — a
          voice draft still opens QuickUpdateForm, same carve-out as the log
          sheet above. */}
      {updateAttack && (
        <Sheet open={!!updateAttackId} onClose={closeUpdateSheet} title="Add update" flush bareHeader>
          {voiceDraft ? (
            <QuickUpdateForm
              attack={updateAttack}
              symptoms={sortedSymptoms}
              reliefs={sortedReliefs}
              recentMeds={recentMeds}
              medications={medications}
              attacks={attacks}
              onAddSymptom={addSymptom}
              onAddRelief={addRelief}
              onSave={handleUpdateSave}
              onClose={closeUpdateSheet}
              voiceDraft={voiceDraft}
            />
          ) : (
            <UpdateAttackForm
              attack={updateAttack}
              symptoms={sortedSymptoms}
              reliefs={sortedReliefs}
              recentMeds={recentMeds}
              medications={medications}
              attacks={attacks}
              onAddSymptom={addSymptom}
              onAddRelief={addRelief}
              onSave={handleUpdateFlowSave}
              onNoChange={(snapshot) => handleUpdateSave(snapshot, 'notification_no_change')}
              onClose={closeUpdateSheet}
            />
          )}
        </Sheet>
      )}

      <Sheet
        open={insightsGuidesOpen}
        onClose={() => setInsightsGuidesOpen(false)}
        title="Monthly guides"
        flush
        bareHeader
      >
        {insightsGuidesOpen && (
          <GuidesView
            medications={medications}
            guides={guides}
            onSetGuide={setGuide}
            onClose={() => setInsightsGuidesOpen(false)}
            dismiss="close"
          />
        )}
      </Sheet>

      {/* Profile sub-pages — one Sheet, contents switched by which row was
          tapped. flush/bareHeader for the same reason as the detail sheet:
          each panel owns its top bar via ProfileSubPage and pins nothing to
          a sticky footer inside an iOS scroll container. */}
      <Sheet
        open={profileSheet !== null}
        // One level back from Monthly guides (like its Back control), else closed.
        onClose={() => setProfileSheet(profileSheet === 'guides' ? 'medications' : null)}
        title="Profile"
        flush
        bareHeader
        enterFrom="right"
      >
        {profileSheet === 'medications' && (
          <MedicationsView
            medications={medications}
            onEdit={(med) => setMedEditor({ med })}
            onAddNew={() => setMedEditor({ isNew: true })}
            onOpenGuides={() => setProfileSheet('guides')}
            onClose={() => setProfileSheet(null)}
          />
        )}
        {profileSheet === 'guides' && (
          <GuidesView
            medications={medications}
            guides={guides}
            onSetGuide={setGuide}
            onClose={() => setProfileSheet('medications')}
          />
        )}
        {profileSheet === 'hit6' && (
          <Hit6View
            entries={hit6Entries}
            signedIn={!!auth.session}
            onSubmit={addHit6}
            onDelete={removeHit6}
            onClose={() => setProfileSheet(null)}
          />
        )}
        {profileSheet === 'display' && (
          <DisplayPanel
            textScale={textScale}
            onTextScale={setTextScale}
            theme={theme}
            onTheme={setTheme}
            attackMode={attackMode}
            onAttackMode={setAttackMode}
            font={font}
            onFont={setFont}
            attackModeAuto={attackModeAuto}
            onAttackModeAuto={setAttackModeAuto}
            systemText={systemText}
            onSystemText={setSystemText}
            onClose={() => setProfileSheet(null)}
          />
        )}
        {profileSheet === 'reminders' && (
          <RemindersPanel
            value={defaultNotifConfig}
            onChange={setDefaultNotifConfig}
            onClose={() => setProfileSheet(null)}
          />
        )}
        {profileSheet === 'account' && (
          <AccountPanel
            auth={auth}
            syncStatus={syncStatus}
            lastSyncedAt={lastSyncedAt}
            allSyncedAt={allSyncedAt}
            onClose={() => setProfileSheet(null)}
          />
        )}
        {profileSheet === 'data' && (
          <DataPanel
            auth={auth}
            syncStatus={syncStatus}
            onClose={() => setProfileSheet(null)}
            attackCount={attacks.length}
            checkInCount={attacks.reduce((n, a) => n + a.snapshots.length, 0)}
            medCount={medications.length}
            reminders={defaultNotifConfig}
            onReminders={setDefaultNotifConfig}
          />
        )}
        {profileSheet === 'about' && (
          <AboutPanel onClose={() => setProfileSheet(null)} email={auth.user?.email ?? null} />
        )}
      </Sheet>

      {/* Logs filter & sort. Sheet's default bottom entry with its own close
          X, not the Profile sub-pages' right-entry + back chevron: this
          interrupts the list you're reading to adjust it, rather than being a
          level you navigate into. */}
      <Sheet
        open={logsFilterOpen}
        onClose={() => setLogsFilterOpen(false)}
        title="Filter & sort"
        flush
        headerRight={<LogsFilterReset filters={logsFilters} onChange={setLogsFilters} />}
      >
        <LogsFilterPanel
          attacks={attacks}
          filters={logsFilters}
          sort={logsSort}
          onChange={setLogsFilters}
          onSort={setLogsSort}
          onClose={() => setLogsFilterOpen(false)}
        />
      </Sheet>

      {/* Edit a medicine — a bottom-entering modal on top of the Profile
          drill-down: it interrupts the list rather than being another level of
          it. It brings its own top bar and sub-screens, and answers a close
          request itself (one screen back, or the discard question). */}
      <Sheet
        open={medEditor !== null && 'med' in medEditor}
        onClose={() => (editCloseRef.current ? editCloseRef.current() : setMedEditor(null))}
        title="Edit medication"
        flush
        bareHeader
      >
        {medEditor && 'med' in medEditor && (
          <EditMedicationForm
            medication={medEditor.med}
            library={medications}
            guides={guides}
            attacks={attacks}
            closeRef={editCloseRef}
            onSave={(updates) => {
              const twin = updateMedications(updates);
              if (twin) { setToastMessage(`You already have ${medLabel(twin)}.`); return; }
              setMedEditor(null);
            }}
            onDelete={() => {
              removeMedication(medEditor.med.id);
              setMedEditor(null);
              // The second sentence only when there are doses for it to be about.
              setToastMessage(`${medLabel(medEditor.med)} was removed from your medicines.${isLogged(medEditor.med, medications, attacks) ? ' Its earlier doses stay in your diary.' : ''}`);
            }}
            onClose={() => setMedEditor(null)}
          />
        )}
      </Sheet>

      {/* Add a medicine — the three-step wizard. Its own sheet. */}
      <Sheet
        open={medEditor !== null && 'isNew' in medEditor}
        onClose={() => setMedEditor(null)}
        title="Add a medicine"
        flush
        bareHeader
      >
        {medEditor && 'isNew' in medEditor && (
          <AddMedicationWizard
            library={medications}
            guides={guides}
            onAdd={(next) => {
              const added = addMedication(next);
              setMedEditor(null);
              setToastMessage(added ? `${medLabel(next)} was added to your medicines.` : `You already have ${medLabel(next)}.`);
            }}
            onEditExisting={(med) => setMedEditor({ med })}
            onClose={() => setMedEditor(null)}
          />
        )}
      </Sheet>

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />

      {/* Attack detail sheet — flush/bareHeader because AttackDetail brings
          its own top bar and pins its own footer. */}
      <Sheet open={!!detailAttack} onClose={() => setDetailAttackId(null)} title="Attack details" flush bareHeader enterFrom="right">
        {detailAttack && (
          <AttackDetail
            attack={detailAttack}
            medications={medications}
            onDelete={() => deleteAttack(detailAttack.id)}
            onClose={() => setDetailAttackId(null)}
            onAddUpdate={() => { setUpdateAttackId(detailAttack.id); setDetailAttackId(null); }}
            // Only for the attack actually in progress — an ended one has
            // nothing to end. Opens the same dialog the Today tab uses, so
            // its presets and minute-vs-second clamping aren't duplicated.
            onEndAttack={detailAttack.end === null ? openEndFlow : undefined}
            // Attack-level metadata only — the mutation itself refuses to
            // touch snapshots. See docs/editing-assessment.md.
            onSaveDetails={(patch) => updateAttackDetails(detailAttack.id, patch)}
            onAddLater={(details) => addLaterDetails(detailAttack.id, details)}
            symptomOptions={sortedSymptoms}
            reliefOptions={sortedReliefs}
            triggerOptions={sortedTriggers}
            onAddSymptom={addSymptom}
            onAddRelief={addRelief}
            onAddTrigger={addTrigger}
          />
        )}
      </Sheet>

      {/* End-attack flow — the v4 EndAttackForm replaces EndAttackDialog's
          single question entirely; there's no voice carve-out to preserve
          here, unlike the other three logging flows. */}
      {(endedAttack || ongoingAttack) && (
        <Sheet open={endConfirmOpen} onClose={() => setEndConfirmOpen(false)} title="End attack" flush bareHeader>
          {endedAttack ? (
            <AttackEndedSummary
              attack={endedAttack}
              onOpenEntry={() => { setEndConfirmOpen(false); setDetailAttackId(endedAttack.id); }}
              onDone={() => setEndConfirmOpen(false)}
            />
          ) : ongoingAttack && (
          <EndAttackForm
            attack={ongoingAttack}
            symptoms={sortedSymptoms}
            reliefs={sortedReliefs}
            triggers={sortedTriggers}
            onAddSymptom={addSymptom}
            onAddRelief={addRelief}
            onAddTrigger={addTrigger}
            onClose={() => setEndConfirmOpen(false)}
            onSave={handleEndFlowSave}
          />
          )}
        </Sheet>
      )}
    </div>
    </AppRoot>
  );
}
