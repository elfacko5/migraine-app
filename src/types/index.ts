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
}

export type Tab = 'log' | 'history' | 'stats' | 'settings';

// Reported by useAttacks/useUserPrefs so Settings can show a combined
// "synced just now" / "sync failed" indicator instead of failing silently.
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
