import { useState } from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onAddCustom?: (label: string) => void;
  placeholder?: string;
}

export function ChipSelector({ options, selected, onChange, onAddCustom, placeholder = 'Add custom…' }: Props) {
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
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-accent text-bg-base'
                : 'bg-bg-raised text-text-primary ring-1 ring-inset ring-bg-border hover:bg-bg-border'
            }`}
          >
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
            className="btn-tertiary rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-dashed ring-button-secondary-border transition-colors"
          >
            {placeholder}
          </button>
        )
      )}
    </div>
  );
}
