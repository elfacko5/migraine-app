import { useState } from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onAddCustom?: (label: string) => void;
}

export function ListSelector({ options, selected, onChange, onAddCustom }: Props) {
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
    <div className="rounded-xl border border-bg-border overflow-hidden divide-y divide-bg-border">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-bg-raised/40 hover:bg-bg-raised transition-colors"
          >
            <div className={`h-5 w-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${active ? 'border-accent bg-accent' : 'border-bg-border'}`}>
              {active && (
                <svg viewBox="0 0 12 10" fill="none" className="h-3 w-3 text-bg-base" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1,5 4,8 11,1" />
                </svg>
              )}
            </div>
            <span className="flex-1 text-sm font-medium text-text-primary">{opt}</span>
          </button>
        );
      })}

      {onAddCustom && (
        adding ? (
          <div className="flex items-center gap-2 px-4 py-3 bg-bg-raised/40">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCustom(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Type and press Enter…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
            />
            <button type="button" onClick={commitCustom} className="text-sm text-accent hover:text-accent-light font-medium shrink-0">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-text-secondary hover:text-text-primary shrink-0">✕</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-bg-raised/40 hover:bg-bg-raised transition-colors"
          >
            <div className="h-5 w-5 rounded-md border-2 border-dashed border-button-secondary-border shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5 text-accent-light" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
              </svg>
            </div>
            <span className="btn-tertiary text-sm font-medium">Add custom…</span>
          </button>
        )
      )}
    </div>
  );
}
