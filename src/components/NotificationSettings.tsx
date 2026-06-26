import { useState } from 'react';
import type { NotificationConfig } from '../types';

interface Props {
  value: NotificationConfig;
  onChange: (next: NotificationConfig) => void;
}

export function NotificationSettings({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const FIXED_OPTIONS = [30, 60, 120, 240];

  return (
    <div className="rounded-xl bg-bg-raised/60 border border-bg-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm text-text-primary"
      >
        <span className="flex items-center gap-2">
          <span>{value.enabled ? '🔔' : '🔕'}</span>
          <span>Notification reminders {value.enabled ? 'on' : 'off'}</span>
        </span>
        <span className="text-text-secondary">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-bg-border px-4 py-3 space-y-4">
          {/* Enable toggle */}
          <label className="flex items-center justify-between">
            <span className="text-sm text-text-primary">Enable reminders</span>
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
              className="h-4 w-4 rounded"
            />
          </label>

          {value.enabled && (
            <>
              {/* Mode toggle */}
              <div className="space-y-2">
                <p className="text-xs text-text-secondary uppercase tracking-wider">Timing</p>
                <div className="flex flex-wrap gap-2">
                  {(['adaptive', 'fixed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onChange({ ...value, mode })}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        value.mode === mode
                          ? 'bg-accent text-bg-base'
                          : 'bg-bg-border text-text-primary hover:bg-bg-raised'
                      }`}
                    >
                      {mode === 'adaptive' ? 'Adaptive' : 'Fixed'}
                    </button>
                  ))}
                </div>
                {value.mode === 'adaptive' && (
                  <p className="text-xs text-text-secondary">1h after start, then every 2h</p>
                )}
              </div>

              {/* Fixed interval picker */}
              {value.mode === 'fixed' && (
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary uppercase tracking-wider">Interval</p>
                  <div className="flex flex-wrap gap-2">
                    {FIXED_OPTIONS.map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => onChange({ ...value, fixedIntervalMinutes: min })}
                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                          value.fixedIntervalMinutes === min
                            ? 'bg-accent text-bg-base'
                            : 'bg-bg-border text-text-primary hover:bg-bg-raised'
                        }`}
                      >
                        {min < 60 ? `${min}m` : `${min / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
