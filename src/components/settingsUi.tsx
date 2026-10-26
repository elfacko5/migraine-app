// The v3 settings primitives (2026-10-26), shared by the Settings menu, the
// Display page, My medications and the medication editor — so a group, a
// switch row or a radio tile is one definition rather than a copy per screen.

export function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true">
      <path d="m9 18 6-6-6-6"/>
    </svg>
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
    <div className={`overflow-hidden rounded-2xl ${raised ? 'bg-bg-raised' : 'bg-bg-surface'} [&>*+*]:border-t [&>*+*]:border-bg-border`}>
      {children}
    </div>
  );
}

/** The app's one switch treatment — control-token track, `bg-surface` thumb
 *  (see the measured note on the attack mode switch it was lifted from). */
export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${on ? 'bg-accent' : 'bg-border-control'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-bg-surface transition-transform ${on ? 'translate-x-5' : ''}`} />
    </span>
  );
}

export function SwitchRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-bg-elevated"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-text-primary">{label}</span>
        {hint && <span className="block text-xs text-text-secondary">{hint}</span>}
      </span>
      <SwitchTrack on={on} />
    </button>
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
      className={`relative flex flex-col items-center justify-center rounded-[1.25rem] px-2 py-2 ring-inset transition-colors ${
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

