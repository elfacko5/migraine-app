import { useEffect, useRef, useState } from 'react';
import { formatDatetime, isoToLocalInput, localInputToIso } from '../utils/format';
import { openPicker } from '../utils/openPicker';

interface Props {
  open: boolean;
  // The last snapshot's time — an attack can't be marked as ending before its
  // most recent update.
  minTime: string;
  onCancel: () => void;
  onConfirm: (endTime: string) => void;
}

type Mode = 'now' | 'manual';

/**
 * Confirmation modal for ending an ongoing attack, with an inline choice of
 * "Just now" or an earlier time — mirrors the End-time step in LogForm.
 * Not mounted via ConfirmDialog since it needs its own time-picker state.
 */
export function EndAttackDialog({ open, minTime, onCancel, onConfirm }: Props) {
  const [mode, setMode] = useState<Mode>('now');
  const [manualTime, setManualTime] = useState(isoToLocalInput());
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMode('now');
      setManualTime(isoToLocalInput());
    }
  }, [open]);

  useEffect(() => {
    if (mode === 'manual') openPicker(inputRef.current);
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    confirmRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  function confirm() {
    const end = mode === 'now' ? new Date().toISOString() : localInputToIso(manualTime);
    // The datetime-local input is minute-precision, so picking the exact
    // minimum can round to just before the last snapshot's true (sub-minute)
    // timestamp — clamp so the attack never ends before its last update.
    onConfirm(end < minTime ? minTime : end);
  }

  const minLocal = isoToLocalInput(minTime);
  const maxLocal = isoToLocalInput();

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-bg-base/70 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="End this attack?"
        className={`relative w-full max-w-sm rounded-2xl border border-bg-border bg-bg-surface p-5 transition-all duration-200 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <h2 className="text-base font-semibold text-text-primary">End this attack?</h2>
        <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
          This marks the attack as resolved and stops update reminders. You can still view it in your logs.
        </p>

        <div className="mt-4 space-y-1.5">
          <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">End time</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('now')}
              aria-pressed={mode === 'now'}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === 'now' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Just now
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              aria-pressed={mode === 'manual'}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Earlier
            </button>
          </div>
          {mode === 'manual' && (
            <input
              ref={inputRef}
              type="datetime-local"
              value={manualTime}
              min={minLocal}
              max={maxLocal}
              onChange={(e) => setManualTime(e.target.value)}
              className="mt-1.5 w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-subtle"
            />
          )}
          {mode === 'manual' && (
            <p className="text-xs text-text-secondary">
              Must be after {formatDatetime(minTime)}
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={confirm}
            className="btn-primary flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            End attack
          </button>
        </div>
      </div>
    </div>
  );
}
