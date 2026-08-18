import { useState } from 'react';
import { medIcon } from '../utils/medDisplay';

interface Value { name: string; dose: string }

interface Props {
  value: Value;
  onChange: (next: Value) => void;
  recentMeds?: Array<{ name: string; dose: string }>;
}

const QTY_OPTIONS = ['1 tablet', '2 tablets', '3 tablets'];

export function MedicationInput({ value, onChange, recentMeds = [] }: Props) {
  const selected = recentMeds.find((m) => m.name === value.name);

  // Typing is the exception now that the library exists, so the free-text
  // fields start collapsed behind a ghost button. Two cases open them at
  // mount instead: nothing to pick from (a first log, where a ghost button
  // would be the only control on the step and hide the only way forward),
  // and a value that came from elsewhere — a voice draft naming a drug
  // that isn't in the list — which must stay visible and correctable.
  const [customOpen, setCustomOpen] = useState(
    () => recentMeds.length === 0 || (!!value.name && !recentMeds.some((m) => m.name === value.name))
  );

  function pick(med: Value) {
    // Tapping the selected chip again clears it — with the inputs collapsed
    // it would otherwise be the one choice on this step that can't be undone.
    if (selected?.name === med.name) onChange({ name: '', dose: '' });
    else onChange({ name: med.name, dose: med.dose });
    setCustomOpen(false);
  }

  return (
    <div className="space-y-3">
      {recentMeds.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">My medications</p>
          <div className="flex flex-wrap gap-2">
            {recentMeds.map((med) => (
              <button
                key={med.name}
                type="button"
                onClick={() => pick(med)}
                aria-pressed={selected?.name === med.name}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  selected?.name === med.name
                    ? 'bg-accent/20 text-accent-light ring-1 ring-inset ring-accent/40'
                    : 'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-border hover:text-text-primary'
                }`}
              >
                <span aria-hidden="true">{medIcon(med.name, med.dose)}</span>
                {med.name}{med.dose ? ` · ${med.dose}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {customOpen ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Medication name"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              className="flex-1 min-w-0 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="text"
              placeholder="Dose / strength"
              value={value.dose}
              onChange={(e) => onChange({ ...value, dose: e.target.value })}
              className="w-32 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {value.name && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary shrink-0">Qty:</span>
              {QTY_OPTIONS.map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => onChange({ ...value, dose: qty })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    value.dose === qty
                      ? 'bg-accent/20 text-accent-light ring-1 ring-inset ring-accent/40'
                      : 'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-border hover:text-text-primary'
                  }`}
                >
                  {qty}
                </button>
              ))}
            </div>
          )}

          {/* Collapsing clears what was typed: a value left behind a closed
              panel would be saved without being visible anywhere. */}
          {recentMeds.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange({ name: '', dose: '' }); setCustomOpen(false); }}
              className="btn-tertiary rounded-lg py-1.5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { onChange({ name: '', dose: '' }); setCustomOpen(true); }}
          className="btn-tertiary rounded-lg py-2 text-sm font-medium transition-colors"
        >
          + Add a different medication
        </button>
      )}
    </div>
  );
}
