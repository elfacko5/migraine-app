import { useEffect, useRef, type ReactNode } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { useAnnounce } from '../app-root'
import { iosPress, pressedTint } from '../../styles/pressable'

// One treatment per variant, so no size or className prop.
//
// primary    the one solid fill. It means action.
// secondary  surface fill with a ring.
// danger     the error fill with its own label role. Only for a destructive
//            confirm (ConfirmDialog tone="destructive"). Pressed as primary.
// tertiary   no fill and no ring. A named exception to the outline rule: the
//            label at 4.5:1 identifies it. No underline.
//
// The pressed state changes the fill only, with no filter, and only on a button that can be pressed (not disabled, not loading), so the label contrast
// is exactly what the contrast check tests. Primary mixes the accent role with
// the content role: darker in light mode, lighter in dark mode, so the label
// ratio only goes up. Secondary and tertiary use the selected tint.
//
// iOS: the grey tap highlight is off (the pressed fill replaces it), a long press
// opens no callout and selects no label, and a tap has no double-tap delay.
//
// Disabled is the native attribute: the button leaves the tab order and the label
// and fill dim together. Loading keeps the button focusable (focusableWhenDisabled,
// which sets aria-disabled), ignores clicks, keeps full contrast and does not
// change size. VoiceOver reads it as dimmed while it loads, which is provisional.
// Progress is heard through the live region in AppRoot: loadingLabel when loading
// starts, doneLabel (optional) when it ends. With Reduce Motion the spinner is
// replaced by the visible loadingLabel, because a still ring reads as an icon.

const base = [
  // leading-tight (1.25) makes one line plus the padding roles come to exactly the target and compact heights.
  'relative inline-flex items-center justify-center rounded-control text-center text-base leading-tight font-control',
  iosPress,
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'data-[dimmed]:cursor-not-allowed data-[dimmed]:opacity-50 data-[loading]:cursor-progress',
].join(' ')

// --button-pressed is read by the showcase's contrast check, so the pressed pair
// it tests is the real one.
const variants = {
  primary: [
    'bg-accent text-on-accent [--button-pressed:color-mix(in_oklab,var(--color-accent)_84%,var(--color-content))]',
    'data-pressable:active:bg-(--button-pressed)',
  ].join(' '),
  danger: [
    'bg-error text-on-error [--button-pressed:color-mix(in_oklab,var(--color-error)_84%,var(--color-content))]',
    'data-pressable:active:bg-(--button-pressed)',
  ].join(' '),
  secondary: `bg-surface text-content ring-1 ring-inset ring-line ${pressedTint}`,
  tertiary: `bg-transparent text-accent ${pressedTint}`,
}

const sizes = {
  default: 'min-h-target px-control-x py-control-y',
  // Drawn compact, with an invisible vertical 44pt hit area.
  compact: 'tap-44-y min-h-compact px-control-compact-x py-control-compact-y',
}

function Spinner() {
  // Hidden with Reduce Motion: the loadingLabel text shows instead.
  return (
    <svg
      className="absolute size-5 animate-spin motion-reduce:hidden"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger'
  compact?: boolean
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
  /** Announced when loading starts, such as "Saving". Shown as "Saving…" with Reduce Motion. Pass it whenever loading can be true. */
  loadingLabel?: string
  /** Announced when loading ends, such as "Saved". The screen announces a failure itself. */
  doneLabel?: string
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  children: ReactNode
}

export function Button({
  variant = 'primary',
  compact = false,
  fullWidth = false,
  disabled = false,
  loading = false,
  loadingLabel,
  doneLabel,
  type = 'button',
  onClick,
  children,
}: ButtonProps) {
  const announce = useAnnounce()
  const wasLoading = useRef(false)

  useEffect(() => {
    if (loading && !wasLoading.current && loadingLabel) announce(loadingLabel)
    if (!loading && wasLoading.current && doneLabel) announce(doneLabel)
    wasLoading.current = loading
  }, [loading, loadingLabel, doneLabel, announce])

  const busy = loading && !disabled
  return (
    <BaseButton
      type={type}
      disabled={disabled || loading}
      focusableWhenDisabled={busy}
      onClick={onClick ? () => onClick() : undefined}
      aria-busy={busy || undefined}
      data-dimmed={disabled ? '' : undefined}
      // iOS applies :active to a disabled button too, so the pressed fill only shows when it can be pressed.
      data-pressable={!disabled && !busy ? '' : undefined}
      data-loading={busy ? '' : undefined}
      className={`${base} ${variants[variant]} ${sizes[compact ? 'compact' : 'default']} ${fullWidth ? 'w-full' : ''}`}
    >
      {/* Both labels share one grid cell, so the button reserves room for the
          wider one and never changes size when loading starts. */}
      <span className="inline-grid">
        {/* With Reduce Motion there is no spinner, so the label itself stays visible
            when there is no loadingLabel to show instead. */}
        <span
          className={`col-start-1 row-start-1 ${busy ? (loadingLabel ? 'invisible' : 'invisible motion-reduce:visible') : ''}`}
        >
          {children}
        </span>
        {loadingLabel && (
          <span
            aria-hidden="true"
            className={`col-start-1 row-start-1 invisible ${busy ? 'motion-reduce:visible' : ''}`}
          >
            {loadingLabel}…
          </span>
        )}
      </span>
      {busy && <Spinner />}
    </BaseButton>
  )
}
