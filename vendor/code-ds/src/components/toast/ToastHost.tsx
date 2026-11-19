import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

// One toast at a time, rendered by AppRoot beside the live region: never inside a
// layer and never registered as one, so no Sheet hides it and inert never reaches
// it. It is absolute (never fixed), above everything by the --z-toast role, and it
// follows the visual viewport as the Sheet does.
//
// A toast is a status message. It is announced through AppRoot's live region and
// never takes focus, so the visible toast is aria-hidden, holds nothing focusable,
// and does not take a touch (pointer-events: none). It has no error kind: an error
// is shown by the form or the screen, because a message that vanishes on a timer
// cannot be the only place a person can read it (WCAG 2.2.1, 3.3.1).
//
// Position: the top of the visible area under the safe area. Over a Sheet whose
// header (back or close button and title) is at the top, it sits just below that
// header instead, so the way out and the title stay clear (June, 2026-11-09). If
// that would cover the control in use, it goes to the bottom. The control in use is the element of
// the more recent of the latest focusin and the latest pointerdown, by timestamp,
// ignored once it is no longer in the document. Safari does not focus a tapped
// button, so pointerdown is needed, and a keyboard press moves no pointer, so
// focusin is needed. The rule re-runs while the toast shows.
//
// Look: inverse (June, 2026-11-09, "B is definitely the easiest too see"). The
// content colour is the background and the surface colour is the text, so it reads
// as a separate object over a field in light and in dark, with no new role. The
// check icon takes the text colour; success is the icon shape and the words.
//
// Time: at least 5 seconds and longer for more text. It pauses while the page is
// hidden (iOS suspends timers in a web view) and resumes when it is visible. A new
// toast replaces the old one, after a short blank. Nothing moves: it appears and goes at once.

export type ToastKind = 'info' | 'success'

export type ToastOptions = {
  /** `success` adds a check icon. `info` is text only. */
  kind?: ToastKind
  /** Milliseconds on screen. The default is at least 5000 and grows with the text. */
  duration?: number
}

export type ToastApi = { show: (message: string, options?: ToastOptions) => void }

export type ToastHandle = ToastApi

type Current = { id: number; message: string; kind: ToastKind }

const MIN_MS = 5000
const REPLACE_GAP_MS = 250
const defaultDuration = (text: string) => Math.max(MIN_MS, 2000 + 60 * text.length)

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

export const ToastHost = forwardRef<ToastHandle, { announce: (text: string) => void; onVisibleChange: (fn: (why: 'resize' | 'move') => void) => () => void }>(function ToastHost(
  { announce, onVisibleChange },
  ref,
) {
  const [current, setCurrent] = useState<Current | null>(null)
  const layer = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const counter = useRef(0)
  const gap = useRef<number | undefined>(undefined)
  const shown = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const remaining = useRef(0)
  const startedAt = useRef(0)
  // The latest control the person used, and when.
  const used = useRef<{ el: Element | null; at: number }>({ el: null, at: -1 })

  const stop = () => window.clearTimeout(timer.current)
  const arm = useCallback((ms: number) => {
    stop()
    remaining.current = ms
    startedAt.current = performance.now()
    timer.current = window.setTimeout(() => setCurrent(null), ms)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      show: (message, options = {}) => {
        const start = () => {
          const id = ++counter.current
          setCurrent({ id, message, kind: options.kind ?? 'info' })
          announce(message)
          arm(options.duration ?? defaultDuration(message))
        }
        window.clearTimeout(gap.current)
        if (shown.current) {
          // A toast is already up. Clear it first and show the new one after a short
          // blank, so the change reads as a new message and not as the same text
          // changing (June, 2026-11-09). No motion: a blank, not a slide.
          stop()
          setCurrent(null)
          gap.current = window.setTimeout(start, REPLACE_GAP_MS)
        } else {
          start()
        }
      },
    }),
    [announce, arm],
  )

  useEffect(
    () => () => {
      stop()
      window.clearTimeout(gap.current)
    },
    [],
  )

  // iOS suspends timers in a backgrounded web view, so pause by hand and resume
  // with what is left.
  useEffect(() => {
    const onVisibility = () => {
      if (!box.current) return
      if (document.visibilityState === 'hidden') {
        stop()
        remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt.current))
      } else if (remaining.current > 0) {
        arm(remaining.current)
      } else {
        // Its time ran out while the page was hidden.
        setCurrent(null)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [arm])

  // The control in use: the more recent of the latest focusin and pointerdown.
  useEffect(() => {
    const note = (e: Event) => {
      const t = e.target instanceof Element ? e.target : null
      // A tap on blank text is not a control in use: only an interactive ancestor counts.
      const el = e.type === 'pointerdown' ? (t?.closest('button, a[href], input, select, textarea, [tabindex], [role="button"]') ?? null) : t
      if (el && el !== document.body && el !== document.documentElement) used.current = { el, at: e.timeStamp }
    }
    document.addEventListener('focusin', note, true)
    document.addEventListener('pointerdown', note, true)
    return () => {
      document.removeEventListener('focusin', note, true)
      document.removeEventListener('pointerdown', note, true)
    }
  }, [])

  // Choose the edge. The layer fills the frame, and AppRoot (the only thing that follows the visual
  // viewport) has already put the frame over the visible area. Imperative, so a toast never paints
  // at the wrong edge for a frame.
  const place = useCallback(() => {
    const lay = layer.current
    const b = box.current
    if (!lay || !b) return
    b.dataset.edge = 'top'
    b.style.top = ''
    // The top Sheet's header, if the toast at the screen top would cover it. The
    // header is the body's previous sibling (see Sheet.tsx).
    const bodies = document.querySelectorAll('[data-sheet-body]')
    const header = bodies[bodies.length - 1]?.previousElementSibling
    if (header && bodies[bodies.length - 1]) {
      const h = header.getBoundingClientRect()
      if (h.height > 0 && overlaps(b.getBoundingClientRect(), h)) {
        b.style.top = `calc(${h.bottom - lay.getBoundingClientRect().top}px + var(--spacing-toast-edge))`
      }
    }
    const el = used.current.el
    if (el?.isConnected) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && overlaps(b.getBoundingClientRect(), r)) {
        b.dataset.edge = 'bottom'
        b.style.top = ''
      }
    }
  }, [])

  useLayoutEffect(() => {
    shown.current = current !== null
    if (current) place()
  }, [current, place])

  useEffect(() => {
    if (!current) return
    const again = () => place()
    document.addEventListener('focusin', again, true)
    document.addEventListener('pointerdown', again, true)
    // AppRoot moved the frame (the keyboard, a pan): choose the edge again.
    const off = onVisibleChange(again)
    return () => {
      off()
      document.removeEventListener('focusin', again, true)
      document.removeEventListener('pointerdown', again, true)
    }
  }, [current, place, onVisibleChange])

  return (
    <div
      ref={layer}
      data-toast-layer
      className="pointer-events-none absolute inset-x-0 top-0 h-full z-[var(--z-toast)]"
    >
      {current && (
        <div
          ref={box}
          aria-hidden="true"
          data-toast
          data-edge="top"
          data-kind={current.kind}
          className="pointer-events-none absolute inset-x-0 mx-auto flex w-[calc(100%-2*var(--spacing-gutter))] max-w-sm items-start gap-3 rounded-card bg-content px-4 py-3 text-base text-surface data-[edge=bottom]:bottom-[calc(var(--spacing-toast-edge)+env(safe-area-inset-bottom))] data-[edge=top]:top-[calc(var(--spacing-toast-edge)+env(safe-area-inset-top))]"
        >
          {current.kind === 'success' && (
            <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
          <span className="min-w-0 [overflow-wrap:anywhere]">{current.message}</span>
        </div>
      )}
    </div>
  )
})
