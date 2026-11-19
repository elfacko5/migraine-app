import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppRoot } from '../app-root'
import { iosPress, pressedTint } from '../../styles/pressable'

// A custom Sheet, with no Base UI parts and nothing position: fixed. Base UI's
// modal Dialog renders a full-screen fixed overlay and two fixed focus guards,
// which hard rule 3 does not allow. See docs/decisions.md.
//
// Two kinds, and the pair always agrees:
//   drill-down  enters from the right, back chevron (a step in a flow)
//   interrupt   enters from the bottom, close X (it interrupts what you were doing)
//
// Behind it: the layer below gets aria-hidden, plus inert where supported, and a
// focus loop runs inside the Sheet on every iOS version. Opening moves focus
// into the Sheet first, then hides what held focus. Closing un-hides first, then
// returns focus to the trigger. Escape closes the top layer only.
//
// Keyboard: AppRoot follows the visual viewport and the Sheet fills its frame. The primary action is pinned
// in a footer, and a focused field is scrolled into view in the body. The back
// or close button stays at the top and a very long title scrolls in the header,
// so at 200% text the header never takes over the screen. The title is centred in
// both kinds. A tall interrupt Sheet keeps clear of the status bar: its top edge is
// the safe-area inset plus a gutter below the top of the screen. With no footer the body adds the bottom safe-area inset itself, so
// its end clears the home indicator; with a footer the footer carries it.

const ENTER_MS = 250

const tabbableSelector =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(tabbableSelector)].filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  )
}

/**
 * Scrolls a field to the middle of the Sheet's own body and nothing else. `scrollIntoView` also scrolls
 * every ancestor that can scroll, the overflow-hidden frame and the window included, and with the keyboard
 * rising that moved the whole Sheet up and back (June's phone, 2026-11-16, Safari step 17: a bounce with
 * Reduce Motion on; the frame's scrollTop had reached 46 in the readout).
 */
function centerInBody(body: HTMLElement | null, el: HTMLElement) {
  if (!body) return
  const b = body.getBoundingClientRect()
  const f = el.getBoundingClientRect()
  body.scrollTo({ top: body.scrollTop + (f.top + f.height / 2) - (b.top + b.height / 2), behavior: 'instant' })
}

function isTextEntry(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  return el instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button', 'submit', 'reset'].includes(el.type)
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const panelBase =
  'absolute flex flex-col text-content outline-none transition-transform duration-250 motion-reduce:transition-none'

function Chevron() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Cross() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

export type SheetProps = {
  open: boolean
  /** The screen decides what to do with unsaved data. Escape and the button always call this with false. */
  onOpenChange: (open: boolean) => void
  /** drill-down: from the right, back chevron. interrupt: from the bottom, close X. */
  kind: 'drill-down' | 'interrupt'
  /** The title is the dialog's accessible name. */
  title: string
  /** The scrolling body. */
  children: ReactNode
  /** The pinned primary action. */
  footer?: ReactNode
  /** Interrupt only. Off by default, so a stray tap cannot lose unsaved input. Opt in for pure information sheets. */
  dismissOnBackdropPress?: boolean
  /** The name of the back or close button. Defaults to "Back" or "Close". */
  dismissLabel?: string
}

export function Sheet({ open, onOpenChange, kind, title, children, footer, dismissOnBackdropPress = false, dismissLabel }: SheetProps) {
  const api = useAppRoot()
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const shell = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const change = useRef(onOpenChange)
  useEffect(() => {
    change.current = onOpenChange
  })
  useEffect(() => {
    if (!idRef.current) idRef.current = api.nextId()
  }, [api])

  // Mounting and the enter and exit animation. With reduce motion on there is no
  // slide and no fade: the Sheet appears and disappears at once.
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
      return () => cancelAnimationFrame(raf)
    }
    setEntered(false)
    const t = setTimeout(() => setMounted(false), reducedMotion() ? 0 : ENTER_MS + 20)
    return () => clearTimeout(t)
  }, [open])

  // The layer: focus, what is behind, Escape and the focus loop.
  useEffect(() => {
    const sh = shell.current
    const pn = panel.current
    if (!open || !mounted || !sh || !pn || !api.frame) return
    const id = idRef.current || (idRef.current = api.nextId())
    // The trigger. Safari does not focus a button when it is tapped, so focus is
    // on the body, or on the Sheet we are being opened from. Then the last
    // pressed element is the trigger.
    const active = document.activeElement
    const unhelpful = !active || active === document.body || active.getAttribute('role') === 'dialog'
    const opener = (unhelpful ? api.lastPressed() : active) as HTMLElement | null

    // 1. Focus moves into the Sheet. 2. Only then is what held focus hidden.
    pn.focus({ preventScroll: true })
    api.register(id, sh, pn.querySelector<HTMLElement>('[data-layer-live]'))

    const onKeyDown = (e: KeyboardEvent) => {
      if (!api.isTop(id)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        change.current(false)
        return
      }
      if (e.key !== 'Tab') return
      const items = tabbables(pn)
      if (items.length === 0) {
        e.preventDefault()
        pn.focus({ preventScroll: true })
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      if (!pn.contains(current)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (current === first || current === pn)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }
    const onFocusIn = (e: FocusEvent) => {
      if (!api.isTop(id) || pn.contains(e.target as Node)) return
      ;(tabbables(pn)[0] ?? pn).focus({ preventScroll: true })
    }
    // A focused field is scrolled to the middle of the body once the keyboard is up.
    let timer: number | undefined
    const onFieldFocus = (e: FocusEvent) => {
      const t = e.target
      if (!isTextEntry(t as Element)) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => centerInBody(body.current, t as HTMLElement), 350)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    pn.addEventListener('focusin', onFieldFocus)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      pn.removeEventListener('focusin', onFieldFocus)
      window.clearTimeout(timer)
      // 1. What is behind is un-hidden. 2. Only then does focus return.
      api.unregister(id, opener)
    }
  }, [open, mounted, api])

  // The keyboard: AppRoot follows the visual viewport and the Sheet fills the frame. When the
  // visible height changes, scroll a focused text field into the middle of the body.
  useEffect(() => {
    if (!mounted) return
    return api.onVisibleChange((why) => {
      if (why !== 'resize') return
      const a = document.activeElement
      if (isTextEntry(a) && body.current?.contains(a)) centerInBody(body.current, a)
    })
  }, [mounted, api])

  if (!mounted || !api.frame) return null

  const drill = kind === 'drill-down'
  const label = dismissLabel ?? (drill ? 'Back' : 'Close')
  // The button sits in a box as tall as the title's first row (never under 44px)
  // and is centred in it. The title's top padding centres its first line in the
  // same row, so both share one centre at every text size.
  const dismiss = (
    <div className="flex h-(--title-row) shrink-0 items-center">
      <button
        type="button"
        aria-label={label}
        onClick={() => onOpenChange(false)}
        data-pressable=""
        className={`flex size-chrome-target shrink-0 items-center justify-center rounded-(--radius-chrome) text-content ${iosPress} ${pressedTint} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
      >
        {drill ? <Chevron /> : <Cross />}
      </button>
    </div>
  )

  // An empty box as wide as the button, on the other side, so the title is centred.
  const spacer = <div aria-hidden="true" className="size-chrome-target shrink-0" />

  return createPortal(
    <div ref={shell} data-sheet-shell className="absolute top-0 left-0 h-full w-full">
      {!drill && (
        <div
          aria-hidden="true"
          onClick={dismissOnBackdropPress ? () => onOpenChange(false) : undefined}
          className={`absolute inset-0 bg-scrim transition-opacity duration-250 motion-reduce:transition-none ${entered ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          drill
            ? `${panelBase} bg-surface inset-0 ${entered ? 'translate-x-0' : 'translate-x-full'}`
            : `${panelBase} bg-surface-raised inset-x-0 bottom-0 max-h-[calc(100%-env(safe-area-inset-top)-var(--spacing-gutter-wide))] rounded-t-sheet ${entered ? 'translate-y-0' : 'translate-y-full'}`
        }
      >
        <header className={`flex shrink-0 items-start gap-2 px-gutter [--title-line:calc(var(--text-lg)*var(--text-lg--line-height))] [--title-row:max(var(--spacing-chrome-target),calc(var(--title-line)+var(--spacing)*4))] ${drill ? 'pt-[env(safe-area-inset-top)]' : 'pt-2'}`}>
          {drill ? dismiss : spacer}
          <h2 id={titleId} className="max-h-[40dvh] min-w-0 flex-1 overflow-y-auto pt-[calc((var(--title-row)-var(--title-line))/2)] pb-2 text-center text-lg font-heading [overflow-wrap:anywhere]">
            {title}
          </h2>
          {drill ? spacer : dismiss}
        </header>
        <div ref={body} data-sheet-body className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter ${footer ? 'py-2' : 'pt-2 pb-[calc(var(--spacing)*2+env(safe-area-inset-bottom))]'}`}>
          {children}
        </div>
        {footer && (
          <footer className="shrink-0 border-t border-divider px-gutter pt-3 pb-[max(env(safe-area-inset-bottom),calc(var(--spacing)*3))]">
            {footer}
          </footer>
        )}
        {/* Inside the dialog, so a screen reader that honours aria-modal still hears it (see AppRoot). */}
        <div role="status" aria-live="polite" aria-atomic="true" data-layer-live className="absolute top-0 left-0 size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" />
      </section>
    </div>,
    api.frame,
  )
}
