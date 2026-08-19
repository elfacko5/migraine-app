interface Props {
  onStart: () => void;
  onDismiss: () => void;
  /** True when nothing has ever been answered — the card has to explain
   *  itself rather than assume the questionnaire is already familiar. */
  first: boolean;
}

/**
 * The Today card offering the HIT-6 when it's due.
 *
 * **This reverses an earlier decision**, on Sunny's instruction (2026-08-19).
 * HIT-6 originally signalled only through a quiet "Due" on the Profile row,
 * on the reasoning that a six-question form put in front of someone
 * mid-attack is answered badly or dismissed to be rid of it. The Profile row
 * stays, but a marker on a settings page nobody opens is a reminder that
 * never fires — and a questionnaire answered every four weeks is worth one
 * prompt on the screen you actually land on.
 *
 * Two things keep it from becoming the nagging the original rule feared, and
 * both matter:
 *
 * - **Clearing it lasts.** Being due is durable, unlike impact's 24-hour
 *   window, so a session-only dismissal would put the card back on the next
 *   launch and every launch after. "Not now" means not this cycle — four more
 *   weeks (`hit6Due`, `hd_hit6_dismissed`).
 * - **It doesn't show in attack mode.** That mode carries only what changes
 *   the next hour, and this changes nothing. It is the case ImpactPrompt is
 *   an exception to, not another one.
 */
export function Hit6Prompt({ onStart, onDismiss, first }: Props) {
  return (
    <div className="rounded-xl bg-bg-surface p-4">
      <p className="text-sm text-text-primary">
        {first
          ? 'How much are headaches affecting your life?'
          : 'Time to check in on how headaches are affecting your life'}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        {first
          ? 'Six short questions about the last four weeks. Your diary counts the days; this asks what they cost you.'
          : 'Six short questions about the last four weeks — it\'s been a month since the last one.'}
      </p>
      {/* The in-card size, hugging its text in a wrapping row — the same
          shape as the hero card's pair directly above this one. A card action
          is not a footer action: full-width `flex-1` buttons here made two
          cards a few pixels apart look like different systems. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onStart} className="btn-primary btn-compact">
          Answer now
        </button>
        <button type="button" onClick={onDismiss} className="btn-secondary btn-compact">
          Not now
        </button>
      </div>
    </div>
  );
}
