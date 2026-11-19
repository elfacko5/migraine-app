import { Slider as BaseSlider } from '@base-ui/react/slider'

// One treatment, so no size or className props. min, max and the label are
// required: a slider has no default name and no default scale.
//
// VoiceOver: the thumb holds a native range input, which is the one stop. It
// reads "label, 6 out of 10". The visible label and value are hidden from
// screen readers so they are not a second stop. The input is still named from
// the label through aria-labelledby, which works on a hidden target.
//
// A slider always has a value, so 0 is allowed whenever min is 0. An optional
// answer needs an "unanswered" state around the slider, not inside it.
//
// The Control strip is the touch target. It is as tall as the target role and
// captures touches (touch-action: none), like a native iOS slider.

const root = [
  'group flex w-full flex-col',
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
].join(' ')

const strip = 'relative flex h-target w-full touch-none select-none items-center'

const track = 'relative h-slider-track w-full rounded-full bg-surface ring-1 ring-inset ring-line'

const thumb = [
  'size-slider-thumb rounded-full bg-surface ring-2 ring-accent',
  'transition-transform motion-reduce:transition-none data-[dragging]:scale-110',
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
].join(' ')

type Common = {
  /** The visible label, and the accessible name. */
  label: string
  min: number
  max: number
  /** Default 1. */
  step?: number
  onValueChange?: (value: number) => void
  /** Fires once when a drag, a track press or a key press settles. */
  onValueCommitted?: (value: number) => void
  disabled?: boolean
}

export type SliderProps = Common & ({ value: number; defaultValue?: never } | { defaultValue: number; value?: never })

export function Slider({ label, onValueChange, onValueCommitted, ...rest }: SliderProps) {
  return (
    <BaseSlider.Root
      {...rest}
      thumbAlignment="edge"
      onValueChange={onValueChange ? (v) => onValueChange(v as number) : undefined}
      onValueCommitted={onValueCommitted ? (v) => onValueCommitted(v as number) : undefined}
      className={root}
    >
      <div className="flex items-baseline justify-between gap-3">
        <BaseSlider.Label aria-hidden="true" className="min-w-0 text-base text-content">
          {label}
        </BaseSlider.Label>
        <BaseSlider.Value aria-hidden="true" className="shrink-0 text-base text-content-muted tabular-nums" />
      </div>
      <BaseSlider.Control className={strip}>
        <BaseSlider.Track className={track}>
          <BaseSlider.Indicator className="rounded-full bg-accent" />
          <BaseSlider.Thumb className={thumb} />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
