import type { Attack } from '../types';
import { attackMaxSeverity } from './stats';
import { formatElapsed } from './format';

function getSW(): ServiceWorker | null {
  return navigator.serviceWorker?.controller ?? null;
}

export function scheduleNotification(attack: Attack, delayMs: number) {
  const sw = getSW();
  if (!sw) return;
  const first = attack.snapshots[0];
  const cur = attack.snapshots[attack.snapshots.length - 1];
  const severity = attackMaxSeverity(attack);
  const elapsed = formatElapsed(first.time);
  const areas = Object.keys(cur.areas).join(', ') || 'unknown area';
  sw.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    attackId: attack.id,
    delayMs,
    title: "How's your migraine?",
    body: `Started ${elapsed} · ${areas} · severity ${severity}`,
  });
}

export function cancelNotification(attackId: number) {
  getSW()?.postMessage({ type: 'CANCEL_NOTIFICATION', attackId });
}

export function nextDelay(attack: Attack): number {
  const cfg = attack.notificationConfig;
  if (!cfg.enabled) return 0;
  if (cfg.mode === 'fixed') return cfg.fixedIntervalMinutes * 60 * 1000;
  return attack.snapshots.length === 1 ? 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
}

export const DEFAULT_NOTIFICATION_CONFIG = {
  enabled: true,
  mode: 'adaptive' as const,
  fixedIntervalMinutes: 60,
};

// Returns a label for the next scheduled notification time.
export function nextNotificationLabel(attack: Attack): string {
  const ms = nextDelay(attack);
  if (ms === 0) return '';
  const min = ms / 60000;
  if (min < 60) return `in ${min}m`;
  return `in ${min / 60}h`;
}
