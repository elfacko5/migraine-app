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
  /** A decorative icon in currentColor. Hidden from screen readers. */
  leading?: React.ReactNode;
  /** Makes the row pressable: a button with a chevron. Without it the row is static. */
  onClick?: () => void;
  disabled?: boolean;
  /** The row's content is its own control, such as a Switch. Only the padding, height and divider apply. */
  bare?: boolean;
}

export function SettingsRow({ children, value, leading, onClick, disabled = false, bare = false }: SettingsRowProps) {
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
    return <li className={`${item} flex min-h-row items-stretch`}>{children}</li>;
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
    </>
  );
  const layout = 'flex min-h-row w-full items-center gap-3 px-card py-control-y text-left text-sm leading-tight';
  if (!onClick) {
    return <li className={`${item} ${layout}`}>{content}</li>;
  }
  return (
    <li className={item}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${layout} transition-colors hover:bg-bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50`}
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
    <div className={`overflow-hidden rounded-group ${raised ? 'bg-bg-raised' : 'bg-bg-surface'} [&>*+*]:border-t [&>*+*]:border-bg-border`}>
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

