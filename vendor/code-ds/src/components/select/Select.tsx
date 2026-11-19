import { Field } from '@base-ui/react/field'
import { FieldFrame, controlClasses } from '../field-parts'

// A styled native <select>. On iOS it opens the system wheel, which beats any
// custom dropdown. One treatment, so no size or className prop. The label, hint,
// error and outline are shared with the Text field: see field-parts.
//
// The native arrow is removed with appearance: none and replaced by a chevron in
// currentColor, drawn absolutely at the end of the field. It is aria-hidden and
// ignores taps, so the tap reaches the select.
//
// No placeholder prop. When a screen wants an empty first choice, it passes an
// empty option itself, such as { value: '', label: 'Choose one' }.
//
// Known limit of a native select: the closed field cannot wrap its text, so a
// long selected option shows an ellipsis (the picker shows it in full). The
// label above stays visible and wraps.

const select = [
  controlClasses,
  'cursor-pointer appearance-none [-webkit-appearance:none] py-2 pe-10',
  'overflow-hidden text-ellipsis whitespace-nowrap',
].join(' ')

function Chevron() {
  return (
    <svg
      className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-content"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export type SelectOption = { value: string; label: string; disabled?: boolean }

type Common = {
  label: string
  options: SelectOption[]
  hint?: string
  /** The error to show. Empty or missing means no error. */
  error?: string
  /** A field that is not required says "(optional)" in its label. Default false. */
  required?: boolean
  name?: string
  autoComplete?: string
  disabled?: boolean
  onValueChange?: (value: string) => void
}

export type SelectProps = Common & ({ value: string; defaultValue?: never } | { value?: never; defaultValue?: string })

export function Select({ label, options, hint, error, required = false, disabled, onValueChange, ...rest }: SelectProps) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required} disabled={disabled}>
      <div className="relative">
        <Field.Control
          {...rest}
          required={required}
          onValueChange={onValueChange ? (v) => onValueChange(v) : undefined}
          className={select}
          render={
            <select>
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
          }
        />
        <Chevron />
      </div>
    </FieldFrame>
  )
}
