import type { NotificationConfig } from '../types';

interface Props {
  value: NotificationConfig;
  onChange: (next: NotificationConfig) => void;
}

export function NotificationSettings({ value, onChange }: Props) {
  const FIXED_OPTIONS = [30, 60, 120, 240];

  return (
    <div className="rounded-xl bg-bg-raised/60 border border-bg-border px-4 py-3 space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-text-primary">
          <span>{value.enabled ? '🔔' : '🔕'}</span>
          <span>Enable reminders</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-label="Enable reminders"
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light ${
            value.enabled ? 'bg-accent' : 'bg-bg-border'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-bg-surface transition-transform ${
              value.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

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
  );
}
