import type { NotificationConfig } from '../types';
import { everyLabel } from '../utils/format';
import { BellIcon } from './drawnIcons';
import { RadioDot } from './RadioDot';
import { SectionLabel, SettingsList, SettingsRow, Switch } from './settingsUi';

interface Props {
  value: NotificationConfig;
  onChange: (next: NotificationConfig) => void;
}

const FIXED_OPTIONS = [30, 60, 120, 240];


// Matches docs/redesign-v4/screens/reminders/RemindersRedesign.html.
//
// **Quiet hours is deliberately not built** — A9 backlogged it (it would
// silence reminders during a night attack, which is when a reading matters
// most), and `NotificationConfig` has no field for it; the board's "Quiet
// hours · 23:00–07:00" section would be a control that does nothing.
//
// **The Fixed-interval picker has no board** (the designer left this one
// incomplete). It takes the Adaptive card's own shape — the same list card,
// one row per interval, value-side radio — so switching Timing swaps the
// card's contents rather than swapping a card for a chip row, which read as
// a different screen (2026-11-25).
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
            <span className="flex items-center gap-3 font-medium">
              <BellIcon className="h-5 w-5 shrink-0 text-accent-light" />
              Check-in reminders
            </span>
          </Switch>
        </SettingsRow>
      </SettingsList>

      {value.enabled && (
        <div>
          <SectionLabel>Timing</SectionLabel>
          <TimingSwitch
            value={value.mode}
            onChange={(mode) => onChange({ ...value, mode })}
          />

          <div className="mt-3">
            {value.mode === 'adaptive' ? (
              <SettingsList>
                <SettingsRow trailing="1 h after start" trailingTone="accent">First reminder</SettingsRow>
                <SettingsRow trailing="Every 2 h" trailingTone="accent">Then</SettingsRow>
              </SettingsList>
            ) : (
              <div role="radiogroup" aria-label="Reminder interval">
                <SettingsList>
                  {FIXED_OPTIONS.map((min) => {
                    const selected = value.fixedIntervalMinutes === min;
                    return (
                      <SettingsRow bare key={min}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onChange({ ...value, fixedIntervalMinutes: min })}
                          className={`flex w-full items-center gap-3 text-left text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${selected ? 'font-medium text-text-primary' : 'text-text-primary'}`}
                        >
                          <span className="flex-1">{everyLabel(min)}</span>
                          <span className={selected ? 'text-accent-light' : 'text-text-secondary'}>
                            <RadioDot selected={selected} />
                          </span>
                        </button>
                      </SettingsRow>
                    );
                  })}
                </SettingsList>
              </div>
            )}
          </div>
          <p className="mx-1 mt-2.5 text-xs text-text-secondary">
            {value.mode === 'adaptive'
              ? 'Adaptive spaces check-ins out as the attack goes on. Switch to Fixed to set your own times.'
              : 'Fixed asks at the same interval for as long as the attack is open.'}
          </p>
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
