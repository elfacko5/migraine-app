import { useAnnounce } from '../app-root'
import { iosPress, pressedTint } from '../../styles/pressable'

// A stepper that makes the app's text smaller or larger, one step at a time. It
// only shows the steps and reports the change. The app owns the steps, what each
// one does to the root font size, where it is stored, and every word on it.
//
// Persistent chrome: it must not change size when it is used, or the button under
// the finger would move or grow on a tap. So every size here is a fixed role (a px
// value) and none grows with the text size it sets. Each button is the fixed
// chrome-target size, at least 44pt (Apple HIG). The glyphs illustrate "smaller" and
// "larger"; they are not text meant to scale (WCAG 1.4.4 is about text content).
// The step text ("3 of 6") is real text and is a deliberate exception to the 200%
// rule: it stays a fixed 14px, so the control keeps one size while it changes the
// text size. See docs/decisions.md, "Text-size control: the step text stays fixed".
//
// The corner radius is the fixed chrome role, not the rem-based control radius: at 200% text the
// rem radius is 24px, more than half of a 44px button, and the squares turn into circles.
//
// Two real buttons in a named group. The step is visible text and a row of dots
// with the current one filled (a filled dot against hollow ones, so the current
// step is not shown by colour alone, WCAG 1.4.1), and it is read by a screen
// reader as the group's text (WCAG 1.1.1). The step text reserves the width of the
// widest step, so the control does not change width from step to step.
//
// At either end the button is aria-disabled and dimmed, and stays focusable: with
// a disabled attribute, focus on a button that becomes disabled would be lost
// (WCAG 2.4.3; ARIA APG on disabled buttons). Pressing it does nothing but say the
// app's minLabel or maxLabel. Each change says the app's stepLabel through
// announce(), and focus stays on the button (WCAG 4.1.3). Announcements go into the
// open dialog's own live region when there is one, so the control is heard inside a
// Sheet too. No default text anywhere: the app passes it, as Button does for
// loadingLabel and doneLabel.
//
// Controlled only: value and onValueChange, no state of its own.

export type TextSizeControlProps = {
  /** Names the group for a screen reader, for example "Text size". */
  label: string
  /** The current step, 0-based. */
  value: number
  /** How many steps there are. At least 2. */
  count: number
  /** Called with the next step. The app maps it to a root font size and stores it. */
  onValueChange: (value: number) => void
  /** The name of the smaller button, for example "Decrease text size". */
  decreaseLabel: string
  /** The name of the larger button, for example "Increase text size". */
  increaseLabel: string
  /** The words for a step, shown and announced, for example "3 of 5". */
  stepLabel: (value: number, count: number) => string
  /** Announced when the smaller button is pressed at the smallest step. */
  minLabel: string
  /** Announced when the larger button is pressed at the largest step. */
  maxLabel: string
}

const button = [
  'relative inline-flex size-chrome-target shrink-0 items-center justify-center rounded-(--radius-chrome) bg-surface font-control leading-none text-content ring-1 ring-inset ring-line',
  iosPress,
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'data-[dimmed]:cursor-not-allowed data-[dimmed]:opacity-50',
  pressedTint,
].join(' ')

export function TextSizeControl({
  label,
  value,
  count,
  onValueChange,
  decreaseLabel,
  increaseLabel,
  stepLabel,
  minLabel,
  maxLabel,
}: TextSizeControlProps) {
  const announce = useAnnounce()
  const atMin = value <= 0
  const atMax = value >= count - 1

  const press = (delta: -1 | 1) => {
    const next = value + delta
    if (next < 0) return announce(minLabel)
    if (next > count - 1) return announce(maxLabel)
    onValueChange(next)
    announce(stepLabel(next, count))
  }

  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-(--spacing-textsize-space)">
      <button
        type="button"
        aria-label={decreaseLabel}
        aria-disabled={atMin || undefined}
        data-dimmed={atMin ? '' : undefined}
        data-pressable={atMin ? undefined : ''}
        onClick={() => press(-1)}
        className={button}
      >
        <span aria-hidden="true" className="text-(length:--text-textsize-glyph-small)">
          A
        </span>
      </button>

      <div className="flex flex-col items-center gap-(--spacing-textsize-gap)">
        {/* The widest step sets the width: every step is laid in one grid cell, and only the current one shows. */}
        <span className="inline-grid text-center text-(length:--text-textsize-step) leading-tight tabular-nums">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              aria-hidden={i === value ? undefined : 'true'}
              className={`col-start-1 row-start-1 ${i === value ? '' : 'invisible'}`}
            >
              {stepLabel(i, count)}
            </span>
          ))}
        </span>
        <span aria-hidden="true" className="flex items-center gap-(--spacing-textsize-gap)">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`size-(--spacing-textsize-dot) rounded-full ring-1 ring-inset ring-content ${i === value ? 'bg-content' : ''}`}
            />
          ))}
        </span>
      </div>

      <button
        type="button"
        aria-label={increaseLabel}
        aria-disabled={atMax || undefined}
        data-dimmed={atMax ? '' : undefined}
        data-pressable={atMax ? undefined : ''}
        onClick={() => press(1)}
        className={button}
      >
        <span aria-hidden="true" className="text-(length:--text-textsize-glyph-large)">
          A
        </span>
      </button>
    </div>
  )
}
