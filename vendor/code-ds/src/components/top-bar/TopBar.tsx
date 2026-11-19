import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// The page header: the title, an optional action and an optional control that
// stays visible while the page scrolls.
//
// Place it as the first child of the scroll box and as a sibling before <main>,
// never inside it. A header inside main is not the page's banner, and a bar
// beside the scroll box overflows the frame.
//
// Sticky, opaque, and no more than 25% of the visual viewport: if the bar in its
// tall state (title shown) would take more, it scrolls with the page, and it
// turns sticky again only below 22%. The tall state is measured on a hidden copy
// that holds only the title text and spacers, never the action or the control,
// so nothing interactive is duplicated.
//
// While sticky, the bar writes scroll-padding-top on its parent (the scroll box)
// from its live height, so a focused control is never hidden behind it.
//
// No tertiary Button in action or control. The action is an icon-only button with
// an accessible name, a secondary Button, or one primary Button. The package
// cannot inspect a node, so that is a lint rule for phase 8.
//
// A TextSizeControl goes in `control`, not `action`: at 200% it is 160px wide and leaves a normal title about 60px, which breaks into one or two letters a line (June, 2026-11-09).

const OFF = 0.25
const ON = 0.22

export type TopBarProps = {
  /** The page title. Always rendered as the page's one h1. */
  title: string
  /** An icon-only button with a name, a secondary Button, or one primary Button. Never tertiary. */
  action?: ReactNode
  /** Stays visible while the page scrolls, for example a Segmented control or a TextSizeControl (not `action`: too wide beside the title at 200%). */
  control?: ReactNode
  /**
   * Gives the title row to the control and keeps the title as screen-reader-only
   * text. The app decides when. It does nothing without a control.
   */
  titleHidden?: boolean
}

const dev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV

// The title's first line sits in a box at least as tall as the 44px action, so the
// action and the first line share one centre at every text size.
const vars = {
  '--title-line': 'calc(var(--text-title) * var(--text-title--line-height))',
  '--first-line': 'max(var(--spacing-chrome-target), var(--title-line))',
} as React.CSSProperties

const inset = {
  paddingLeft: 'env(safe-area-inset-left)',
  paddingRight: 'env(safe-area-inset-right)',
}

// A wrapping row, so the action yields before the title breaks a word: the title's
// flex basis is its longest word, and when that word plus the action does not fit
// on one line the action drops below the title, at the end. A word longer than the
// row still breaks, as a last resort.
const row = 'mx-auto flex max-w-2xl flex-wrap items-start gap-x-3 gap-y-2 px-gutter sm:px-gutter-wide'
const titleClass =
  'min-h-(--first-line) min-w-0 grow basis-[min-content] [overflow-wrap:break-word] pt-[calc((var(--first-line)-var(--title-line))/2)] text-title font-title text-content'

export function TopBar({ title, action, control, titleHidden = false }: TopBarProps) {
  const hasAction = action != null
  const hasControl = control != null
  const collapsed = titleHidden && hasControl
  const [sticky, setSticky] = useState(true)
  const stickyRef = useRef(true)
  const previous = useRef('')
  const bar = useRef<HTMLElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const spacer = useRef<HTMLDivElement>(null)
  const controlSpacer = useRef<HTMLDivElement>(null)
  const actionBox = useRef<HTMLDivElement>(null)
  const controlBox = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = bar.current
    const parent = el?.parentElement
    if (!el || !parent) return
    if (dev) {
      const o = getComputedStyle(parent).overflowY
      if (o !== 'auto' && o !== 'scroll') {
        console.warn('TopBar: its parent is not a scroll box (overflow-y auto or scroll). Make it the first child of the scroll box.')
      }
    }
    // What the app had set, restored whenever the bar stops writing.
    previous.current = parent.style.scrollPaddingTop

    const padding = () => {
      parent.style.scrollPaddingTop = stickyRef.current ? `${el.getBoundingClientRect().height}px` : previous.current
    }
    const measure = () => {
      const c = copy.current
      if (!c) return
      // The copy reserves the real action's width, and the real control's height.
      if (spacer.current) spacer.current.style.width = `${actionBox.current?.offsetWidth ?? 0}px`
      if (controlSpacer.current) controlSpacer.current.style.height = `${controlBox.current?.offsetHeight ?? 0}px`
      const viewport = window.visualViewport?.height ?? window.innerHeight
      // Fractional heights: an integer height rounds 132.4px to 132 and misses the line.
      const ratio = c.getBoundingClientRect().height / viewport
      if (stickyRef.current && ratio > OFF) {
        stickyRef.current = false
        setSticky(false)
      } else if (!stickyRef.current && ratio < ON) {
        stickyRef.current = true
        setSticky(true)
      }
      padding()
    }

    measure()
    const ro = new ResizeObserver(measure)
    // The scroll box too: a change of the frame's height reaches it even when no viewport event is sent.
    for (const n of [el, parent, copy.current, actionBox.current, controlBox.current]) if (n) ro.observe(n)
    window.visualViewport?.addEventListener('resize', measure)
    window.addEventListener('resize', measure)
    // The padding transition can end after the last size change is reported.
    el.addEventListener('transitionend', measure)
    return () => {
      ro.disconnect()
      window.visualViewport?.removeEventListener('resize', measure)
      window.removeEventListener('resize', measure)
      el.removeEventListener('transitionend', measure)
      parent.style.scrollPaddingTop = previous.current
    }
  }, [hasAction, hasControl])

  // The padding follows the sticky state when it changes without a resize.
  useLayoutEffect(() => {
    const el = bar.current
    const parent = el?.parentElement
    if (!el || !parent) return
    stickyRef.current = sticky
    parent.style.scrollPaddingTop = sticky ? `${el.getBoundingClientRect().height}px` : previous.current
  }, [sticky])

  const top = collapsed ? 'var(--spacing-bar-top-compact)' : 'var(--spacing-bar-top)'

  return (
    <header
      ref={bar}
      className={`${sticky ? 'sticky top-0' : 'relative'} z-10 bg-surface pb-2 transition-[padding-top] duration-300 ease-out motion-reduce:transition-none`}
      style={{ ...vars, ...inset, paddingTop: `calc(${top} + env(safe-area-inset-top))` }}
    >
      {/* The tall state, never shown: the title text, a spacer as wide as the action and one as tall as the control. */}
      <div
        ref={copy}
        aria-hidden="true"
        inert
        className="pointer-events-none invisible absolute inset-x-0 top-0 pb-2"
        style={{ ...inset, paddingTop: 'calc(var(--spacing-bar-top) + env(safe-area-inset-top))' }}
      >
        <div className={row}>
          <div className={titleClass}>{title}</div>
          {action != null && <div ref={spacer} className="ml-auto h-(--first-line) min-w-(--spacing-chrome-target)" />}
        </div>
        {control != null && (
          <div className="mx-auto max-w-2xl px-gutter pt-3 sm:px-gutter-wide">
            <div ref={controlSpacer} />
          </div>
        )}
      </div>

      <div className={row}>
        {/* The DOM order follows the screen in each state. Keyed, so the control and the action keep their state when they swap places. */}
        {(collapsed ? ['title', 'control', 'action'] : ['title', 'action', 'control']).map((k) => {
          if (k === 'title')
            return (
              <h1 key="title" className={collapsed ? 'sr-only' : titleClass}>
                {title}
              </h1>
            )
          if (k === 'action')
            return (
              action != null && (
                <div
                  key="action"
                  ref={actionBox}
                  className="ml-auto flex h-(--first-line) items-center gap-2 self-start"
                >
                  {action}
                </div>
              )
            )
          return (
            control != null && (
              <div
                key="control"
                className={
                  collapsed
                    ? 'self-center'
                    : 'basis-full pt-3'
                }
              >
                <div ref={controlBox}>{control}</div>
              </div>
            )
          )
        })}
      </div>
    </header>
  )
}
