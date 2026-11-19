import { ToastHost, type ToastApi, type ToastHandle } from '../toast/ToastHost'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// The app root is the one frame every overlay renders into. It is as tall as the
// screen and positions overlays `absolute`, never `fixed` (hard rule 3).
//
// It also keeps the layer stack. Layer 0 is the app content. Each open Sheet is
// a layer above it. Every layer except the top one is hidden from screen
// readers with aria-hidden and, where the browser supports it, made inert. The
// inert attribute is only ever added to aria-hidden, never used alone: iOS below
// 15.5 ignores it, so a Sheet always runs a focus loop as well.

type Layer = { id: number; el: HTMLElement; live: HTMLElement | null }

export type AppRootApi = {
  /** The frame overlays render into. Null until the first render has finished. */
  frame: HTMLElement | null
  nextId: () => number
  /** Puts a layer on top and hides the one below. Call it after focus has moved into the layer. */
  /** `live` is the layer's own live region, inside its dialog, where announcements go while it is on top. */
  register: (id: number, el: HTMLElement, live?: HTMLElement | null) => void
  /**
   * Removes a layer and un-hides the one below, then returns focus. Pass the
   * element that opened the layer. When two layers close in the same render (a
   * dialog that confirms and closes the Sheet under it), each opener is kept and
   * focus goes to the first one that is inside the layer now on top, so it never
   * lands in a layer that is closing.
   */
  unregister: (id: number, returnTo?: HTMLElement | null) => void
  isTop: (id: number) => boolean
  /** Says something to screen readers through the one polite live region. The same message announces again if it is sent twice. */
  announce: (text: string) => void
  /** The last element pressed. Safari does not focus a button when it is tapped, so activeElement is not enough. */
  lastPressed: () => HTMLElement | null
  /** Shows a toast: a short status message that is announced, never takes focus, and goes by itself. */
  toast: ToastApi
  /**
   * Calls `fn` after the frame has moved to follow the visible area (the keyboard going up or
   * down, or the page being panned). `'resize'` means the visible height changed, `'move'` that
   * only its offset did. Returns the way to stop. AppRoot is the only thing that follows the
   * visual viewport: a Sheet, a dialog or a toast that needs to react subscribes here and does
   * not read `visualViewport` itself.
   */
  onVisibleChange: (fn: (why: 'resize' | 'move') => void) => () => void
}

const AppRootContext = createContext<AppRootApi | null>(null)

export function useAppRoot(): AppRootApi {
  const api = useContext(AppRootContext)
  if (!api) throw new Error('A Sheet must be used inside AppRoot.')
  return api
}

/** The announce function, or a no-op outside AppRoot. */
export function useAnnounce(): (text: string) => void {
  return useContext(AppRootContext)?.announce ?? noop
}

/** Shows a toast. A no-op outside AppRoot. */
export function useToast(): ToastApi {
  return useContext(AppRootContext)?.toast ?? noopToast
}

const noop = () => {}
const noopToast: ToastApi = { show: noop }

export const INERT_SUPPORTED = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype

export type AppRootProps = {
  children: ReactNode
  /** For testing the fallback path (aria-hidden and focus loop only). Leave it off in an app. */
  disableInert?: boolean
}

export function AppRoot({ children, disableInert = false }: AppRootProps) {
  const [frame, setFrame] = useState<HTMLElement | null>(null)
  const base = useRef<HTMLDivElement>(null)
  const layers = useRef<Layer[]>([])
  const returns = useRef<HTMLElement[]>([])
  const counter = useRef(0)
  const inertOff = useRef(disableInert)
  const pressed = useRef<HTMLElement | null>(null)
  const live = useRef<HTMLDivElement>(null)
  const liveTimer = useRef<number | undefined>(undefined)
  const toastHost = useRef<ToastHandle>(null)
  const toast = useMemo<ToastApi>(() => ({ show: (m, o) => toastHost.current?.show(m, o) }), [])
  const probe = useRef<HTMLDivElement>(null)
  const listeners = useRef(new Set<(why: 'resize' | 'move') => void>())
  const onVisibleChange = useCallback((fn: (why: 'resize' | 'move') => void) => {
    listeners.current.add(fn)
    return () => {
      listeners.current.delete(fn)
    }
  }, [])
  const announceText = useCallback((text: string) => {
    // While a dialog is open, VoiceOver honours its aria-modal and does not read a
    // live region outside it, so the message goes to the top layer's own region.
    // (A toast shown over a Sheet was silent otherwise. June, 2026-11-09.)
    const top = layers.current[layers.current.length - 1]?.live
    const el = top?.isConnected ? top : live.current
    if (!el) return
    window.clearTimeout(liveTimer.current)
    // The region that was in use before may still hold the old text.
    ;[live.current, ...layers.current.map((l) => l.live)].forEach((r) => {
      if (r && r !== el) r.textContent = ''
    })
    el.textContent = ''
    liveTimer.current = window.setTimeout(() => {
      el.textContent = text
    }, 60)
  }, [])

  // Every layer except the top one is hidden. With one layer at a time that is
  // the layer directly below, and closing the top layer restores the one beneath.
  const apply = useCallback(() => {
    const els = [base.current, ...layers.current.map((l) => l.el)].filter((e): e is HTMLElement => !!e)
    els.forEach((el, i) => {
      if (i < els.length - 1) {
        el.setAttribute('aria-hidden', 'true')
        if (INERT_SUPPORTED && !inertOff.current) el.setAttribute('inert', '')
        else el.removeAttribute('inert')
      } else {
        el.removeAttribute('aria-hidden')
        el.removeAttribute('inert')
      }
    })
  }, [])

  useEffect(() => {
    inertOff.current = disableInert
    apply()
  }, [disableInert, apply])

  useEffect(() => {
    const onPress = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null
      pressed.current = (t?.closest('button, a[href], input, select, textarea, [tabindex]') as HTMLElement | null) ?? null
    }
    document.addEventListener('pointerdown', onPress, true)
    return () => document.removeEventListener('pointerdown', onPress, true)
  }, [])

  // The one place that follows the visual viewport. With the keyboard up the frame is as tall as the
  // visible area and sits at its top, so the window has nothing to scroll. WebKit keeps the layout
  // viewport full height and describes what is on screen as [offsetTop, offsetTop + height], so the
  // frame takes its height from the visual viewport and translates by its offset (plain translateY,
  // never will-change: transform, which would make the frame the containing block of fixed content).
  // At rest nothing is set and the frame is 100dvh, as before. The full height is measured from a
  // 100dvh probe, not from the frame, so a shrunk frame is never mistaken for the full one.
  useEffect(() => {
    const el = frame
    const pr = probe.current
    const vv = window.visualViewport
    if (!el || !pr || !vv) return
    let lastHeight = -1
    let frameShrunk = false
    let timer: number | undefined
    const textEntry = () => {
      const a = document.activeElement
      return a instanceof HTMLTextAreaElement || (a instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button', 'submit', 'reset'].includes(a.type))
    }
    // A focused text field on the page itself (not in a Sheet, which does this for its own body) is brought
    // into the visible part of the nearest scroll area, but only when it is not already fully visible, so a
    // field the person has placed is never moved. The frame ends where the keyboard begins, so that area
    // ends there too. Only that one scroller moves, never the frame or the window.
    const revealField = () => {
      const a = document.activeElement
      if (!(a instanceof HTMLElement) || !textEntry() || !base.current?.contains(a)) return
      let sc: HTMLElement | null = a.parentElement
      while (sc && sc !== el) {
        const oy = getComputedStyle(sc).overflowY
        if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight) break
        sc = sc.parentElement
      }
      if (!sc || sc === el) return
      const s = sc.getBoundingClientRect()
      const f = a.getBoundingClientRect()
      const bottom = Math.min(s.bottom, el.getBoundingClientRect().bottom)
      if (f.top >= s.top && f.bottom <= bottom) return
      sc.scrollTo({ top: sc.scrollTop + (f.top + f.height / 2) - (s.top + (bottom - s.top) / 2), behavior: 'instant' })
    }
    const place = (): boolean => {
      // Safari's pull-to-refresh bounce pulls the page down (pageTop below 0) and reports a smaller visible
      // height while it does. Following that shrank the frame and left it stuck out of place after the
      // finger lifted (June's phone, 2026-11-16, Safari step 6). Leave the frame as it was until the bounce ends.
      if (vv.pageTop < 0 || window.scrollY < 0) return frameShrunk
      const full = pr.offsetHeight
      // A pinch-zoomed page has a smaller visible area because of the zoom, not a keyboard: leave the frame alone.
      const shrunk = vv.scale <= 1.01 && (vv.height < full - 1 || vv.offsetTop > 0)
      if (shrunk) {
        el.style.setProperty('--app-frame-height', `${vv.height}px`)
        el.style.transform = `translateY(${vv.offsetTop}px)`
      } else {
        el.style.removeProperty('--app-frame-height')
        el.style.transform = ''
      }
      frameShrunk = shrunk
      const why = vv.height !== lastHeight ? 'resize' : 'move'
      lastHeight = vv.height
      listeners.current.forEach((fn) => fn(why))
      if (why === 'resize') revealField()
      return shrunk
    }
    // A native phone can pan the visual viewport (the keyboard, a focused field) without a resize or
    // scroll event reaching us in time (June's phone, 2026-11-09: a toast layer was not translated though
    // offsetTop was 261). While the keyboard is up or a text field has focus, compare the visible area 20
    // times a second and place again when it moved. A few reads, only for as long as it is needed.
    const watch = () => {
      if (timer !== undefined) return
      let key = ''
      timer = window.setInterval(() => {
        const k = `${vv.offsetTop}|${vv.height}`
        if (k !== key) {
          key = k
          place()
        }
        if (!(vv.scale <= 1.01 && (vv.height < pr.offsetHeight - 1 || vv.offsetTop > 0)) && !textEntry()) {
          window.clearInterval(timer)
          timer = undefined
        }
      }, 50)
    }
    const onChange = () => {
      if (place() || textEntry()) watch()
    }
    // No pull-to-refresh or rubber band on the page itself: the frame never scrolls, so a pull has nothing to do.
    const rootStyle = document.documentElement.style
    const bodyStyle = document.body.style
    const before = [rootStyle.overscrollBehaviorY, bodyStyle.overscrollBehaviorY]
    rootStyle.overscrollBehaviorY = 'none'
    bodyStyle.overscrollBehaviorY = 'none'
    onChange()
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    let revealTimer: number | undefined
    const onFocusIn = () => {
      onChange()
      window.clearTimeout(revealTimer)
      revealTimer = window.setTimeout(revealField, 350)
    }
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onChange, true)
    document.addEventListener('visibilitychange', onChange)
    window.addEventListener('pageshow', onChange)
    return () => {
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      document.removeEventListener('focusin', onFocusIn, true)
      window.clearTimeout(revealTimer)
      document.removeEventListener('focusout', onChange, true)
      document.removeEventListener('visibilitychange', onChange)
      window.removeEventListener('pageshow', onChange)
      window.clearInterval(timer)
      rootStyle.overscrollBehaviorY = before[0]
      bodyStyle.overscrollBehaviorY = before[1]
      el.style.removeProperty('--app-frame-height')
      el.style.transform = ''
    }
  }, [frame])

  const api = useMemo<AppRootApi>(
    () => ({
      frame,
      nextId: () => ++counter.current,
      register: (id, el, liveEl = null) => {
        layers.current = [...layers.current.filter((l) => l.id !== id), { id, el, live: liveEl }]
        apply()
      },
      unregister: (id, returnTo) => {
        layers.current = layers.current.filter((l) => l.id !== id)
        apply()
        if (returnTo) returns.current.push(returnTo)
        // The layer now on top, or the app content when no Sheet is open.
        const top = layers.current[layers.current.length - 1]?.el ?? base.current
        const target = returns.current.find((el) => el.isConnected && top?.contains(el))
        if (target) {
          returns.current = []
          target.focus({ preventScroll: true })
        } else if (layers.current.length === 0) {
          returns.current = []
        }
      },
      isTop: (id) => layers.current[layers.current.length - 1]?.id === id,
      // The text is cleared first and set a moment later, so the same message
      // is announced again if it is sent twice in a row.
      announce: announceText,
      lastPressed: () => pressed.current,
      toast,
      onVisibleChange,
    }),
    [frame, apply, announceText, toast, onVisibleChange],
  )

  return (
    <AppRootContext.Provider value={api}>
      <div
        ref={setFrame}
        data-app-root
        className="relative h-[var(--app-frame-height,100dvh)] overflow-hidden"
        // The frame is overflow-hidden and never scrolls on purpose. A drill-down
        // panel starts off-screen to the right, and with VoiceOver on, WebKit scrolls
        // the frame sideways to reveal an element the VoiceOver cursor moved into.
        // Measured on the phone (2026-11-06): the frame reached scrollLeft 233 and the
        // Sheet sat shifted left, by a different amount on every run. Put it back at
        // once. Only the sideways scroll: nothing here ever needs it.
        onScroll={(e) => {
          if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0
        }}
      >
        {/* The full height, measured. Never shown, never fixed. */}
        <div ref={probe} aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 h-dvh w-px" />
        {/* isolate: the base layer is its own stacking context, so the sticky Top bar's
            z-index (10) is only compared inside it. Without it the bar painted over
            every Sheet, which has no z-index. */}
        <div ref={base} data-layer-base className="isolate h-full">
          {children}
        </div>
        {/* The one polite live region. It sits beside the layers, never inside one,
            so a Sheet's aria-hidden and inert never silence it. Visually hidden and
            absolute, never fixed. */}
        <div
          ref={live}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-live-region
          className="absolute top-0 left-0 size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]"
        />
        {/* The one toast. Beside the live region and never a layer, so a Sheet
            neither hides nor covers it. */}
        <ToastHost ref={toastHost} announce={announceText} onVisibleChange={onVisibleChange} />
      </div>
    </AppRootContext.Provider>
  )
}
