import { useState } from 'react';
import { chipClass } from '../utils/chipStyles';

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
            // Both states come from `chipStyles`, like every other chip in
            // the app. This was the one place that didn't: its unselected
            // state used `text-primary` and a background hover, against the
            // shared `text-secondary` and colour hover. There is no principle
            // separating these chips from the filter sheet's — both are sets
            // of options you open a screen to read and pick from — so the
            // difference was drift, not a decision.
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${chipClass(active)}`}
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
              aria-label={placeholder}
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
