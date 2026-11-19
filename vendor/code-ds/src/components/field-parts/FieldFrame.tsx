import type { ReactNode } from 'react'
import { Field } from '@base-ui/react/field'

// The parts a Text field and a Select share, so the two stay consistent: the
// label, the hint, the error and the outline of the control. Base UI's Field
// ties the label by for/id and the hint and the error through aria-describedby.
//
// Required is shown as visible text: a field that is not required says
// "(optional)" in its label, as one text node so the name is one plain string.
// No asterisk, and not colour alone. A required field also sets the native
// required attribute, which screen readers read.
//
// The component only displays the error it is given. When to validate, on blur
// or on submit, is the screen's decision.

// overflow-wrap: anywhere, so an unbreakable word such as an email address wraps
// at 200% instead of overflowing.
const root = 'flex w-full flex-col gap-1 [overflow-wrap:anywhere] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

// Outline is a ring (box-shadow). Focus is an outline, like the other controls,
// so focus and error never resize the field. Text is the text-input role, never
// below 16px, or iOS zooms in on focus.
export const controlClasses = [
  'min-h-target w-full rounded-field bg-surface px-3 text-input text-content',
  'ring-1 ring-inset ring-line outline-none',
  'focus:outline-2 focus:outline-offset-2 focus:outline-focus',
  'data-[invalid]:ring-2 data-[invalid]:ring-error',
  'disabled:cursor-not-allowed',
].join(' ')

function ErrorIcon() {
  // Decorative: the message text already carries the meaning.
  return (
    <svg className="mt-0.5 size-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M10 5.5v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1.2" fill="currentColor" />
    </svg>
  )
}

export type FieldFrameProps = {
  label: string
  hint?: string
  /** The error to show. Empty or missing means no error. */
  error?: string
  /** A field that is not required says "(optional)" in its label. Default false. */
  required?: boolean
  disabled?: boolean
  /** The control. It must be a Field.Control, so Base UI can tie the label and messages to it. */
  children: ReactNode
}

export function FieldFrame({ label, hint, error, required = false, disabled, children }: FieldFrameProps) {
  return (
    <Field.Root invalid={!!error} disabled={disabled} className={root}>
      <Field.Label className="text-base text-content">{required ? label : `${label} (optional)`}</Field.Label>
      {hint && <Field.Description className="text-base text-content-muted">{hint}</Field.Description>}
      {children}
      {error && (
        <Field.Error match className="flex gap-2 text-base text-error">
          <ErrorIcon />
          <span className="min-w-0">{error}</span>
        </Field.Error>
      )}
    </Field.Root>
  )
}
