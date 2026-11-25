import { useState } from 'react';
import type { Hit6Entry } from '../types';
import {
  HIT6_QUESTIONS, HIT6_OPTIONS, HIT6_MIN, HIT6_MAX, HIT6_BANDS,
  hit6Score, hit6Band, hit6BandSentence, hit6Tone, type Hit6Tone,
} from '../utils/hit6';
import { ProfileSubPage } from './ProfileSubPage';
import { ConfirmDialog } from './ConfirmDialog';
import { RadioDot } from './RadioDot';
import { WarningIcon } from './icons';
import { formatDateShort } from '../utils/format';

interface Props {
  entries: Hit6Entry[];
  /** Signed in: the entry also syncs to their own account, so "sent nowhere"
   *  would be untrue — the privacy row says so instead. */
  signedIn: boolean;
  onSubmit: (answers: number[]) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// The severity ramp the app already uses for pain, mapped onto the HIT-6's
// own four bands: a scale you read along, the same colours as everywhere
// else, so nothing new to learn. `neutral` for 50–55 is the board's grey.
const TONE_BG: Record<Hit6Tone, string> = {
  low: 'bg-severity-low',
  neutral: 'bg-text-secondary',
  mid: 'bg-severity-mid',
  high: 'bg-severity-high',
};

const SPAN = HIT6_MAX - HIT6_MIN;
const pct = (score: number) => ((score - HIT6_MIN) / SPAN) * 100;

/**
 * The Headache Impact Test, as its own Settings sub-page — rebuilt to the v4
 * boards 05-0 (intro), 05-1 (a question) and 05-7 (result), 2026-11-25.
 *
 * Kept from before, and why:
 * - **One question per screen, no auto-advance.** The recall window is four
 *   weeks; thinking about it is the point, and a mis-tap must be visible
 *   before it's committed.
 * - **Answers can't be edited; deleting is offered.** Each entry measures a
 *   particular four weeks — revising one later would make the history a
 *   record of opinions rather than of measurements.
 *
 * Where it departs from the boards:
 * - **A back chevron, not an X.** This page is a drill-down from Settings
 *   (enters from the right); an X there says two things at once. On the
 *   questions the chevron steps back a question, as the board's own back
 *   circle does; the way out is back past the intro.
 * - **"Sent nowhere" only when it's true.** Signed in, the entry syncs to
 *   their own account; the row says so.
 * - **The doctor line is unconditional.** The board's "worth showing your
 *   doctor if it's high or climbing" has the app judging when a score
 *   warrants care — the interpretive step `decisions.md`'s MDR note warns
 *   about. "You can show it to your doctor" points to a professional without
 *   reading the number for them.
 * - **Earlier answers stay listed on the intro**, with Delete — the board has
 *   no history, but the footnote promises deleting is possible.
 */
export function Hit6View({ entries, signedIn, onSubmit, onDelete, onClose }: Props) {
  // 'intro' → 0..5 → 'done'
  const [stage, setStage] = useState<'intro' | number | 'done'>('intro');
  const [answers, setAnswers] = useState<(number | null)[]>(() => HIT6_QUESTIONS.map(() => null));
  const [result, setResult] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Hit6Entry | null>(null);

  const history = [...entries].sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  function submit() {
    const values = answers as number[];
    onSubmit(values);
    setResult(hit6Score(values));
    setAnswers(HIT6_QUESTIONS.map(() => null));
    setStage('done');
  }

  // ── Result (05-7) ─────────────────────────────────────────────────────
  if (stage === 'done' && result !== null) {
    const band = hit6Band(result);
    const tone = hit6Tone(result);
    return (
      <ProfileSubPage
        // A key per stage: a fresh page, so its heading takes focus and is
        // announced (review of db053be — the same instance never refocused,
        // and VoiceOver heard nothing after Next or Start).
        key="done"
        title="Headache impact"
        titleInPage
        onClose={onClose}
        // key: a fresh element, not the question's Next re-used — that one was
        // just disabled, and its colour transition carried over as a grey flash.
        footer={<button key="done" type="button" onClick={onClose} className="btn-primary btn-inline w-full">Done</button>}
      >
        <div className="space-y-5">
          <div className="rounded-card bg-bg-surface p-card">
            <p className="flex items-baseline gap-3">
              <span className="text-[4rem] font-bold leading-none text-text-strong">{result}</span>
              <span className="text-sm text-text-secondary">of {HIT6_MAX}</span>
            </p>
            <span className={`mt-3 inline-block rounded-badge px-3 py-1 text-sm font-medium text-bg-base ${TONE_BG[tone]}`}>
              {band.label}
            </span>
            <ScoreBar score={result} />
          </div>

          <p className="text-text-primary">{hit6BandSentence(result)}</p>

          <div className="flex items-start gap-3 rounded-card bg-warning-surface px-card py-3">
            <WarningIcon className="mt-0.5 size-4 shrink-0 text-severity-mid" />
            <p className="text-sm text-text-primary">A tracking score, not a diagnosis. You can show it to your doctor alongside your diary.</p>
          </div>

          <p className="text-text-secondary">
            Saved to your diary with today’s date, next to your attack history. Answer again in about four weeks to see it move.
          </p>
        </div>
      </ProfileSubPage>
    );
  }

  // ── A question (05-1) ─────────────────────────────────────────────────
  if (typeof stage === 'number') {
    const i = stage;
    const isLast = i === HIT6_QUESTIONS.length - 1;
    return (
      <ProfileSubPage
        key={`q${i}`}
        title={HIT6_QUESTIONS[i]}
        titleInPage
        barTitle={`Step ${i + 1} of ${HIT6_QUESTIONS.length}`}
        // Back steps back a question (to the intro from the first), as the
        // board's own back circle does.
        onClose={() => setStage(i === 0 ? 'intro' : i - 1)}
        footer={
          <button
            type="button"
            onClick={() => (isLast ? submit() : setStage(i + 1))}
            disabled={answers[i] === null}
            className="btn-primary btn-inline w-full"
          >
            {isLast ? 'See my score' : 'Next'}
          </button>
        }
      >
        {/* key: a new radiogroup per question, so focus and the checked state
            never carry over from the previous one. */}
        <div key={i} role="radiogroup" aria-label={HIT6_QUESTIONS[i]} className="space-y-3">
          {HIT6_OPTIONS.map((opt) => {
            const selected = answers[i] === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAnswers((prev) => prev.map((a, j) => (j === i ? opt.value : a)))}
                className={`flex min-h-row w-full items-center gap-3 rounded-card px-card py-control-y text-left transition-colors ring-1 ring-inset ${
                  selected
                    ? 'bg-selected-fill font-semibold text-text-primary ring-accent'
                    : 'bg-bg-surface text-text-primary ring-bg-border hover:bg-bg-raised'
                }`}
              >
                <span className={`text-[1.375rem] ${selected ? 'text-accent-light' : 'text-text-secondary'}`}>
                  <RadioDot selected={selected} />
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      </ProfileSubPage>
    );
  }

  // ── Intro (05-0) ──────────────────────────────────────────────────────
  return (
    <ProfileSubPage
      key="intro"
      title="Headache impact"
      titleInPage
      onClose={onClose}
      footer={
        <button type="button" onClick={() => setStage(0)} className="btn-primary btn-inline w-full">
          {entries.length === 0 ? 'Start' : 'Answer again'}
        </button>
      }
    >
      <div className="space-y-6">
        <p className="text-text-primary">
          Six quick questions about how headaches have affected your last four weeks — a standard
          questionnaire (HIT-6) that many headache clinics use.
        </p>

        <ul role="list" className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
          <IntroRow icon={<ClockGlyph />} title="About a minute" detail="Six multiple-choice questions" />
          <IntroRow
            icon={<LockGlyph />}
            title="Only you see it"
            detail={signedIn ? 'Saved in your diary and your own account' : 'Saved in your diary, sent nowhere'}
          />
          <IntroRow icon={<CalendarGlyph />} title="Every few weeks" detail="The questions ask about a 4-week window" />
        </ul>

        <p className="text-sm text-text-secondary">
          You’ll get a score to track over time, not a diagnosis. It can’t be edited once saved, since each one
          records a particular four weeks — but you can delete it.
        </p>

        {history.length > 0 && (
          <section className="space-y-2">
            <h3 className="mx-1 text-xs font-semibold text-text-secondary">
              Earlier answers
            </h3>
            <ul role="list" className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
              {history.map((e) => (
                <li key={e.id} className="flex min-h-row items-center gap-3 pl-card pr-2">
                  <span className="w-8 text-lg font-semibold text-text-primary">{e.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text-primary">{hit6Band(e.score).label}</span>
                    <span className="block text-xs text-text-secondary">{formatDateShort(e.takenAt)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(e)}
                    className="btn-tertiary btn-compact text-text-secondary"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
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

/** The scale, 36 to 78, in the instrument's four bands, with the score
 *  marked. Decorative — the number and the band label above say it all.
 *
 *  Band edges sit **between** whole scores (49.5, 55.5, 59.5), so every
 *  score's marker lands inside its own band — with edges on the scores
 *  themselves, 49, 55 and 59 sat on the gap and a 59 could read as "a lot"
 *  (review of db053be). Segments and marker share one coordinate (`pct`);
 *  the 2px gaps are cut from each segment, not added between them. */
function ScoreBar({ score }: { score: number }) {
  const edge = (b: (typeof HIT6_BANDS)[number]) => ({
    from: pct(Math.max(HIT6_MIN, b.from - 0.5)),
    to: pct(Math.min(HIT6_MAX, b.to + 0.5)),
  });
  // A word under three bands, centred on each. "some" sits over 50–55 only —
  // the board stretched it over 56–59 too, which put a "Substantial impact"
  // score under "some". 56–59 has no word: too narrow, and the pill names it.
  const labels = HIT6_BANDS.filter((b) => b.short).map((b) => {
    const e = edge(b);
    return { text: b.short, at: (e.from + e.to) / 2 };
  });
  return (
    <div aria-hidden="true" className="mt-5">
      <div className="relative h-2">
        {HIT6_BANDS.map((b, i) => {
          const e = edge(b);
          const first = i === 0;
          const last = i === HIT6_BANDS.length - 1;
          return (
            <span
              key={b.from}
              className={`absolute inset-y-0 ${TONE_BG[b.tone]} ${first ? 'rounded-l-full' : ''} ${last ? 'rounded-r-full' : ''}`}
              style={{
                left: first ? `${e.from}%` : `calc(${e.from}% + 1px)`,
                width: `calc(${e.to - e.from}% - ${(first ? 0 : 1) + (last ? 0 : 1)}px)`,
              }}
            />
          );
        })}
        <span
          className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-text-strong ring-2 ring-bg-surface"
          style={{ left: `${pct(score)}%` }}
        />
      </div>
      <div className="relative mt-2 h-5 text-xs text-text-secondary">
        <span className="absolute left-0">{HIT6_MIN}</span>
        {labels.map((l) => (
          <span key={l.text} className="absolute -translate-x-1/2" style={{ left: `${l.at}%` }}>{l.text}</span>
        ))}
        <span className="absolute right-0">{HIT6_MAX}</span>
      </div>
    </div>
  );
}

function IntroRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <li className="flex items-center gap-4 p-card">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-raised text-text-secondary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-text-primary">{title}</span>
        <span className="block text-text-primary">{detail}</span>
      </span>
    </li>
  );
}

// Lucide clock / lock / calendar, at the app's 1.8 stroke.
const GLYPH = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'size-5' } as const;
function ClockGlyph() {
  return <svg {...GLYPH}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
}
function LockGlyph() {
  return <svg {...GLYPH}><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
}
function CalendarGlyph() {
  return <svg {...GLYPH}><path d="M8 2v4M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>;
}
