import type { ReactNode } from 'react';

interface Props {
  /** Decorative artwork, bled off the card's right edge. */
  image: string;
  /**
   * Which edge of the artwork to keep when `object-cover` crops it.
   *
   * Per-image, because it depends on where the subject sits in the source and
   * how much dead margin surrounds it — there is no single right answer. The
   * ongoing card's art is pre-trimmed tight to its subject, so its right edge
   * is the one to keep; the attack-free art is a full square with the moon
   * left of centre, so keeping its left edge is what carries the moon into
   * the visible strip instead of burying it under the gradient.
   */
  imageAnchor: 'left' | 'right';
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
export function HomeCard({ image, imageAnchor, label, headline, detail, onOpenDetail, children }: Props) {
  const text = (
    <>
      {/* Deliberately uneven gaps, to spec: 4px under the label so it reads as
          a kicker attached to the headline, then 16px before the detail line
          so it separates as its own fact. A uniform stack made the label float
          between the two. */}
      <p className="text-base text-text-secondary">{label}</p>
      {/* Never wrapped. "Started 24h 38m" broke onto a second line against the
          64% text width and pushed the card taller for no reason — the
          headline is the one line that has to be readable at a glance, and
          running it over the artwork costs nothing, since the buttons already
          do the same. It overflows the width-limited block deliberately. */}
      <p className="mt-1 whitespace-nowrap text-2xl font-bold leading-tight text-text-primary">{headline}</p>
      {/* Also never wrapped, for the same reason as the headline and measured
          the same way: "Since Tue 18 Aug, 20:18" needs more than the 188.8px
          the 64% block allows, so it broke after the comma and made a date and
          a time read as two facts stacked on top of each other. It's a single
          value and belongs on a single line. Like the headline it overflows
          the width-limited block onto the artwork, which the gradient is
          already built to carry. */}
      <p className="mt-4 whitespace-nowrap text-base text-text-secondary">{detail}</p>
    </>
  );

  // No border. Nothing else on Today has one — the summary tiles, the impact
  // prompt and the overuse warning all separate from the page by sitting a
  // tone lighter than it — so an outline here made the hero read as a
  // different kind of object from the cards under it. Same reasoning that took
  // the border off SnapshotRow.
  return (
    <div className="relative isolate overflow-hidden rounded-2xl bg-bg-surface">
      <img
        src={image}
        alt=""
        aria-hidden="true"
        // Square artwork cropped to a wide strip: `object-cover` keeps it from
        // squashing, and the right-hand anchor keeps each image's subject
        // (the moon, the swirl) inside the visible part rather than centred
        // under the gradient's opaque end.
        //
        // `object-cover` always overflows this box horizontally, so one side
        // of the source is trimmed either way — `imageAnchor` picks which.
        // Note the counter-intuitive part: keeping the *left* edge is what
        // pushes a centred subject *right*, because the trimming comes off the
        // other side.
        className={`pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-1/2 object-cover ${
          imageAnchor === 'right' ? 'object-right' : 'object-left'
        }`}
      />
      <div
        aria-hidden="true"
        // The opaque stop has to sit *past* the image's left edge (50%), not
        // before it. The image is a hard-edged box: wherever the gradient is
        // already translucent at that edge, flat card colour meets artwork in
        // one step and the seam is visible straight down the card. Staying
        // fully opaque to 53% hides the join and lets the artwork fade up out
        // of the card, which is the whole point of the gradient.
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-bg-surface from-53% via-bg-surface/35 via-74% to-transparent to-92%"
      />

      {/* Generous padding, and the text lines given room to breathe rather
          than set solid: this card is glanceable-by-design and is read with a
          headache, where tightly-stacked lines are the first thing to become
          hard work. Sized against the Figma comp, where the card is roughly
          half as tall as it is wide — the built version was nearer a third. */}
      <div className="px-6 py-8">
        {onOpenDetail ? (
          // The text block is the way into the detail view — the card itself
          // can't be the tap target with buttons inside it, and a third
          // button just to say "Details" would clutter a card whose whole
          // job is to be glanceable.
          <button
            type="button"
            onClick={onOpenDetail}
            className="-m-1 block max-w-[64%] rounded-lg p-1 text-left transition-colors hover:bg-bg-raised/40 active:bg-bg-raised/60"
          >
            {text}
          </button>
        ) : (
          <div className="max-w-[64%]">{text}</div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-6">{children}</div>
      </div>
    </div>
  );
}
