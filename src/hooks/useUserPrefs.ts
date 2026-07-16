import { useState, useCallback, useEffect, useRef } from 'react';
import type { NotificationConfig } from '../types';
import { DEFAULT_NOTIFICATION_CONFIG } from '../utils/notifications';
import { pullUserPrefs, pushUserPrefs } from '../lib/sync';

export const DEFAULT_TRIGGERS = [
  'Stress', 'Poor sleep', 'Alcohol', 'Caffeine', 'Bright light',
  'Loud noise', 'Skipped meal', 'Weather change', 'Hormones',
  'Menstruation', 'Screen time',
];

export const DEFAULT_SYMPTOMS = [
  'Nausea', 'Vomiting', 'Aura', 'Light sensitivity', 'Sound sensitivity',
  'Throbbing', 'Dizziness', 'Neck stiffness',
];

export const DEFAULT_RELIEFS = [
  'Dark room', 'Quiet room', 'Cold compress', 'Hot compress',
  'Peppermint oil', 'Sleep / rest', 'Cold shower', 'Hot shower',
  'Fresh air', 'Hydration', 'Caffeine', 'Eye mask', 'Stretching',
  'Food', 'Exercise',
];

export const PAIN_AREAS = [
  // Front
  'Forehead left', 'Forehead right',
  'Temple left', 'Temple right',
  'Eye left', 'Eye right',
  'Nose',
  'Cheek left', 'Cheek right',
  'Jaw left', 'Jaw right',
  // Back
  'Crown left', 'Crown right',
  'Occiput left', 'Occiput right',
  'Nape left', 'Nape right',
];

function loadList(key: string, defaults: string[]): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return defaults;
    // Append any newly-added built-in defaults not already present, so new
    // options propagate to existing users (the list is add-only — never pruned).
    const merged = [...stored];
    for (const d of defaults) if (!merged.includes(d)) merged.push(d);
    return merged;
  } catch { return defaults; }
}

function loadNotifDefault(): NotificationConfig {
  try {
    const raw = localStorage.getItem('hd_notification_default');
    return raw ? JSON.parse(raw) : DEFAULT_NOTIFICATION_CONFIG;
  } catch { return DEFAULT_NOTIFICATION_CONFIG; }
}

// Lists are add-only everywhere in this app, so merging local + remote is
// just a union — there's never a "which one is right" conflict to resolve.
function union(a: string[], b: string[]): string[] {
  const merged = [...a];
  for (const item of b) if (!merged.includes(item)) merged.push(item);
  return merged;
}

export function useUserPrefs(userId: string | null) {
  const [triggers, setTriggersState] = useState<string[]>(() => loadList('hd_triggers', DEFAULT_TRIGGERS));
  const [symptoms, setSymptomsState] = useState<string[]>(() => loadList('hd_symptoms', DEFAULT_SYMPTOMS));
  const [reliefs, setReliefsState] = useState<string[]>(() => loadList('hd_reliefs', DEFAULT_RELIEFS));
  const [defaultNotifConfig, setDefaultNotifConfigState] = useState<NotificationConfig>(loadNotifDefault);
  const syncingRef = useRef(false);

  const setTriggers = useCallback((next: string[]) => {
    localStorage.setItem('hd_triggers', JSON.stringify(next));
    setTriggersState(next);
  }, []);

  const setSymptoms = useCallback((next: string[]) => {
    localStorage.setItem('hd_symptoms', JSON.stringify(next));
    setSymptomsState(next);
  }, []);

  const setReliefs = useCallback((next: string[]) => {
    localStorage.setItem('hd_reliefs', JSON.stringify(next));
    setReliefsState(next);
  }, []);

  const setDefaultNotifConfig = useCallback((cfg: NotificationConfig) => {
    localStorage.setItem('hd_notification_default', JSON.stringify(cfg));
    setDefaultNotifConfigState(cfg);
  }, []);

  const sync = useCallback(async (uid: string) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const remote = await pullUserPrefs();
      // Read fresh from localStorage rather than closing over component
      // state, since this runs again on every foreground/visibility change,
      // not just once at mount.
      const localTriggers = loadList('hd_triggers', DEFAULT_TRIGGERS);
      const localSymptoms = loadList('hd_symptoms', DEFAULT_SYMPTOMS);
      const localReliefs = loadList('hd_reliefs', DEFAULT_RELIEFS);
      const localNotif = loadNotifDefault();
      const mergedTriggers = remote ? union(localTriggers, remote.triggers) : localTriggers;
      const mergedSymptoms = remote ? union(localSymptoms, remote.symptoms) : localSymptoms;
      const mergedReliefs = remote ? union(localReliefs, remote.reliefs) : localReliefs;
      const mergedNotif = remote?.notification_default ?? localNotif;
      setTriggers(mergedTriggers);
      setSymptoms(mergedSymptoms);
      setReliefs(mergedReliefs);
      setDefaultNotifConfig(mergedNotif);
      await pushUserPrefs({
        triggers: mergedTriggers, symptoms: mergedSymptoms, reliefs: mergedReliefs,
        notificationDefault: mergedNotif,
      }, uid);
    } catch (err) {
      console.error('Prefs sync failed:', err);
    } finally {
      syncingRef.current = false;
    }
  }, [setTriggers, setSymptoms, setReliefs, setDefaultNotifConfig]);

  // Sync on mount/sign-in, and again whenever the app is foregrounded — see
  // the matching comment in useAttacks.ts for why.
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

  const addTrigger = useCallback((label: string) => {
    const next = [...triggers, label];
    setTriggers(next);
    if (userId) pushUserPrefs({ triggers: next, symptoms, reliefs, notificationDefault: defaultNotifConfig }, userId).catch((err) => console.error('Prefs sync failed:', err));
  }, [triggers, symptoms, reliefs, defaultNotifConfig, setTriggers, userId]);

  const addSymptom = useCallback((label: string) => {
    const next = [...symptoms, label];
    setSymptoms(next);
    if (userId) pushUserPrefs({ triggers, symptoms: next, reliefs, notificationDefault: defaultNotifConfig }, userId).catch((err) => console.error('Prefs sync failed:', err));
  }, [triggers, symptoms, reliefs, defaultNotifConfig, setSymptoms, userId]);

  const addRelief = useCallback((label: string) => {
    const next = [...reliefs, label];
    setReliefs(next);
    if (userId) pushUserPrefs({ triggers, symptoms, reliefs: next, notificationDefault: defaultNotifConfig }, userId).catch((err) => console.error('Prefs sync failed:', err));
  }, [triggers, symptoms, reliefs, defaultNotifConfig, setReliefs, userId]);

  const setDefaultNotifConfigSynced = useCallback((cfg: NotificationConfig) => {
    setDefaultNotifConfig(cfg);
    if (userId) pushUserPrefs({ triggers, symptoms, reliefs, notificationDefault: cfg }, userId).catch((err) => console.error('Prefs sync failed:', err));
  }, [triggers, symptoms, reliefs, setDefaultNotifConfig, userId]);

  return {
    triggers, symptoms, reliefs, addTrigger, addSymptom, addRelief,
    defaultNotifConfig, setDefaultNotifConfig: setDefaultNotifConfigSynced,
  };
}
