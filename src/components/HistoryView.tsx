import { useState, useMemo } from 'react';
import type { Attack } from '../types';
import { AttackCard } from './AttackCard';

type Period = 'all' | '7d' | '30d' | '3m';
type SortOrder = 'newest' | 'oldest';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d',   label: '7 days' },
  { value: '30d',  label: '30 days' },
  { value: '3m',   label: '3 months' },
  { value: 'all',  label: 'All' },
];

const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = {
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '3m':  90 * 24 * 60 * 60 * 1000,
};

interface Props {
  attacks: Attack[];
  onAttackClick: (attack: Attack) => void;
}

export function HistoryView({ attacks, onAttackClick }: Props) {
  const [period, setPeriod] = useState<Period>('7d');
  const [sort, setSort] = useState<SortOrder>('newest');

  const filtered = useMemo(() => {
    let list = attacks;

    // Period filter
    if (period !== 'all') {
      const cutoff = Date.now() - PERIOD_MS[period];
      list = list.filter((a) => new Date(a.snapshots[0].time).getTime() >= cutoff);
    }

    // Sort by start time to be independent of storage insertion order
    const sorted = [...list].sort((a, b) => {
      const diff = new Date(b.snapshots[0].time).getTime() - new Date(a.snapshots[0].time).getTime();
      return sort === 'newest' ? diff : -diff;
    });
    return sorted;
  }, [attacks, period, sort]);

  const total = attacks.length;
  const shown = filtered.length;

  if (total === 0) {
    return (
      <div className="py-20 text-center text-text-secondary text-sm">
        No attacks logged yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Count + sort toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          <span className="text-text-primary font-semibold">{shown}</span>
          {shown !== total && <span> of {total}</span>}
          <span> {shown === 1 ? 'attack' : 'attacks'}</span>
        </p>
        <button
          type="button"
          onClick={() => setSort((s) => s === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-raised ring-1 ring-bg-border hover:text-text-primary transition-colors"
        >
          {sort === 'newest' ? '↓ Newest' : '↑ Oldest'}
        </button>
      </div>

      {/* Period filter chips */}
      <div className="flex gap-2 flex-wrap">
        {PERIOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              period === value
                ? 'bg-accent text-bg-base'
                : 'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-border hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Attack list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-text-secondary text-sm">
          No attacks in this period.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <AttackCard
              key={a.id}
              attack={a}
              isOngoing={a.end === null}
              onClick={() => onAttackClick(a)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
