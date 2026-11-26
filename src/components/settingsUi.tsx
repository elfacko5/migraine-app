import { Switch as BaseSwitch } from '@base-ui/react/switch';

// The v3 settings primitives (2026-10-26), shared by the Settings menu, the
// Display page, My medications and the medication editor — so a group, a
// switch row or a radio tile is one definition rather than a copy per screen.

// A section label: 14px / 600 / muted, sentence case, no letter-spacing — the
// literal v4 SettingsDark board's `.sl` (an earlier note describing this as
// "letter-spaced" was a different, older precedent this converges onto, not
// this board's own markup, which carries no tracking). 4px side inset + 8px
// below, matching the board's margin exactly. Shared by the Settings menu
// and Reminders.
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mx-1 mb-2 text-xs font-semibold text-text-secondary">{children}</p>;
}

export function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}

// A v4 settings list: 56px rows at 16px text on a 20px card (decision 8),
// replacing code-ds's List/ListRow for ProfileView's screens. Built
// 2026-11-23 after June reported Settings "visually far from the redesign"
// — code-ds's own List/ListRow hardcode 44px rows at 17px text on a smaller
// card radius, and editing the vendored package wasn't the chosen path (the
// medication flows already moved off code-ds onto Lidd's own parts for the
// same reason — June, "stop moving lidd"). Same prop surface as code-ds's
// ListRow, so every call site needed only an import swap, not a rewrite.
//
// No outer ring on the card: SettingsDark.html's own `.grp` is a plain fill
// + radius + overflow-hidden, same as the existing `SettingsGroup` — a
// group of rows you read, not a control you press, so it keeps the
// `bg-bg-border` hairline rule rather than the control-ring one.
export function SettingsList({ children }: { children: React.ReactNode }) {
  return (
    <ul role="list" className="overflow-hidden rounded-card bg-bg-surface">
      {children}
    </ul>
  );
}

export interface SettingsRowProps {
  /** The label. */
  children?: React.ReactNode;
  /**
   * A second line under the label, muted — status text such as "On during
   * attacks" or "2 medicines". `value` is kept as the prop name (callers
   * already use it this way) but it renders stacked under the label now,
   * never beside it — the pattern library's "Medicine row" (label, then a
   * muted `.sub` directly below, both block-level, left-aligned), not
   * code-ds's "value on the label's line, drops under only when there's no
   * room" — that flex-wrap fallback is what made a long label like "Display
   * & attack mode" wrap awkwardly around the value instead of the value
   * simply taking its own line underneath. Found on device, 2026-11-23.
   */
  value?: string;
  /**
   * A one-word state on the label's line, right-aligned before the chevron —
   * "On", "Off", "Due". The Settings menu uses this instead of `value`
   * (2026-11-25): a state you'd want at a glance, never a description of
   * what's inside. Keep it to a word or two; it never wraps, the label does.
   */
  trailing?: string;
  /**
   * `muted` (default) for a state like the menu's "On"/"Off"; `primary` for a
   * chosen value such as Display's "Lexend" or "iPhone" — the v4 Display
   * board draws those at full text colour.
   */
  trailingTone?: 'muted' | 'primary' | 'accent';
  /** A decorative icon in currentColor. Hidden from screen readers. */
  leading?: React.ReactNode;
  /** Makes the row pressable: a button with a chevron. Without it the row is static. */
  onClick?: () => void;
  disabled?: boolean;
  /** The row's content is its own control, such as a Switch. Only the side padding, height and divider apply. */
  bare?: boolean;
}

// `accent` is the Reminders board's value colour (`.or .v`: #9bb9a1, 500) —
// a read-only setting's current value, set apart from its label.
// One row's box and press treatment, shared by `SettingsRow` and Attack
// detail's own `Row` (2026-11-26). The two keep their own layouts — Settings
// stacks a status under the label because the row leads somewhere; Detail
// puts a recorded answer on the right because the row *is* the record — but
// the height, insets, hover, focus ring, disabled look and chevron are one
// definition, so moving between the two screens no longer changes them.
export const ROW_BOX = 'flex min-h-row w-full items-center gap-3 px-card py-control-y text-left';
export const ROW_PRESS = 'transition-colors hover:bg-bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent row-dims disabled:hover:bg-transparent';

const TRAILING_TONE = {
  muted: 'text-text-secondary',
  primary: 'text-text-primary',
  accent: 'font-medium text-accent-light',
} as const;

export function SettingsRow({ children, value, trailing, trailingTone = 'muted', leading, onClick, disabled = false, bare = false }: SettingsRowProps) {
  // The divider lives on every row but the first, drawn as a pseudo-element
  // (not a border) so the first row is as tall as the others; the first and
  // last row's own content follows the card's rounded corners. An explicit
  // `:not(:first-child)` arbitrary variant, not code-ds's own `not-first:`
  // — that variant is registered in code-ds's own Tailwind build and isn't
  // guaranteed to reach classes written in this app's own files.
  const item = [
    'relative',
    "[&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:inset-x-0 [&:not(:first-child)]:before:top-0 [&:not(:first-child)]:before:h-px [&:not(:first-child)]:before:bg-bg-border",
    'first:[&>*]:rounded-t-card last:[&>*]:rounded-b-card',
  ].join(' ');
  if (bare) {
    // px-card: the row's own inset, so a Switch's label lines up with every
    // pressable row's (a bare row had none, and its label sat on the card edge).
    return <li className={`${item} flex min-h-row items-stretch px-card`}>{children}</li>;
  }
  const content = (
    <>
      {leading && <span aria-hidden="true" className="shrink-0 text-text-secondary [&>svg]:size-6">{leading}</span>}
      {/* Label, then the value directly below it — both block-level inside
          one flex-1 column, never side-by-side. The "Medicine row" pattern:
          a row's job is "here's its current state", not "here's a value to
          compare against the label on one line". */}
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className="block text-text-primary">{children}</span>
        {value && <span className="block text-xs text-text-secondary">{value}</span>}
      </span>
      {trailing && <span className={`shrink-0 whitespace-nowrap ${TRAILING_TONE[trailingTone]}`}>{trailing}</span>}
    </>
  );
  const layout = `${ROW_BOX} text-sm leading-tight`;
  if (!onClick) {
    return <li className={`${item} ${layout}`}>{content}</li>;
  }
  return (
    <li className={item}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${layout} ${ROW_PRESS}`}
      >
        {content}
        <Chevron />
      </button>
    </li>
  );
}

// A v3 group: rows on one `bg-surface` card, separated by a hairline. The
// rule is drawn per row rather than with `divide-y`, which measured as no
// border at all on the Insights medication rows. `bg-border` because it
// separates things you read, not the outline of a control.
//
// `raised` inside a sub-page: the sheet itself is `bg-surface`, so a surface
// group on it vanishes — there it is a card on a card.
export function SettingsGroup({ children, raised = false }: { children: React.ReactNode; raised?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-card ${raised ? 'bg-bg-raised' : 'bg-bg-surface'} [&>*+*]:border-t [&>*+*]:border-bg-border`}>
      {children}
    </div>
  );
}

/**
 * A v3 radio tile. Selected is a 2px accent ring **and** a filled radio mark in
 * the corner, so the state never rests on colour — and the mark's slot is
 * always drawn, `ChipCheck`'s rule, so nothing shifts as the choice moves.
 * A ring, never a border: rings take no layout space.
 */
export function OptionTile({ selected, onSelect, className = '', style, compact = false, children }: {
  selected: boolean;
  /** The smaller tile, for a picker of four (the medication type). */
  compact?: boolean;
  onSelect: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={style}
      className={`relative flex flex-col items-center justify-center rounded-card px-2 py-2 ring-inset transition-colors ${
        compact ? 'min-h-[5.5rem] gap-2 text-sm' : 'min-h-[7.5rem] gap-2.5 text-[1.125rem]'
      } ${
        selected ? 'font-semibold ring-2 ring-accent' : 'ring-1 ring-border-control'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute right-2.5 top-2.5 h-3.5 w-3.5 rounded-full ring-inset ${selected ? 'ring-[5px] ring-accent' : 'ring-2 ring-current opacity-60'}`}
      />
      {children}
    </button>
  );
}


// Lidd's switch, 2026-11-25. code-ds's Switch with the v4 board's off state:
// a filled `line` track (#7D7669), where the package draws a page-coloured
// track with a ring — on a card that read as a hole rather than a control.
// The knob is page-coloured (`surface`), not the board's #A39D92: that
// measured 1.7:1 on the track, and with the tracks close in tone the knob's
// position is what says on or off (WCAG 1.4.11, 3:1). Page colour measures
// 3.87 dark / 3.85 light / 3.58 attack, and is the on-knob's colour too. On is unchanged: accent track,
// on-accent knob. The package is vendored and not edited (the medication
// flows set that precedent), so the markup is repeated here, same contract:
// label inside the button, track drops below the label when a word won't fit.
// Sizes are the switch roles in index.css (46x27).
export function Switch({ checked, onCheckedChange, disabled, children }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** The visible label; it is the accessible name. */
  children: React.ReactNode;
}) {
  return (
    <BaseSwitch.Root
      checked={checked}
      disabled={disabled}
      nativeButton
      render={<button type="button" />}
      onCheckedChange={(c) => onCheckedChange(c)}
      className="group tap-44-y relative flex w-full cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-2 rounded-control py-2 text-left text-base text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus row-dims"
    >
      <span className="min-w-0 grow basis-[min-content] [overflow-wrap:break-word]">{children}</span>
      <span className="switch-track relative ml-auto h-switch-h w-switch-w shrink-0 rounded-full bg-line transition-colors motion-reduce:transition-none group-data-[checked]:bg-accent">
        <BaseSwitch.Thumb className="absolute left-switch-inset top-1/2 size-switch-thumb -translate-y-1/2 rounded-full bg-surface transition-[translate,background-color] motion-reduce:transition-none data-[checked]:translate-x-(--spacing-switch-travel) data-[checked]:bg-on-accent" />
      </span>
    </BaseSwitch.Root>
  );
}
