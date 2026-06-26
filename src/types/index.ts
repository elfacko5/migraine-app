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
}

export type Tab = 'log' | 'history' | 'stats' | 'settings';
