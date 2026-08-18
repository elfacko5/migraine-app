export interface Snapshot {
  time: string;
  areas: Record<string, number>;      // { 'Right eye': 6, 'Left temple': 3 }
  symptoms: string[];
  reliefs: string[];
  medication: { name: string; dose: string } | null;
  note: string | null;
  source: 'manual' | 'notification_yes' | 'notification_no_change';
}

export interface NotificationConfig {
  enabled: boolean;
  mode: 'adaptive' | 'fixed';
  fixedIntervalMinutes: number;
}

export interface Attack {
  id: number;           // timestamp
  snapshots: Snapshot[];
  end: string | null;
  triggers: string[];
  notificationConfig: NotificationConfig;
  updatedAt?: string;    // ISO timestamp of the last local write; used to resolve sync conflicts
  wokeWithMigraine?: boolean; // set at logging time — the attack was already present on waking, not noticed while awake
  // How much the attack stopped you doing things, asked once when it ends.
  // 0 none · 1 some · 2 a lot · 3 couldn't function. Undefined means it was
  // never answered — never assume 0, which would read as "no impact".
  impact?: 0 | 1 | 2 | 3;
}

// The user's own medication library (Profile → My medications). Acute meds
// are taken to treat an attack and feed the logging wizard's chips;
// preventives are taken daily — including on attack days — and deliberately
// stay out of the wizard, so a daily dose is never recorded as a treatment
// for the attack it happens to coincide with.
export interface Medication {
  id: string;
  name: string;
  dose: string;
  kind: 'acute' | 'preventive';
  createdAt: string;
}

export type Tab = 'log' | 'history' | 'stats' | 'profile';

// Reported by useAttacks/useUserPrefs so Settings can show a combined
// "synced just now" / "sync failed" indicator instead of failing silently.
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
