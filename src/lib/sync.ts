import type { Attack, NotificationConfig, Medication } from '../types';
import { supabase } from './supabase';

interface AttackRow {
  id: number;
  snapshots: Attack['snapshots'];
  end_time: string | null;
  triggers: string[];
  notification_config: NotificationConfig;
  updated_at: string;
  woke_with_migraine: boolean | null;
  impact: number | null;
}

function rowToAttack(row: AttackRow): Attack {
  return {
    id: row.id,
    snapshots: row.snapshots,
    end: row.end_time,
    triggers: row.triggers,
    notificationConfig: row.notification_config,
    updatedAt: row.updated_at,
    wokeWithMigraine: row.woke_with_migraine ?? false,
    // null means unanswered, which is not the same as 0 — see Attack.impact.
    ...(row.impact === null || row.impact === undefined ? {} : { impact: row.impact as Attack['impact'] }),
  };
}

function attackToRow(attack: Attack, userId: string) {
  return {
    id: attack.id,
    user_id: userId,
    snapshots: attack.snapshots,
    end_time: attack.end,
    triggers: attack.triggers,
    notification_config: attack.notificationConfig,
    updated_at: attack.updatedAt ?? new Date().toISOString(),
    woke_with_migraine: attack.wokeWithMigraine ?? false,
    impact: attack.impact ?? null,
  };
}

export async function pullAttacks(): Promise<Attack[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('attacks').select('*');
  if (error) throw error;
  return (data as AttackRow[]).map(rowToAttack);
}

// Upserts every attack in one round trip — called after each local commit
// (fire-and-forget from the caller) and during the initial post-sign-in merge.
export async function pushAttacks(attacks: Attack[], userId: string): Promise<void> {
  if (!supabase || attacks.length === 0) return;
  const { error } = await supabase.from('attacks').upsert(attacks.map((a) => attackToRow(a, userId)));
  if (error) throw error;
}

export async function deleteAttackRemote(id: number): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('attacks').delete().eq('id', id);
  if (error) throw error;
}

interface UserPrefsRow {
  triggers: string[];
  symptoms: string[];
  reliefs: string[];
  notification_default: NotificationConfig | null;
  medications: Medication[] | null;
  medications_updated_at: string | null;
}

export async function pullUserPrefs(): Promise<UserPrefsRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('user_prefs').select('*').maybeSingle();
  if (error) throw error;
  return data as UserPrefsRow | null;
}

// Medications live in the same one-row-per-user table, but push on their own
// path: useMedications owns them and must not clobber the trigger/symptom/
// relief lists it doesn't hold (upsert would null out any column it omits if
// they were pushed together from two hooks).
export async function pushMedications(items: Medication[], updatedAt: string, userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_prefs').upsert({
    user_id: userId,
    medications: items,
    medications_updated_at: updatedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function pushUserPrefs(prefs: {
  triggers: string[];
  symptoms: string[];
  reliefs: string[];
  notificationDefault: NotificationConfig;
}, userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_prefs').upsert({
    user_id: userId,
    triggers: prefs.triggers,
    symptoms: prefs.symptoms,
    reliefs: prefs.reliefs,
    notification_default: prefs.notificationDefault,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
