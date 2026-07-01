import { useState, useCallback } from 'react';
import type { NotificationConfig } from '../types';
import { DEFAULT_NOTIFICATION_CONFIG } from '../utils/notifications';

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

export function useUserPrefs() {
  const [triggers, setTriggersState] = useState<string[]>(() => loadList('hd_triggers', DEFAULT_TRIGGERS));
  const [symptoms, setSymptomsState] = useState<string[]>(() => loadList('hd_symptoms', DEFAULT_SYMPTOMS));
  const [reliefs, setReliefsState] = useState<string[]>(() => loadList('hd_reliefs', DEFAULT_RELIEFS));
  const [defaultNotifConfig, setDefaultNotifConfigState] = useState<NotificationConfig>(loadNotifDefault);

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

  const addTrigger = useCallback((label: string) => {
    setTriggers([...triggers, label]);
  }, [triggers, setTriggers]);

  const addSymptom = useCallback((label: string) => {
    setSymptoms([...symptoms, label]);
  }, [symptoms, setSymptoms]);

  const addRelief = useCallback((label: string) => {
    setReliefs([...reliefs, label]);
  }, [reliefs, setReliefs]);

  const setDefaultNotifConfig = useCallback((cfg: NotificationConfig) => {
    localStorage.setItem('hd_notification_default', JSON.stringify(cfg));
    setDefaultNotifConfigState(cfg);
  }, []);

  return { triggers, symptoms, reliefs, addTrigger, addSymptom, addRelief, defaultNotifConfig, setDefaultNotifConfig };
}
