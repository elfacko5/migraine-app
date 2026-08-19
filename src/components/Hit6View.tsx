import { useState } from 'react';
import type { Hit6Entry } from '../types';
import {
  HIT6_QUESTIONS, HIT6_OPTIONS, HIT6_MIN, HIT6_MAX, HIT6_INTERVAL_DAYS,
  hit6Score, hit6Band, latestHit6, hit6Due,
} from '../utils/hit6';
import { ProfileSubPage } from './ProfileSubPage';
import { chipClass } from '../utils/chipStyles';
import { formatDateShort } from '../utils/format';

interface Props {
  entries: Hit6Entry[];
  onSubmit: (answers: number[]) => void;
  onClose: () => void;
}

/**
 * The Headache Impact Test, as its own Profile sub-page.
 *
 * It deliberately does not interrupt: no card on Today, no notification. The
 * page is opened on purpose, which is the only state in which six questions
 * about the last four weeks get an honest answer.
 *
 * The copy states the score, the band the instrument defines, and the change
 * since last time — and concludes nothing beyond that, the same rule the
 * overuse caption and the preventive readout follow.
 */
export function Hit6View({ entries, onSubmit, onClose }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => HIT6_QUESTIONS.map(() => null));
  // The saved score *and* the one it should be compared against, captured
  // together at submit time. Re-deriving "the previous entry" after saving
  // finds the entry that was just written, which reported every first-ever
  // HIT-6 as "the same as last time".
  const [justSaved, setJustSaved] = useState<{ score: number; prev: Hit6Entry | null } | null>(null);

  const last = latestHit6(entries);
  const due = hit6Due(entries);
  const answered = answers.filter((a) => a !== null).length;
  const complete = answered === HIT6_QUESTIONS.length;

  const history = [...entries].sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  const submit = () => {
    if (!complete) return;
    const values = answers as number[];
    onSubmit(values);
    setJustSaved({ score: hit6Score(values), prev: last });
    setAnswers(HIT6_QUESTIONS.map(() => null));
  };

  // Shown after saving instead of the form, so the number that was just
  // produced is the thing on screen rather than six emptied questions.
  if (justSaved) {
    const band = hit6Band(justSaved.score);
    const prev = justSaved.prev;
    const change = prev ? justSaved.score - prev.score : null;
    return (
      <ProfileSubPage title="Headache impact" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-xl bg-bg-raised p-4">
            <div className="text-3xl font-bold text-text-primary">{justSaved.score}</div>
            <div className="text-sm text-text-primary">{band.label}</div>
            <p className="mt-1 text-xs text-text-secondary">{band.detail}</p>
            {change !== null && (
              <p className="mt-2 text-xs text-text-secondary">
                {change === 0
                  ? 'The same as last time.'
                  : `${Math.abs(change)} ${change < 0 ? 'lower' : 'higher'} than last time (${prev!.score}).`}
              </p>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Saved. The next one is worth doing in about four weeks — the questions ask about that window, so
            answering sooner measures much the same period twice.
          </p>
          <button type="button" onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </ProfileSubPage>
    );
  }

  return (
    <ProfileSubPage title="Headache impact" onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs text-text-secondary">
            Six questions about the last four weeks, scored {HIT6_MIN}–{HIT6_MAX}. It's a standard
            questionnaire your doctor may already use, and it asks a different question from your diary —
            how much headaches affected your life, rather than how many days you had. The two don't always
            agree, which is why both are worth having.
          </p>
          {last && (
            <p className="text-xs text-text-secondary">
              Last answered {formatDateShort(last.takenAt)} · scored {last.score} ({hit6Band(last.score).label.toLowerCase()}).
              {!due && ` Worth answering again about ${HIT6_INTERVAL_DAYS} days after that.`}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {HIT6_QUESTIONS.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm text-text-primary">
                <span className="text-text-secondary">{i + 1}. </span>{q}
              </p>
              {/* Chips, like every other set of options in the app: selection
                  is a tint, never the solid accent fill. gap-y-4 because
                  .tap-44 expands each target 6px above and below. */}
              <div className="flex flex-wrap gap-x-2 gap-y-4">
                {HIT6_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswers((prev) => prev.map((a, j) => (j === i ? opt.value : a)))}
                    aria-pressed={answers[i] === opt.value}
                    className={`tap-44 rounded-full px-3 py-1 text-sm font-medium transition-colors ${chipClass(answers[i] === opt.value)}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button type="button" onClick={submit} disabled={!complete} className="btn-primary w-full disabled:opacity-40">
            Save
          </button>
          {!complete && (
            <p className="text-center text-xs text-text-secondary">
              {answered} of {HIT6_QUESTIONS.length} answered — the score only means anything with all six.
            </p>
          )}
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-text-secondary">Previous</h3>
            <div className="space-y-1">
              {history.map((e) => (
                <div key={e.id} className="flex items-baseline gap-3 rounded-lg bg-bg-raised/50 px-3 py-2">
                  <span className="text-sm font-medium text-text-primary">{e.score}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                    {hit6Band(e.score).label}
                  </span>
                  <span className="text-xs text-text-secondary">{formatDateShort(e.takenAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProfileSubPage>
  );
}
