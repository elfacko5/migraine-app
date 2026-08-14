import type { ReactNode } from 'react';

interface Props {
  /** Decorative artwork, bled off the card's right edge. */
  image: string;
  /** Small label above the headline — "Attack-free for", "Ongoing attack". */
  label: string;
  /** The one thing the card exists to say, at a glance. */
  headline: string;
  /** Supporting line under the headline. */
  detail: ReactNode;
  /** When set, the text block becomes the way through to the detail view. */
  onOpenDetail?: () => void;
  /** Action buttons, laid out in a row under the text. */
  children: ReactNode;
}

/**
 * The Today tab's hero card: artwork on the right, text and actions on the
 * left, one dark gradient tying the two together.
 *
 * The artwork is `aria-hidden` and has an empty `alt` — it carries mood, not
 * information, and every fact on the card is also in the text beside it. A
 * screen reader announcing "abstract illustration of hands" between the
 * headline and the buttons would be noise.
 *
 * **The gradient is what makes the image usable as a backdrop.** It runs
 * left-to-right from the card's own surface colour to fully transparent, so
 * the artwork emerges out of the card rather than sitting in a panel next to
 * it, and the text side stays flat enough to read at any severity. The stops
 * are weighted towards the left (opaque through 38%, still a third covered at
 * 62%) because the text is the thing that must survive — this app is read
 * mid-migraine, and contrast under a headline matters more than showing every
 * pixel of the picture.
 *
 * Only the *text* is width-limited, not the whole content column. The buttons
 * need the full card width to sit on one row, and they're solid shapes with
 * their own background, so they read fine over the artwork where a line of
 * body text would not.
 */
export function HomeCard({ image, label, headline, detail, onOpenDetail, children }: Props) {
  const text = (
    <>
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="text-xl font-bold leading-tight text-text-primary">{headline}</p>
      <p className="text-sm text-text-secondary">{detail}</p>
    </>
  );

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-bg-border bg-bg-surface">
      <img
        src={image}
        alt=""
        aria-hidden="true"
        // Square artwork cropped to a wide strip: `object-cover` keeps it from
        // squashing, and the right-hand anchor keeps each image's subject
        // (the moon, the swirl) inside the visible part rather than centred
        // under the gradient's opaque end.
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-3/5 object-cover object-right"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-bg-surface from-38% via-bg-surface/35 via-62% to-transparent to-85%"
      />

      {/* Generous vertical padding, and the text lines given room to breathe
          rather than set solid: this card is glanceable-by-design and is read
          with a headache, where tightly-stacked lines are the first thing to
          become hard work. */}
      <div className="px-5 py-6">
        {onOpenDetail ? (
          // The text block is the way into the detail view — the card itself
          // can't be the tap target with buttons inside it, and a third
          // button just to say "Details" would clutter a card whose whole
          // job is to be glanceable.
          <button
            type="button"
            onClick={onOpenDetail}
            className="-m-1 block max-w-[64%] space-y-1.5 rounded-lg p-1 text-left transition-colors hover:bg-bg-raised/40 active:bg-bg-raised/60"
          >
            {text}
          </button>
        ) : (
          <div className="max-w-[64%] space-y-1.5">{text}</div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-5">{children}</div>
      </div>
    </div>
  );
}
