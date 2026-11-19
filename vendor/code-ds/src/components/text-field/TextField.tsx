import { Field } from '@base-ui/react/field'
import { FieldFrame, controlClasses } from '../field-parts'

// One treatment, so no size or className prop. The label, hint, error and the
// outline are shared with the Select: see field-parts. Single line only, types
// text, email, tel and url, and no placeholder: a placeholder is not a label.

type Common = {
  label: string
  hint?: string
  /** The error to show. Empty or missing means no error. */
  error?: string
  /** A field that is not required says "(optional)" in its label. Default false. */
  required?: boolean
  type?: 'text' | 'email' | 'tel' | 'url'
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal'
  autoComplete?: string
  name?: string
  disabled?: boolean
  autoFocus?: boolean
  onValueChange?: (value: string) => void
}

export type TextFieldProps = Common & ({ value: string; defaultValue?: never } | { value?: never; defaultValue?: string })

export function TextField({ label, hint, error, required = false, onValueChange, disabled, ...rest }: TextFieldProps) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required} disabled={disabled}>
      <Field.Control
        {...rest}
        required={required}
        onValueChange={onValueChange ? (v) => onValueChange(v) : undefined}
        className={controlClasses}
      />
    </FieldFrame>
  )
}
