import type { NotificationConfig } from '../types';
import { BellIcon } from './drawnIcons';
import { RadioDot } from './RadioDot';
import { SectionLabel, SettingsList, SettingsRow, Switch } from './settingsUi';
import { chipClass } from '../utils/chipStyles';

interface Props {
  value: NotificationConfig;
  onChange: (next: NotificationConfig) => void;
}

const FIXED_OPTIONS = [30, 60, 120, 240];

// Matches docs/redesign-v4/screens/reminders/RemindersRedesign.html
// (2026-11-23), on the same "stop moving lidd" call as Settings' own rows:
// List/ListRow/Chip/ChipGroup here were still code-ds, so this screen had
// drifted from the rest of Settings, which had already moved off it.
//
// **Quiet hours is deliberately not built** — A9 backlogged it (it would
// silence reminders during a night attack, which is when a reading matters
// most), and `NotificationConfig` has no field for it; the board's "Quiet
// hours · 23:00–07:00" section would be a control that does nothing.
//
// **The Fixed-interval picker has no board** (the designer left this one
// incomplete), so it stays the pick-one chip row the app already uses
// everywhere else (RadioDot + radiogroup — EndAttackDialog's exact pattern)
// rather than code-ds's Chip/ChipGroup, closing the same gap for the one
// piece the board doesn't settle.
export function NotificationSettings({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <SettingsList>
        <SettingsRow bare>
          <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })}>
            {/* Drawn, not 🔔/🔕: on its own Settings page the emoji was the
                brightest thing on screen. Accent, not muted — the board
                highlights this icon as the screen's one headline control,
                where every other settings-row icon stays neutral. */}
            <span className="flex items-center gap-2">
              <BellIcon className="h-4 w-4 shrink-0 text-accent-light" />
              Check-in reminders
            </span>
          </Switch>
        </SettingsRow>
      </SettingsList>

      {value.enabled && (
        <div className="space-y-3">
          <SectionLabel>Timing</SectionLabel>
          <TimingSwitch
            value={value.mode}
            onChange={(mode) => onChange({ ...value, mode })}
          />

          {value.mode === 'adaptive' ? (
            <>
              <SettingsList>
                <SettingsRow value="1 h after start">First reminder</SettingsRow>
                <SettingsRow value="Every 2 h">Then</SettingsRow>
              </SettingsList>
              <p className="text-xs text-text-secondary">
                Adaptive spaces check-ins out as the attack goes on. Switch to Fixed to set your own times.
              </p>
            </>
          ) : (
            <>
              <div role="radiogroup" aria-label="Reminder interval" className="flex flex-wrap gap-2">
                {FIXED_OPTIONS.map((min) => {
                  const selected = value.fixedIntervalMinutes === min;
                  const label = min < 60 ? `${min}m` : `${min / 60}h`;
                  return (
                    <button
                      key={min}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange({ ...value, fixedIntervalMinutes: min })}
                      // `chipClass` (shared module, not a local duplicate) —
                      // font-weight comes from it, so it isn't left to fight
                      // a locally-declared one for the selected state.
                      className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-4 py-2 text-sm transition-colors ${chipClass(selected)}`}
                    >
                      <RadioDot selected={selected} />
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-text-secondary">A reminder every {value.fixedIntervalMinutes < 60 ? `${value.fixedIntervalMinutes} minutes` : `${value.fixedIntervalMinutes / 60} hours`} while an attack is open.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// The board's own "Timing" control (docs/redesign-v4/screens/reminders) is a
// tall two-segment track — 44px segments in a 4px-padded outer track, the
// active one getting its own tinted fill and an accent border — distinct
// from the shared SegmentedControl.tsx, which is explicitly documented as a
// fixed 32px shape for the top-bar period picker and isn't meant to flex
// per instance. This is its own, purpose-built shape for the one place that
// needs a tall, high-visibility two-way switch; it stays local to this file
// unless a second screen needs the same shape.
function TimingSwitch({ value, onChange }: { value: NotificationConfig['mode']; onChange: (mode: NotificationConfig['mode']) => void }) {
  const options: { value: NotificationConfig['mode']; label: string }[] = [
    { value: 'adaptive', label: 'Adaptive' },
    { value: 'fixed', label: 'Fixed' },
  ];
  return (
    <div role="radiogroup" aria-label="Reminder timing" className="flex gap-1 rounded-[0.875rem] bg-bg-surface p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex min-h-[2.75rem] flex-1 items-center justify-center rounded-[0.625rem] border text-sm transition-colors ${
              selected ? 'border-accent bg-selected-fill font-semibold text-text-primary' : 'border-transparent text-text-primary hover:bg-bg-raised'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
