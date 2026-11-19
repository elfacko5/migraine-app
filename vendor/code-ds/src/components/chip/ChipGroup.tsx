import { createContext, useContext, type ReactNode } from 'react'
import { RadioGroup } from '@base-ui/react/radio-group'
import { ToggleGroup } from '@base-ui/react/toggle-group'

export type ChipGroupType = 'one' | 'any'

const ChipGroupContext = createContext<ChipGroupType | null>(null)

export function useChipGroupType(): ChipGroupType {
  const type = useContext(ChipGroupContext)
  if (!type) throw new Error('Chip must be used inside a ChipGroup. Use ChipToggle for a lone boolean.')
  return type
}

type Common = {
  /** Every group needs a name for screen readers. Pass one of these two. */
  'aria-label'?: string
  'aria-labelledby'?: string
  disabled?: boolean
  children: ReactNode
}

export type ChipGroupProps =
  | (Common & {
      /** Pick one: a radio group. */
      type: 'one'
      value?: string | null
      defaultValue?: string | null
      onValueChange?: (value: string) => void
    })
  | (Common & {
      /** Pick any: toggle buttons that report aria-pressed. */
      type: 'any'
      value?: string[]
      defaultValue?: string[]
      onValueChange?: (value: string[]) => void
    })

const layout = 'relative flex flex-wrap gap-chip-gap'

export function ChipGroup(props: ChipGroupProps) {
  if (props.type === 'one') {
    const { type, value, defaultValue, onValueChange, ...rest } = props
    return (
      <ChipGroupContext.Provider value={type}>
        <RadioGroup
          {...rest}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange ? (v) => onValueChange(v as string) : undefined}
          className={layout}
        />
      </ChipGroupContext.Provider>
    )
  }
  const { type, value, defaultValue, onValueChange, ...rest } = props
  return (
    <ChipGroupContext.Provider value={type}>
      <ToggleGroup
        {...rest}
        multiple
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange ? (v) => onValueChange(v) : undefined}
        className={layout}
      />
    </ChipGroupContext.Provider>
  )
}
