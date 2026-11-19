import { useLayoutEffect, useRef, useState } from 'react'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { iosPress, pressedTint } from '../../styles/pressable'
import { segmentBase, segmentSelected, segmentTrack } from '../../styles/segments'

// A segmented control chooses a value, so it is a radio group. If each option has
// its own panel of content, use Tabs instead.
//
// Segments always share the width equally. Labels wrap first and are never
// truncated. The control stacks into one column only when a single word is wider
// than a segment. That is measured on a hidden copy of the row, because the
// words, the width and the text size all change the answer.

const horizontal = 'grid-flow-col auto-cols-fr'

export type SegmentedOption = { value: string; label: string }

type Common = {
  /** Names the choice for a screen reader. The segments are only the values. */
  label: string
  options: readonly SegmentedOption[]
  onValueChange?: (value: string) => void
  disabled?: boolean
}

export type SegmentedControlProps = Common &
  ({ value: string; defaultValue?: never } | { value?: never; defaultValue: string })

export function SegmentedControl({ label, options, onValueChange, disabled = false, ...rest }: SegmentedControlProps) {
  const [stacked, setStacked] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLDivElement>(null)

  // A word wider than its equal share overflows its cell in the hidden copy.
  const check = () => {
    const m = measure.current
    if (m) setStacked([...m.children].some((c) => c.scrollWidth > c.clientWidth + 0.5))
  }
  // After every render, so a change of text size that re-renders the screen is
  // caught at once. Setting the same value again does not render again.
  useLayoutEffect(check)
  // And whenever the width or the text size changes without a render. The probe
  // is 1rem wide, so a change of the root font size resizes it. check only reads
  // refs and sets state, so it is safe to leave out of the dependencies.
  useLayoutEffect(() => {
    const ro = new ResizeObserver(check)
    if (wrap.current) ro.observe(wrap.current)
    if (probe.current) ro.observe(probe.current)
    window.addEventListener('resize', check)
    // A web font that arrives late changes the word widths without changing the
    // box sizes, so neither observer fires. Check again when fonts finish loading.
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    fonts?.addEventListener('loadingdone', check)
    fonts?.ready.then(check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
      fonts?.removeEventListener('loadingdone', check)
    }
  }, [])

  // Stacked neighbours would overlap a hit area, so each stacked segment is the
  // full target height instead.
  const size = stacked
    ? 'min-h-target px-control-compact-x py-1'
    : 'tap-44-y min-h-[calc(var(--spacing-compact)-var(--spacing))] px-control-compact-x py-1'

  return (
    <div ref={wrap} className="relative">
      <RadioGroup
        {...rest}
        aria-label={label}
        disabled={disabled}
        onValueChange={onValueChange ? (v) => onValueChange(v as string) : undefined}
        data-stacked={stacked ? '' : undefined}
        className={`${segmentTrack} grid ${stacked ? 'grid-flow-row' : horizontal} data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50`}
      >
        {options.map((o) => (
          <Radio.Root
            key={o.value}
            value={o.value}
            nativeButton
            render={<button type="button" />}
            data-pressable={disabled ? undefined : ''}
            className={`${segmentBase} ${size} ${iosPress} ${pressedTint} ${segmentSelected('checked')}`}
          >
            {o.label}
          </Radio.Root>
        ))}
      </RadioGroup>
      {/* A hidden copy of the row, side by side, used only to measure. */}
      <div
        ref={measure}
        aria-hidden="true"
        className={`pointer-events-none invisible absolute inset-x-0 top-0 ${segmentTrack} grid ${horizontal}`}
      >
        {options.map((o) => (
          <span key={o.value} className={`${segmentBase} overflow-hidden px-control-compact-x`}>
            {o.label}
          </span>
        ))}
      </div>
      <div ref={probe} aria-hidden="true" className="pointer-events-none invisible absolute size-4" />
    </div>
  )
}
