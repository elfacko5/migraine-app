import { PAIN_QUALITY_OPTIONS } from '../types';
import { ChipSelector } from './ChipSelector';
import { SymptomIcon, ReliefIcon } from './drawnIcons';

/**
 * The opt-in tail of the two in-attack flows, Live and Update (2026-11-27,
 * Sunny's call). Each flow asks only what makes a complete reading — time,
 * pain and severity, medication — and then offers the rest as a choice:
 * someone deep in an attack saves, someone who can manage it answers more.
 *
 * Nothing is lost by saving at the offer: End asks the same three questions,
 * and Detail keeps them open for 48 h after (`editWindow.ts`).
 *
 * Past and End keep asking these inline — neither is filled in mid-attack.
 */
export const OFFER_TITLE = 'Up for a few more questions?';
export const OFFER_SUBHEAD = 'What it felt like, other symptoms, what you tried. Fine to leave for later.';
export const EXTRAS_TITLE = 'A few more';

export function MoreQuestionsFields({ idPrefix, showFeltLike, painQuality, onPainQuality, symptomOptions, symptoms, onSymptoms, onAddSymptom, reliefOptions, reliefs, onReliefs, onAddRelief }: {
  idPrefix: string;
  /** Update hides it on an ended attack past Detail's own answers window. */
  showFeltLike: boolean;
  painQuality: string[];
  onPainQuality: (v: string[]) => void;
  symptomOptions: string[];
  symptoms: string[];
  onSymptoms: (v: string[]) => void;
  onAddSymptom: (s: string) => void;
  reliefOptions: string[];
  reliefs: string[];
  onReliefs: (v: string[]) => void;
  onAddRelief: (r: string) => void;
}) {
  return (
    <div className="space-y-6">
      {showFeltLike && (
        <section className="space-y-2" aria-labelledby={`${idPrefix}-felt-like-label`}>
          <h3 id={`${idPrefix}-felt-like-label`} className="text-sm font-medium text-text-primary">
            Felt like
          </h3>
          <ChipSelector options={PAIN_QUALITY_OPTIONS} selected={painQuality} onChange={onPainQuality} />
        </section>
      )}
      <section className="space-y-2" aria-labelledby={`${idPrefix}-symptoms-label`}>
        <h3 id={`${idPrefix}-symptoms-label`} className="text-sm font-medium text-text-primary">
          Also had
        </h3>
        <ChipSelector options={symptomOptions} selected={symptoms}
          onChange={onSymptoms} onAddCustom={onAddSymptom}
          renderIcon={(s) => <SymptomIcon name={s} className="h-4 w-4" />} />
      </section>
      <section className="space-y-2" aria-labelledby={`${idPrefix}-reliefs-label`}>
        <h3 id={`${idPrefix}-reliefs-label`} className="text-sm font-medium text-text-primary">
          What have you tried?
        </h3>
        <ChipSelector options={reliefOptions} selected={reliefs}
          onChange={onReliefs} onAddCustom={onAddRelief}
          renderIcon={(r) => <ReliefIcon name={r} className="h-4 w-4" />} />
      </section>
    </div>
  );
}
