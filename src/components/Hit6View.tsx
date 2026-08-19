import { useState } from 'react';
import type { Hit6Entry } from '../types';
import {
  HIT6_QUESTIONS, HIT6_OPTIONS, HIT6_MIN, HIT6_MAX, HIT6_INTERVAL_DAYS,
  hit6Score, hit6Band, latestHit6,
} from '../utils/hit6';
import { ProfileSubPage } from './ProfileSubPage';
import { ConfirmDialog } from './ConfirmDialog';
import { chipClass } from '../utils/chipStyles';
import { formatDateShort } from '../utils/format';

interface Props {
  entries: Hit6Entry[];
  onSubmit: (answers: number[]) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const CHIP = 'w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors';

/**
 * The Headache Impact Test, as its own Profile sub-page.
 *
 * Three things it has to do beyond collecting six answers, all asked for on
 * 2026-08-19 and all about the questionnaire explaining itself:
 *
 * - **Say what it is for before asking anything.** A six-question form that
 *   opens straight onto question one is asking for compliance, not an answer.
 *   The intro says who reads it (nobody — it is the same private record as the
 *   diary), what it is for, and what happens to a submitted answer.
 * - **One question per screen.** Six at once is a form to get through; one is
 *   a question to think about, and the recall window is four weeks, so
 *   thinking about it is the point.
 * - **Be honest that answers are not editable.** Each entry is a dated
 *   measurement of a four-week window, so revising one later would make the
 *   history a record of opinions rather than of measurements. Deleting is
 *   offered instead, which is the honest operation: it removes a wrong entry
 *   without pretending a later answer was given at the earlier time.
 */
export function Hit6View({ entries, onSubmit, onDelete, onClose }: Props) {
  // 'intro' → 0..5 → 'done'
  const [stage, setStage] = useState<'intro' | number | 'done'>('intro');
  const [answers, setAnswers] = useState<(number | null)[]>(() => HIT6_QUESTIONS.map(() => null));
  const [result, setResult] = useState<{ score: number; prev: Hit6Entry | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Hit6Entry | null>(null);

  const last = latestHit6(entries);
  const history = [...entries].sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  function answer(value: number, index: number) {
    setAnswers((prev) => prev.map((a, j) => (j === index ? value : a)));
    // Advance on its own, the way a one-question-per-screen form should — but
    // not off the end: the last question waits, so the final tap isn't also
    // the tap that submits.
    if (index < HIT6_QUESTIONS.length - 1) setStage(index + 1);
  }

  function submit() {
    const values = answers as number[];
    onSubmit(values);
    // Captured together at submit time. Re-deriving "the previous entry"
    // afterwards finds the one just written, which reported every first-ever
    // HIT-6 as "the same as last time".
    setResult({ score: hit6Score(values), prev: last });
    setAnswers(HIT6_QUESTIONS.map(() => null));
    setStage('done');
  }

  // ── Result ────────────────────────────────────────────────────────────
  if (stage === 'done' && result) {
    const band = hit6Band(result.score);
    const change = result.prev ? result.score - result.prev.score : null;
    return (
      <ProfileSubPage title="Headache impact" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-xl bg-bg-raised p-4">
            <div className="text-3xl font-bold text-text-primary">{result.score}</div>
            <div className="text-sm text-text-primary">{band.label}</div>
            <p className="mt-1 text-xs text-text-secondary">{band.detail}</p>
            {change !== null && (
              <p className="mt-2 text-xs text-text-secondary">
                {change === 0
                  ? 'The same as last time.'
                  : `${Math.abs(change)} ${change < 0 ? 'lower' : 'higher'} than last time (${result.prev!.score}).`}
              </p>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Saved to your diary. It sits alongside your attack history, so you can see the two together —
            and it's worth answering again in about four weeks, since the questions ask about that window.
          </p>
          <button type="button" onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </ProfileSubPage>
    );
  }

  // ── Questions, one per screen ─────────────────────────────────────────
  if (typeof stage === 'number') {
    const i = stage;
    const isLast = i === HIT6_QUESTIONS.length - 1;
    return (
      <ProfileSubPage title="Headache impact" onClose={onClose}>
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs text-text-secondary">Question {i + 1} of {HIT6_QUESTIONS.length}</p>
            {/* A plain rule rather than a percentage bar: it says where you are
                without turning six questions into a thing being scored. */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-bg-raised">
              <div
                className="h-full rounded-full bg-accent/60 transition-all"
                style={{ width: `${((i + 1) / HIT6_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-base text-text-primary">{HIT6_QUESTIONS[i]}</p>

          <div className="space-y-2">
            {HIT6_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={answers[i] === opt.value}
                onClick={() => answer(opt.value, i)}
                className={`${CHIP} ${chipClass(answers[i] === opt.value)}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {isLast && (
              <button
                type="button"
                onClick={submit}
                disabled={answers.some((a) => a === null)}
                className="btn-primary w-full disabled:opacity-40"
              >
                See my score
              </button>
            )}
            <button
              type="button"
              onClick={() => setStage(i === 0 ? 'intro' : i - 1)}
              className="btn-secondary w-full"
            >
              Back
            </button>
            {isLast && answers.some((a) => a === null) && (
              <p className="text-center text-xs text-text-secondary">
                One or more questions are still unanswered — the score only means anything with all six.
              </p>
            )}
          </div>
        </div>
      </ProfileSubPage>
    );
  }

  // ── Intro ─────────────────────────────────────────────────────────────
  return (
    <ProfileSubPage title="Headache impact" onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            Six questions about the last four weeks, which add up to a score between {HIT6_MIN} and {HIT6_MAX}.
            It's a standard questionnaire — the HIT-6 — and many headache clinics use it.
          </p>
          <p>
            <span className="text-text-primary">Why answer it.</span> Your diary counts how many days you
            had. This asks something the diary can't: how much those days actually cost you. The two often
            disagree — a month with fewer attacks can still be a month that took more out of you — so
            answering it every so often gives you a second line to read alongside the first.
          </p>
          <p>
            <span className="text-text-primary">Who sees it.</span> Nobody. It's stored with the rest of
            your diary, on your device and in your own account if you've signed in. Nothing is sent
            anywhere else and nothing is reviewed by anyone. It's yours — to watch over time, or to show a
            doctor if you want to.
          </p>
          <p>
            <span className="text-text-primary">After you answer.</span> You get the score and what it
            means, and it's saved with today's date. Answers can't be edited afterwards: each one measures
            a particular four weeks, so changing it later would make it a record of what you think now
            rather than of how that month was. You can delete an entry if it's wrong.
          </p>
        </div>

        {last && (
          <p className="text-xs text-text-secondary">
            Last answered {formatDateShort(last.takenAt)} · scored {last.score} ({hit6Band(last.score).label.toLowerCase()}).
            Worth answering again about {HIT6_INTERVAL_DAYS} days after that.
          </p>
        )}

        <button type="button" onClick={() => setStage(0)} className="btn-primary w-full">
          {entries.length === 0 ? 'Start' : 'Answer again'}
        </button>

        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-text-secondary">Previous</h3>
            <div className="space-y-1">
              {history.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg bg-bg-raised/50 px-3 py-2">
                  <span className="text-sm font-medium text-text-primary">{e.score}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                    {hit6Band(e.score).label}
                  </span>
                  <span className="text-xs text-text-secondary">{formatDateShort(e.takenAt)}</span>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(e)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        title="Delete this answer?"
        message={confirmDelete
          ? `The HIT-6 you answered on ${formatDateShort(confirmDelete.takenAt)}, scoring ${confirmDelete.score}, will be removed. This can't be undone.`
          : ''}
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDelete) onDelete(confirmDelete.id); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </ProfileSubPage>
  );
}
