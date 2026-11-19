import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppRoot } from '../app-root'
import { Button } from '../button'

// A custom alert dialog, with no Base UI parts and nothing position: fixed. Base
// UI's AlertDialog renders a fixed overlay, which hard rule 3 does not allow.
//
// Tone is required and has no default. A destructive dialog styles the confirm
// button as danger. The screen picks the tone, never the component.
//
// Focus: on open it moves to the dialog itself, as the Sheet does, so VoiceOver
// reads the title and the message first (on a phone, focusing a button directly
// left the VoiceOver cursor on the hidden trigger). The first Tab then reaches the
// safe choice: Cancel for destructive, the confirm button for neutral.
//
// It is a layer in AppRoot's stack, exactly like a Sheet: opening moves focus in
// first, then hides the layer below (aria-hidden, plus inert where supported).
// Closing un-hides first, then returns focus to the trigger. Escape cancels and
// closes only the top layer. A backdrop tap does nothing. Body scroll is not
// locked. The Sheet's layer code is copied here rather than shared, so the
// Sheet that passed on the phone is untouched.
//
// No aria-describedby: on a phone VoiceOver read the message and then "description"
// and the message again, and put the description on the Cancel button too. The
// alertdialog role already makes VoiceOver read its content when it opens.
//
// Confirm only calls onConfirm. The screen decides what closes, so a slow action
// can show loading while the dialog stays open. While confirmLoading is loading,
// Cancel and Escape still call onOpenChange(false). The screen must then either
// abort the action, or ignore the close and keep open true. If it does neither,
// the action carries on behind a closed dialog.

const FADE_MS = 150

const tabbableSelector =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(tabbableSelector)].filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  )
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export type ConfirmDialogProps = {
  open: boolean
  /** Cancel and Escape call this with false. Confirm never does: the screen closes the dialog. */
  onOpenChange: (open: boolean) => void
  /** Required, no default. destructive: confirm styled as danger, the first Tab reaches Cancel. neutral: the first Tab reaches confirm. */
  tone: 'destructive' | 'neutral'
  /** The dialog's accessible name. */
  title: string
  description?: string
  /** A verb, such as "Delete". Required, so the package holds no English. */
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  /** Shows loading on the confirm button. Cancel and Escape stay available and still call onOpenChange(false): the screen must abort the action, or keep `open` true. */
  confirmLoading?: boolean
  /** Announced when confirm starts loading, such as "Deleting". */
  confirmLoadingLabel?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  tone,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmLoading = false,
  confirmLoadingLabel,
}: ConfirmDialogProps) {
  const api = useAppRoot()
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const shell = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const change = useRef(onOpenChange)
  const toneRef = useRef(tone)
  useEffect(() => {
    change.current = onOpenChange
    toneRef.current = tone
  })
  useEffect(() => {
    if (!idRef.current) idRef.current = api.nextId()
  }, [api])

  // Mounting and the fade. With reduce motion on there is no fade and no scale:
  // the dialog appears and disappears at once.
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
      return () => cancelAnimationFrame(raf)
    }
    setEntered(false)
    const t = setTimeout(() => setMounted(false), reducedMotion() ? 0 : FADE_MS + 20)
    return () => clearTimeout(t)
  }, [open])

  // The layer: focus, what is behind, Escape and the focus loop.
  useEffect(() => {
    const sh = shell.current
    const pn = panel.current
    if (!open || !mounted || !sh || !pn || !api.frame) return
    const id = idRef.current || (idRef.current = api.nextId())
    // The trigger. Safari does not focus a button when it is tapped, so focus is
    // on the body, or on the Sheet we are opened from. Then the last pressed
    // element is the trigger.
    const active = document.activeElement
    const role = active?.getAttribute('role')
    const unhelpful = !active || active === document.body || role === 'dialog' || role === 'alertdialog'
    const opener = (unhelpful ? api.lastPressed() : active) as HTMLElement | null

    // The safe choice, read when it is needed because tone can change.
    const safe = () =>
      pn.querySelector<HTMLElement>(
        toneRef.current === 'destructive' ? '[data-confirm-cancel] button' : '[data-confirm-confirm] button',
      )

    // 1. Focus moves to the dialog. 2. Only then is what held focus hidden.
    pn.focus({ preventScroll: true })
    api.register(id, sh, pn.querySelector<HTMLElement>('[data-layer-live]'))
    // Opened on top of a Sheet, the Sheet's own focus guard pulls focus back into
    // itself on the first call, because this layer is not registered yet. Once the
    // layer below is hidden, focus is set again and stays.
    pn.focus({ preventScroll: true })

    const onKeyDown = (e: KeyboardEvent) => {
      if (!api.isTop(id)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        change.current(false)
        return
      }
      if (e.key !== 'Tab') return
      // From the dialog itself, the first Tab reaches the safe choice.
      if (!e.shiftKey && document.activeElement === pn) {
        e.preventDefault()
        ;(safe() ?? tabbables(pn)[0] ?? pn).focus({ preventScroll: true })
        return
      }
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
      ;(safe() ?? tabbables(pn)[0] ?? pn).focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      // 1. What is behind is un-hidden. 2. Only then does focus return.
      api.unregister(id, opener)
    }
  }, [open, mounted, api])

  if (!mounted || !api.frame) return null

  return createPortal(
    <div ref={shell} data-confirm-shell className="absolute top-0 left-0 h-full w-full">
      {/* A backdrop tap does nothing: a stray tap must not lose the question. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-scrim transition-opacity duration-150 motion-reduce:transition-none ${entered ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="absolute inset-0 flex items-center justify-center px-gutter pt-[calc(env(safe-area-inset-top)+var(--spacing-gutter))] pb-[calc(env(safe-area-inset-bottom)+var(--spacing-gutter))]">
        <div
          ref={panel}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`relative flex max-h-full w-full max-w-sm flex-col rounded-card bg-surface-raised p-card text-content ring-1 ring-divider outline-none transition-[opacity,transform] duration-150 motion-reduce:transition-none ${entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        >
          <div data-confirm-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <h2 id={titleId} className="text-lg font-heading [overflow-wrap:anywhere]">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-base [overflow-wrap:anywhere]">
                {description}
              </p>
            )}
          </div>
          <div className="mt-4 flex shrink-0 flex-col gap-2">
            <div data-confirm-confirm>
              <Button
                fullWidth
                variant={tone === 'destructive' ? 'danger' : 'primary'}
                loading={confirmLoading}
                loadingLabel={confirmLoadingLabel}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
            <div data-confirm-cancel>
              <Button fullWidth variant="secondary" onClick={() => onOpenChange(false)}>
                {cancelLabel}
              </Button>
            </div>
          </div>
          <div role="status" aria-live="polite" aria-atomic="true" data-layer-live className="absolute top-0 left-0 size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" />
        </div>
      </div>
    </div>,
    api.frame,
  )
}
