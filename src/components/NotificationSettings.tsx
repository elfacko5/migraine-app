import { Chip, ChipGroup, List, ListRow, Switch } from 'code-ds';
import type { NotificationConfig } from '../types';
import { BellIcon } from './drawnIcons';

interface Props {
  value: NotificationConfig;
  onChange: (next: NotificationConfig) => void;
}

const FIXED_OPTIONS = [30, 60, 120, 240];

export function NotificationSettings({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <List>
        <ListRow bare>
          <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })}>
            {/* Drawn, not 🔔/🔕: on its own Settings page the emoji was the
                brightest thing on screen. The switch beside it carries on/off. */}
            <span className="flex items-center gap-2">
              <BellIcon className="h-4 w-4 shrink-0 text-content-muted" />
              Enable reminders
            </span>
          </Switch>
        </ListRow>
      </List>

      {value.enabled && (
        <>
          <div className="space-y-2">
            <p id="reminder-timing" className="text-xs text-content-muted uppercase tracking-wider">Timing</p>
            <ChipGroup
              type="one"
              aria-labelledby="reminder-timing"
              value={value.mode}
              onValueChange={(mode) => onChange({ ...value, mode: mode as NotificationConfig['mode'] })}
            >
              <Chip value="adaptive">Adaptive</Chip>
              <Chip value="fixed">Fixed</Chip>
            </ChipGroup>
            {value.mode === 'adaptive' && (
              <p className="text-xs text-content-muted">1h after start, then every 2h</p>
            )}
          </div>

          {value.mode === 'fixed' && (
            <div className="space-y-2">
              <p id="reminder-interval" className="text-xs text-content-muted uppercase tracking-wider">Interval</p>
              <ChipGroup
                type="one"
                aria-labelledby="reminder-interval"
                value={String(value.fixedIntervalMinutes)}
                onValueChange={(min) => onChange({ ...value, fixedIntervalMinutes: Number(min) })}
              >
                {FIXED_OPTIONS.map((min) => (
                  <Chip key={min} value={String(min)}>{min < 60 ? `${min}m` : `${min / 60}h`}</Chip>
                ))}
              </ChipGroup>
            </div>
          )}
        </>
      )}
    </div>
  );
}
