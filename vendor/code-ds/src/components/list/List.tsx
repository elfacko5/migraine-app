import type { ReactNode } from 'react'
import { iosPress, pressedTint } from '../../styles/pressable'

// A List is a <ul role="list"> (Safari drops the list semantics without the
// role) in a card. A row is static (text only) or pressable (a native button that
// fills the row and ends in a chevron). The DOM order is the visual order and the
// reading order: leading icon (hidden), label, value, supporting text, chevron
// (hidden).
//
// A row never contains another interactive element. A row with a toggle is the
// Switch, which is already a full-row control: pass it as the child of a bare
// row. An action that does something in place is a Button, not a row.
//
// The pressed tint, its pressable guard and the iOS settings are shared with the
// Button (src/styles/pressable.ts). The card clips the tint to its rounded
// corners, so the focus ring is drawn inset. Dividers are drawn without borders,
// so the first row is as tall as the others.

const list = [
  'overflow-hidden rounded-card bg-surface ring-1 ring-inset ring-divider',
  // The Switch fills its row like any other row: its own padding and square
  // corners, the row's minimum height, and an inset focus ring.
  '[&_[role=switch]]:min-h-target [&_[role=switch]]:rounded-none [&_[role=switch]]:px-card',
  '[&_[role=switch]:focus-visible]:-outline-offset-2',
].join(' ')

export function List({ children }: { children: ReactNode }) {
  return (
    <ul role="list" className={list}>
      {children}
    </ul>
  )
}

// The first and last row follow the card's rounded corners, so the inset focus
// ring follows them too instead of being cut by the card.
const item = [
  'relative not-first:before:absolute not-first:before:inset-x-0 not-first:before:top-0 not-first:before:h-px not-first:before:bg-divider',
  'first:[&>*]:rounded-t-card last:[&>*]:rounded-b-card',
].join(' ')

const layout = 'flex min-h-target w-full items-center gap-3 px-card py-control-compact-y text-left text-base leading-tight'

const pressable = [
  layout,
  iosPress,
  pressedTint,
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
  'data-[dimmed]:cursor-not-allowed data-[dimmed]:opacity-50',
].join(' ')

function Chevron() {
  return (
    <svg className="size-5 shrink-0 text-content-muted" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export type ListRowProps = {
  /** The label. */
  children?: ReactNode
  /** A second line under the label. */
  supporting?: string
  /** Trailing text, such as "On". */
  value?: string
  /** A decorative icon in currentColor. Hidden from screen readers. */
  leading?: ReactNode
  /** Makes the row pressable: a button with a chevron. Without it the row is static. */
  onClick?: () => void
  disabled?: boolean
  /** The row's content is its own control, such as a Switch. Only the padding, height and divider apply. */
  bare?: boolean
}

export function ListRow({ children, supporting, value, leading, onClick, disabled = false, bare = false }: ListRowProps) {
  if (bare) {
    return <li className={`${item} flex min-h-target items-stretch`}>{children}</li>
  }
  const content = (
    <>
      {leading && <span aria-hidden="true" className="shrink-0 text-content-muted [&>svg]:size-6">{leading}</span>}
      {/* The order here is the visual order and the reading order: the label, the
          value on the label's line (or just under it when there is no room), then
          the supporting text under both. The label asks for a minimum width, so at
          large text the value drops under it instead of squeezing the label to
          nothing. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 [overflow-wrap:anywhere]">
        <span className="min-w-[min(100%,calc(var(--spacing)*30))] flex-1 text-content">{children}</span>
        {value && <span className="ml-auto max-w-full text-right text-content-muted">{value}</span>}
        {supporting && <span className="basis-full text-content-muted">{supporting}</span>}
      </span>
    </>
  )
  if (!onClick) {
    return <li className={`${item} ${layout}`}>{content}</li>
  }
  return (
    <li className={item}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onClick()}
        data-dimmed={disabled ? '' : undefined}
        data-pressable={disabled ? undefined : ''}
        className={pressable}
      >
        {content}
        <Chevron />
      </button>
    </li>
  )
}
