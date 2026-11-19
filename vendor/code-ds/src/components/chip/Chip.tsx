import type { ReactNode } from 'react'
import { Radio } from '@base-ui/react/radio'
import { Toggle } from '@base-ui/react/toggle'
import { useChipGroupType } from './ChipGroup'
import { chipBase, chipOn } from './chipStyles'
import { CheckMark, PlusMark, RadioMark } from './glyphs'

// No className prop on purpose: height, radius and gap come from the roles.

export type ChipProps = {
  value: string
  disabled?: boolean
  children: ReactNode
}

/** A choice inside a ChipGroup. Radio for pick one, toggle button for pick any. */
export function Chip({ value, disabled, children }: ChipProps) {
  const type = useChipGroupType()
  if (type === 'one') {
    return (
      <Radio.Root
        value={value}
        disabled={disabled}
        nativeButton
        render={<button type="button" />}
        className={`${chipBase} ${chipOn('checked')}`}
      >
        <RadioMark />
        {children}
      </Radio.Root>
    )
  }
  return (
    <Toggle value={value} disabled={disabled} className={`${chipBase} ${chipOn('pressed')}`}>
      <CheckMark />
      {children}
    </Toggle>
  )
}

export type ChipToggleProps = {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  disabled?: boolean
  children: ReactNode
}

/** A lone yes/no chip, such as "Woke up with this migraine". aria-pressed. */
export function ChipToggle({ onPressedChange, children, ...rest }: ChipToggleProps) {
  return (
    <Toggle
      {...rest}
      onPressedChange={onPressedChange ? (p) => onPressedChange(p) : undefined}
      className={`${chipBase} ${chipOn('pressed')}`}
    >
      <CheckMark />
      {children}
    </Toggle>
  )
}

export type ChipButtonProps = {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}

/** An action that looks like a chip, such as "Add custom". It holds no state. */
export function ChipButton({ onClick, disabled, children }: ChipButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-disabled={disabled ? '' : undefined}
      className={chipBase}
    >
      <PlusMark />
      {children}
    </button>
  )
}
