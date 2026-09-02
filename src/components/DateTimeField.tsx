import { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { formatDate, formatTime, localInputToIso } from '../utils/format';
import { openPicker } from '../utils/openPicker';
import { hasNativeDatePicker, presentNativeDatePicker } from '../utils/nativeDatePicker';

// One date/time control, used everywhere a moment is picked — LogForm's start
// and end, QuickUpdateForm's update time, AttackDetail's end-time edit, and
// EndAttackDialog. It replaced a bare `<input type="datetime-local">` repeated
// at all five (2026-09-01).
//
// **Why it is two fields.** iOS renders a datetime-local as a date button and
// a time button, so changing only the time — which is the common case in a
// diary, where the day is nearly always today — cost two taps: one to open the
// control, one to reach the time half. Split, the time is one tap.
//
// **The date box is still a datetime-local, deliberately.** Tapping it opens
// the combined picker exactly as before, so backdating an attack to a
// different day is unchanged; only the time gets its own, narrower control.
//
// **The inputs are transparent overlays on a drawn box, not styled inputs.**
// A native date/time control sizes itself and ignores the author box model on
// iOS (see the `appearance: none` note in index.css, which this still needs);
// laying it out of flow at `inset-0` means it cannot push the row past the
// shell edge whatever intrinsic width WebKit gives it, and the visible text is
// the app's own `formatDate`/`formatTime` rather than the UA's format.
//
// **WebKit's picker popover carries a "Reset" button and a blue checkmark, and
// there is no way to remove them.** They are drawn inside the popover itself,
// not on the keyboard's input accessory bar — so @capacitor/keyboard's
// `setAccessoryBarVisible`, which nils `inputAccessoryView`, does nothing to
// them; that was installed for this, verified against the Simulator on
// 2026-09-02, and removed again. Nothing in the WKWebView API reaches that
// chrome. Replacing it means not using a native input at all — a `UIDatePicker`
// presented from a plugin, or a wheel built in the page.
//
// **On the native build the wheel comes from `LiddDatePickerPlugin`, not from
// an input.** WebKit draws a "Reset" button and a blue checkmark above its own
// picker and nothing in the page reaches them, so on iOS each box is a button
// that presents a real `UIDatePicker`; on the web they stay the inputs
// described above. A plugin failure falls the field back to the input for the
// rest of the session rather than leaving it dead — that is the documented
// symptom of the hand-registration in `LiddBridgeViewController` being lost.
//
// **Bounds are per-field and the time's are day-scoped.** A datetime-local
// clamps the pair as one value; a `<input type="time">` min/max would apply to
// every date, so it is bounded only when the chosen date lands on the min or
// max day. `clamp` is the backstop for a picker that lets the value out of
// range anyway — the call sites clamp on submit too, and that stays.

interface Props {
  /** Local-input form: `YYYY-MM-DDTHH:mm`. */
  value: string;
  onChange: (value: string) => void;
  /** Both in the same local-input form; inclusive. */
  min?: string;
  max?: string;
  /** Names the moment being picked, e.g. "Attack start time" — each field
   *  appends its own half, so a screen reader hears which one it is on. */
  label: string;
  /** The tone the field sits *on*, so the box reads a step apart from it. */
  surface?: 'surface' | 'raised';
  /** Lets a caller revealing this field open the time picker on the same tap
   *  — the time is the half that is usually being changed. A handle rather
   *  than the input element, because on native there is no input to open. */
  openRef?: React.RefObject<DateTimeFieldHandle | null>;
  className?: string;
}

const clamp = (v: string, min?: string, max?: string) =>
  min && v < min ? min : max && v > max ? max : v;

// Lucide, inlined unchanged — the rule for a generic UI affordance, and the
// same contract the drawn icons follow (24×24, no fill, currentColor).
const icon = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
    strokeLinecap="round" strokeLinejoin="round"
    className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true">
    {children}
  </svg>
);
const CalendarIcon = () => icon(<><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>);
const ClockIcon = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);

export interface DateTimeFieldHandle {
  /** Opens the time half — see `openRef`. */
  open: () => void;
}

export function DateTimeField({
  value, onChange, min, max, label, surface = 'surface', openRef, className = '',
}: Props) {
  const timeInput = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  // Set only when the plugin rejects — see the note above. Latching it means
  // one failed call, not one per tap.
  const [nativeFailed, setNativeFailed] = useState(false);
  const native = hasNativeDatePicker() && !nativeFailed;

  const datePart = value.slice(0, 10);
  const timePart = value.slice(11, 16);

  // Only bound the time where the chosen day is itself the boundary: on any
  // day in between, every time of day is in range.
  const timeMin = min && min.slice(0, 10) === datePart ? min.slice(11, 16) : undefined;
  const timeMax = max && max.slice(0, 10) === datePart ? max.slice(11, 16) : undefined;

  const box = surface === 'raised' ? 'bg-bg-surface' : 'bg-bg-raised';
  const boxCls = `relative flex min-w-0 items-center gap-2 rounded-lg border border-border-control ${box} px-3 py-2 text-left text-sm text-text-primary focus-within:ring-2 focus-within:ring-border-subtle focus-visible:ring-2 focus-visible:ring-border-subtle`;
  const inputCls = 'absolute inset-0 h-full w-full cursor-pointer opacity-0';

  const openNative = useCallback(async (mode: 'time' | 'datetime') => {
    const picked = await presentNativeDatePicker({ mode, value, min, max });
    if (picked === null) { setNativeFailed(true); return; }
    onChange(clamp(picked, min, max));
  }, [value, min, max, onChange]);

  const openTime = useCallback(() => {
    if (native) void openNative('time');
    else openPicker(timeInput.current);
  }, [native, openNative]);

  useImperativeHandle(openRef, () => ({ open: openTime }), [openTime]);

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* The date half is the *combined* control in both builds: tapping it
          offers the day and the time together, which is what backdating an
          attack needs. Only the time half is ever narrowed. */}
      <Box className={`${boxCls} flex-[3]`} native={native} label={`${label} — date`}
        onOpen={() => void openNative('datetime')}>
        <CalendarIcon />
        <span className={`truncate ${datePart ? '' : 'text-text-secondary'}`}>
          {datePart ? formatDate(localInputToIso(value)) : 'Pick a date'}
        </span>
        {!native && (
          <input
            ref={dateRef}
            type="datetime-local"
            aria-label={`${label} — date`}
            value={value}
            min={min}
            max={max}
            onChange={(e) => e.target.value && onChange(clamp(e.target.value, min, max))}
            onClick={() => openPicker(dateRef.current)}
            className={inputCls}
          />
        )}
      </Box>

      <Box className={`${boxCls} flex-[2]`} native={native} label={`${label} — time`}
        onOpen={openTime}>
        <ClockIcon />
        <span className={`truncate ${timePart ? '' : 'text-text-secondary'}`}>
          {timePart ? formatTime(localInputToIso(value)) : 'Pick a time'}
        </span>
        {!native && (
          <input
            ref={timeInput}
            type="time"
            aria-label={`${label} — time`}
            value={timePart}
            min={timeMin}
            max={timeMax}
            onChange={(e) => e.target.value && onChange(clamp(`${datePart}T${e.target.value}`, min, max))}
            onClick={() => openPicker(timeInput.current)}
            className={inputCls}
          />
        )}
      </Box>
    </div>
  );
}

// The same drawn box either way: a plain `div` wrapping the transparent input
// on the web, a `button` that presents the native wheel on iOS. Kept as one
// component so the two builds cannot drift apart visually — the classes are
// passed in already built.
function Box({ className, native, label, onOpen, children }: {
  className: string;
  native: boolean;
  label: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  if (!native) return <div className={className}>{children}</div>;
  return (
    <button type="button" aria-label={label} onClick={onOpen} className={className}>
      {children}
    </button>
  );
}
