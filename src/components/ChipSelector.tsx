import { useState } from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onAddCustom?: (label: string) => void;
  placeholder?: string;
  /** Optional leading mark per option. Passed only by the symptom steps —
   *  triggers and reliefs have no icon set, and half-iconed rows read worse
   *  than none. A render prop rather than a flag so this component keeps
   *  knowing nothing about what it is listing. */
  renderIcon?: (option: string) => React.ReactNode;
}

export function ChipSelector({ options, selected, onChange, onAddCustom, placeholder = 'Add custom…', renderIcon }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  }

  function commitCustom() {
    const label = draft.trim();
    if (!label) { setAdding(false); return; }
    onAddCustom?.(label);
    onChange([...selected, label]);
    setDraft('');
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt)}
            // Selected is a tint plus a ring rather than a solid accent fill:
            // a screen of solid sage pills is a lot of weight for what is an
            // optional step, and this matches the medication chips, which
            // already worked this way.
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-accent/20 text-accent-light ring-1 ring-inset ring-accent/50'
                : 'bg-bg-raised text-text-primary ring-1 ring-inset ring-bg-border hover:bg-bg-border'
            }`}
          >
            {renderIcon?.(opt)}
            {opt}
          </button>
        );
      })}

      {onAddCustom && (
        adding ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCustom(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Custom…"
              className="w-28 rounded-full bg-bg-raised px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary ring-1 ring-inset ring-border-subtle outline-none"
            />
            <button type="button" onClick={commitCustom} className="btn-tertiary text-sm font-medium">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-text-secondary hover:text-text-primary">✕</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-tertiary rounded-full px-3 py-1.5 text-sm ring-1 ring-dashed ring-button-secondary-border transition-colors"
          >
            {placeholder}
          </button>
        )
      )}
    </div>
  );
}
