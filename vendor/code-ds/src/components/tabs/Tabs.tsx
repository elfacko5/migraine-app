import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { iosPress, pressedTint } from '../../styles/pressable'
import { segmentBase, segmentSelected, segmentTrack } from '../../styles/segments'

// Tabs switch between panels: each option owns a panel of content. If an option
// only changes what the same content shows, use a Segmented control instead.
//
// Built on Base UI Tabs (roles, ids, arrow keys, Home and End). The look is the
// Segmented control's, from src/styles/segments.ts. Nothing slides: the panel and
// the selection change at once. Activation is manual: the arrow keys and a
// VoiceOver swipe only move focus, and Enter, Space or a double tap selects. With
// automatic activation a swipe selected each tab before VoiceOver read it, so a
// person heard "tab" with no "selected" while the selection was changing under
// them (June's phone check, 2026-11-06). WAI-ARIA APG Tabs allows both, and
// prefers automatic only when the panel shows with no delay and no side effect.
//
// Labels wrap first and are never truncated. The list stacks into one column only
// when a single word is wider than its equal share, measured on a hidden copy of
// the row, and then aria-orientation is vertical so Up and Down move between tabs.

const horizontal = 'grid-flow-col auto-cols-fr'

export type TabOption = { value: string; label: string; disabled?: boolean }

type Common = {
  /** Names the tab list for a screen reader. Required, no default. */
  label: string
  tabs: readonly TabOption[]
  onValueChange?: (value: string) => void
  /** One <TabsPanel value=...> for each tab. */
  children: ReactNode
}

export type TabsProps = Common & ({ value: string; defaultValue?: never } | { value?: never; defaultValue: string })

export function Tabs({ label, tabs, onValueChange, children, ...rest }: TabsProps) {
  const [stacked, setStacked] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLDivElement>(null)

  // A word wider than its equal share overflows its cell in the hidden copy.
  const check = () => {
    const m = measure.current
    if (m) setStacked([...m.children].some((c) => c.scrollWidth > c.clientWidth + 0.5))
  }
  useLayoutEffect(check)
  // The probe is 1rem wide, so a change of the root font size resizes it.
  useLayoutEffect(() => {
    const ro = new ResizeObserver(check)
    if (wrap.current) ro.observe(wrap.current)
    if (probe.current) ro.observe(probe.current)
    window.addEventListener('resize', check)
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    fonts?.addEventListener('loadingdone', check)
    fonts?.ready.then(check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
      fonts?.removeEventListener('loadingdone', check)
    }
  }, [])

  // Stacked neighbours would overlap a hit area, so each stacked tab is the full
  // target height instead.
  const size = stacked
    ? 'min-h-target px-control-compact-x py-1'
    : 'tap-44-y min-h-[calc(var(--spacing-compact)-var(--spacing))] px-control-compact-x py-1'

  return (
    <BaseTabs.Root
      {...rest}
      orientation={stacked ? 'vertical' : 'horizontal'}
      onValueChange={onValueChange ? (v) => onValueChange(v as string) : undefined}
    >
      <div ref={wrap} className="relative">
        <BaseTabs.List
          aria-label={label}
          data-stacked={stacked ? '' : undefined}
          className={`${segmentTrack} grid ${stacked ? 'grid-flow-row' : horizontal}`}
        >
          {tabs.map((t, i) => (
            <BaseTabs.Tab
              key={t.value}
              value={t.value}
              disabled={t.disabled}
              aria-posinset={i + 1}
              aria-setsize={tabs.length}
              data-pressable={t.disabled ? undefined : ''}
              className={`${segmentBase} ${size} ${iosPress} ${pressedTint} ${segmentSelected('active')} data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50`}
            >
              {t.label}
            </BaseTabs.Tab>
          ))}
        </BaseTabs.List>
        {/* A hidden copy of the row, side by side, used only to measure. */}
        <div
          ref={measure}
          aria-hidden="true"
          className={`pointer-events-none invisible absolute inset-x-0 top-0 ${segmentTrack} grid ${horizontal}`}
        >
          {tabs.map((t) => (
            <span key={t.value} className={`${segmentBase} overflow-hidden px-control-compact-x`}>
              {t.label}
            </span>
          ))}
        </div>
        <div ref={probe} aria-hidden="true" className="pointer-events-none invisible absolute size-4" />
      </div>
      {children}
    </BaseTabs.Root>
  )
}

export type TabsPanelProps = { value: string; children: ReactNode }

/** The content for one tab. Hidden from screen readers and from the page while its tab is not selected. */
export function TabsPanel({ value, children }: TabsPanelProps) {
  return (
    <BaseTabs.Panel
      value={value}
      className="mt-3 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </BaseTabs.Panel>
  )
}
