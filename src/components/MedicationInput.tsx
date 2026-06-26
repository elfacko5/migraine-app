interface Value { name: string; dose: string }

interface Props {
  value: Value;
  onChange: (next: Value) => void;
  recentMeds?: Array<{ name: string; dose: string }>;
}

const QTY_OPTIONS = ['1 tablet', '2 tablets', '3 tablets'];

export function MedicationInput({ value, onChange, recentMeds = [] }: Props) {
  return (
    <div className="space-y-2.5">
      {/* Recent medication chips */}
      {recentMeds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recentMeds.map((med) => (
            <button
              key={med.name}
              type="button"
              onClick={() => onChange({ name: med.name, dose: med.dose })}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                value.name === med.name
                  ? 'bg-accent/20 text-accent-light ring-1 ring-inset ring-accent/40'
                  : 'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-border hover:text-text-primary'
              }`}
            >
              💊 {med.name}{med.dose ? ` · ${med.dose}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Name + dose free-text */}
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

      {/* Quick quantity */}
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
    </div>
  );
}
