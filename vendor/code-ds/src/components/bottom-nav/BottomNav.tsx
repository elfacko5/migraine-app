import { Children, type ReactNode } from 'react'

// The tab bar at the foot of the app. It is in the flow: the app frame is a
// column, the scroll box takes the remaining height (flex-1, min-h-0) and this
// bar sits below it. So the page ends above the bar by layout, nothing scrolls
// under it, and a focused control is never hidden by it. Never position: fixed
// (clipped by an iOS WebKit bug in Capacitor apps), and not absolute either.
//
// A nav landmark with a name, and a list of buttons. The current destination is
// aria-current="page", and is told apart by a heavier label as well as its
// colour and by a short line above its icon (a shape, so not colour alone). Persistent chrome: the label and icon stop growing at a cap role, so
// every destination stays reachable at 200% text, and each item is at least
// 44pt (the fixed chrome-target role, not the target role, which grows with the text). The item has no side padding, so a destination name of a normal length fits its slot. A label too long for its slot ends in an ellipsis (min-w-0 lets the slot
// shrink instead of pushing its neighbours off the screen); its full text stays
// in the DOM, so the accessible name is whole. The bar is opaque, with a lighter edge on top. The bottom padding is a
// role plus the safe-area inset, and the left and right insets pad the row in
// landscape.
//
// The middle action is one control with an accessible name, such as a menu
// button. A menu behind it is a separate component. The app sizes the control
// with size-nav-action, which stops growing with the text like the rest of the
// bar: at 200% an action that scales pushes a destination off the screen.

export type BottomNavItem = {
  id: string
  /** Shown under the icon, and the item's name. */
  label: string
  /** Decorative, in currentColor. Hidden from screen readers. */
  icon: ReactNode
}

export type BottomNavProps = {
  /** Names the landmark for a screen reader, for example "Main". */
  label: string
  /** Two to four with an action, up to five without. */
  items: readonly BottomNavItem[]
  /** The id of the current destination. */
  value: string
  onValueChange: (id: string) => void
  /** One control with an accessible name, placed in the middle. */
  action?: ReactNode
}

const dev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV

function Item({ item, current, onSelect }: { item: BottomNavItem; current: boolean; onSelect: () => void }) {
  return (
    <li className="min-w-0 flex-1">
      <button
        type="button"
        onClick={onSelect}
        aria-current={current ? 'page' : undefined}
        className={`relative flex min-h-chrome-target w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-(--spacing-nav-gap) px-0 pt-(--spacing-nav-item-top) pb-0 text-(length:--text-nav-label) leading-tight focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${current ? 'font-control text-accent' : 'font-medium text-content-muted'}`}
      >
        {/* A line along the top of the current item, as wide as its slot less an inset on each side: a shape cue, not colour alone. Drawn on every item and shown only on the current one (opacity), and absolutely placed in the top padding, so nothing changes size or shifts when the current item changes. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-(--spacing-nav-mark-inset) top-0 h-(--spacing-nav-mark-thickness) rounded-b-full bg-accent ${current ? 'opacity-100' : 'opacity-0'}`}
        />
        <span aria-hidden="true" className="flex size-(--spacing-nav-icon) items-center justify-center [&>svg]:size-full">
          {item.icon}
        </span>
        <span className="max-w-full truncate">{item.label}</span>
      </button>
    </li>
  )
}

export function BottomNav({ label, items, value, onValueChange, action }: BottomNavProps) {
  const hasAction = action != null && Children.count(action) > 0
  if (dev) {
    const max = hasAction ? 4 : 5
    if (items.length < 2 || items.length > max) {
      console.warn(`BottomNav: ${items.length} items. Use 2 to ${max}${hasAction ? ' with an action' : ''}, or the targets fall under 44pt on a phone.`)
    }
  }
  const half = Math.ceil(items.length / 2)
  const left = hasAction ? items.slice(0, half) : items
  const right = hasAction ? items.slice(half) : []
  const render = (list: readonly BottomNavItem[]) =>
    list.map((item) => <Item key={item.id} item={item} current={item.id === value} onSelect={() => onValueChange(item.id)} />)

  return (
    <nav
      aria-label={label}
      className="shrink-0 border-t border-divider bg-surface"
      style={{
        paddingBottom: 'calc(var(--spacing-nav-bottom) + env(safe-area-inset-bottom))',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <ul className="mx-auto flex w-full max-w-2xl items-center">
        {render(left)}
        {hasAction && <li className="flex flex-1 justify-center">{action}</li>}
        {render(right)}
      </ul>
    </nav>
  )
}
