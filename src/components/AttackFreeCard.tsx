import { useEffect, useState } from 'react';
import { formatSince, formatDatetime } from '../utils/format';

interface Props {
  lastEnd: string;
  onStart: () => void;
}

/** Shown on the Today tab when no attack is ongoing — how long since the last one ended. */
export function AttackFreeCard({ lastEnd, onStart }: Props) {
  const [, forceRender] = useState(0);

  // Tick the elapsed time every minute.
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-bg-border bg-bg-raised/40 p-6 text-center space-y-3">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-accent-light">
          <path d="M9 12l2 2 4-4" />
          <path d="M12 3 4 6v5c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V6l-8-3Z" />
        </svg>
      </div>

      <div className="space-y-0.5">
        <p className="text-3xl font-bold tabular-nums text-text-primary">{formatSince(lastEnd)}</p>
        <p className="text-sm font-medium text-accent-light">attack-free</p>
        <p className="text-xs text-text-secondary">since {formatDatetime(lastEnd)}</p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold transition-colors"
      >
        Start logging
      </button>
    </div>
  );
}
