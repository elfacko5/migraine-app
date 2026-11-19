import type { ReactNode } from 'react'
import { Switch as BaseSwitch } from '@base-ui/react/switch'

// One treatment for every switch, so there is no size or className prop.
// The label sits inside the button, so the accessible name comes from the
// content and is read once. Do not add aria-labelledby for text inside it.
// The label sits in a span, and the row wraps: the label wraps beside the track
// while its longest word fits there, and when it does not the track drops to its
// own line below the label, at the end. So the row never clips, at any text size
// and in any look (a wide gutter included). The span is plain text to a screen
// reader, so the name is still read once.
// Track and thumb sizes are the switch roles in roles.css.

const row = [
  'group tap-44-y relative flex w-full cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-2',
  'rounded-control py-2 text-left text-base text-content',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
].join(' ')

// The label's basis is its longest word (min-content), so beside the track it
// wraps by word as before, and only when even that word does not fit does the
// track go below. A word longer than the row breaks instead of clipping.
const label = 'min-w-0 grow basis-[min-content] [overflow-wrap:break-word]'

// Off: a surface track with a ring. On: the filled accent track. The state is
// the fill and the thumb position, not colour alone: grayscale still shows it.
const track = [
  'relative ml-auto h-switch-h w-switch-w shrink-0 rounded-full bg-surface ring-1 ring-inset ring-line',
  'transition-[background-color,box-shadow] motion-reduce:transition-none',
  'group-data-[checked]:bg-accent group-data-[checked]:ring-accent',
].join(' ')

// The thumb is placed explicitly (absolute, left inset, translate by travel).
// Nothing depends on the button's text alignment.
const thumb = [
  'absolute left-switch-inset top-1/2 size-switch-thumb -translate-y-1/2 rounded-full bg-line',
  'transition-[translate,background-color] motion-reduce:transition-none',
  'data-[checked]:translate-x-(--spacing-switch-travel) data-[checked]:bg-on-accent',
].join(' ')

export type SwitchProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  /** The visible label. It wraps at large text sizes. The switch never shrinks. */
  children: ReactNode
}

export function Switch({ onCheckedChange, children, ...rest }: SwitchProps) {
  return (
    <BaseSwitch.Root
      {...rest}
      nativeButton
      render={<button type="button" />}
      onCheckedChange={onCheckedChange ? (c) => onCheckedChange(c) : undefined}
      className={row}
    >
      <span className={label}>{children}</span>
      <span className={track}>
        <BaseSwitch.Thumb className={thumb} />
      </span>
    </BaseSwitch.Root>
  )
}
