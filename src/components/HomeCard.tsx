import type { ReactNode } from 'react';

interface Props {
  /** Decorative artwork, filling the right-hand side of the hero. */
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
  /**
   * A greeting above the label, on the attack-free hero only. It is where the
   * "Hello" that `TopBar` used to carry on Today went — the hero took the top
   * of the screen, and a page that opens on a bare figure reads colder than
   * the app is meant to. Deliberately absent mid-attack: a "Good morning"
   * above "Ongoing attack" would be the app failing to notice.
   */
  greeting?: string;
  /** Small label above the headline — "Attack-free for", "Ongoing attack". */
  label: string;
  /** The one thing the hero exists to say, at a glance. */
  headline: string;
  /**
   * Supporting line under the headline. Optional: the attack-free hero has
   * none, because the only fact it had to offer there was the date the last
   * attack ended, which is the headline's own figure said a second way.
   */
  detail?: ReactNode;
  /** When set, the text block becomes the way through to the detail view. */
  onOpenDetail?: () => void;
  /**
   * Action buttons, laid out in a row under the text. Optional, and usually
   * absent: the nav's FAB is the way to log an attack or add a reading, so the
   * hero carries only an action the FAB *can't* express — today that is
   * "End attack" and nothing else. See the note in `OngoingAttackBanner`.
   */
  children?: ReactNode;
}

/**
 * The Today tab's hero: artwork on the right, text and any action on the
 * left, fading into the page on every edge.
 *
 * **It is not a card, and that is the point.** It used to be a rounded
 * `bg-bg-surface` panel inset in the page padding, which meant a hard-edged
 * image box sitting inside a hard-edged card — two visible frames around the
 * one thing on Today that should feel like the top of the screen rather than
 * an object on it. It now bleeds past the page padding (`-mx-4`) and up to the
 * top of the scroll region (`-mt-5`, with Today rendering no `TopBar` above
 * it), stopping just short of the status bar.
 *
 * **The blend works because the hero has no background of its own.** The
 * gradients fade from `bg-bg-base` — the page colour itself — so the artwork
 * dissolves into the page rather than into a card tone that then has to meet
 * the page at a seam of its own. One per edge the image actually has: across,
 * down from the top, and up from the bottom. They fade to `bg-bg-base/0`
 * rather than `transparent`, so the interpolation runs through the page colour
 * at decreasing alpha instead of through rgba(0,0,0,0), which greys the
 * mid-stops.
 *
 * The stops stay weighted towards the left, for the same reason they always
 * were: this app is read mid-migraine, and contrast under the headline matters
 * more than showing every pixel of the picture. Tune the stops, not the image.
 *
 * The artwork is `aria-hidden` with an empty `alt` — it carries mood, not
 * information, and every fact is in the text beside it.
 */
export function HomeCard({ image, imageAnchor, greeting, label, headline, detail, onOpenDetail, children }: Props) {
  const text = (
    <>
      {/* Deliberately uneven gaps, to spec: 4px under the label so it reads as
          a kicker attached to the headline, then 16px before the detail line
          so it separates as its own fact. A uniform stack made the label float
          between the two. */}
      {greeting && <p className="text-base text-text-secondary">{greeting}</p>}
      <p className="text-base text-text-secondary">{label}</p>
      {/* Never wrapped. "Started 24h 38m" broke onto a second line against the
          64% text width and pushed the hero taller for no reason — the
          headline is the one line that has to be readable at a glance, and
          running it over the artwork costs nothing. */}
      <p className="mt-1 whitespace-nowrap text-2xl font-bold leading-tight text-text-primary">{headline}</p>
      {/* Also never wrapped, for the same reason and measured the same way:
          "Since Tue 18 Aug, 20:18" needs more than the 64% block allows, so it
          broke after the comma and made a date and a time read as two facts
          stacked on top of each other. */}
      {detail && <p className="mt-4 whitespace-nowrap text-base text-text-secondary">{detail}</p>}
    </>
  );

  return (
    // -mx cancels the page's own horizontal padding so the artwork reaches
    // both screen edges; -mt-5 cancels the scroll container's pt-5. Today
    // renders no TopBar while a hero is on screen — the label and headline
    // are the page's heading.
    //
    // **The artwork stops short of the very top, on top of the safe-area
    // inset.** It ran to y=0 and under the status bar, which put the clock and
    // the battery on top of the picture. The gap is small and deliberate: it
    // reads as the artwork starting just below the status bar rather than as a
    // band of chrome above it. The inset is added, never substituted — it
    // reads as 0 in the browser preview, so a flat value tuned here would look
    // right on desktop and sit under the clock on device.
    <div className="-mx-4 sm:-mx-6" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
      {/* The band the artwork and the text share. Its height is what sizes the
          image: the source is square and `object-cover` scales to cover, so
          with the box taller than it is wide the *height* drives the scale and
          a shorter band renders a smaller, less-cropped picture. If the
          artwork ever looks too zoomed, this is the number — not the width. */}
      <div className="relative isolate flex min-h-[19rem] items-center px-4 py-8 sm:px-6">
        <img
          src={image}
          alt=""
          aria-hidden="true"
          // `object-cover` always overflows this box horizontally, so one side
          // of the source is trimmed either way — `imageAnchor` picks which.
          // Note the counter-intuitive part: keeping the *left* edge is what
          // pushes a centred subject *right*, because the trimming comes off
          // the other side.
          className={`pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-[64%] object-cover ${
            imageAnchor === 'right' ? 'object-right' : 'object-left'
          }`}
        />
        {/* Three fades, one per edge the image actually has. Across: opaque
            past its left edge (36%), so the hard box edge is never visible in
            a stretch the gradient has already started to fade. Down from the
            top and up from the bottom: the edges the old card's radius used to
            hide, and the top one only exists because the artwork no longer
            runs to the screen edge there. The right needs nothing — the image
            reaches the viewport. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-bg-base from-40% via-bg-base/55 via-66% to-bg-base/0 to-90%"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30%] bg-gradient-to-b from-bg-base via-bg-base/45 via-40% to-bg-base/0"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-bg-base via-bg-base/55 via-40% to-bg-base/0"
        />

        {/* Centred against the artwork rather than sitting at the top of it:
            the picture is the other half of this composition, and a text block
            top-aligned against a full-height image reads as text that happens
            to have a picture behind it. `items-center` on the band is what
            does it, so the two stay centred on each other however the band
            grows at larger text sizes. */}
        <div className="w-full">
          {onOpenDetail ? (
            // The text block is the way into the detail view — a hero this
            // size can't be one tap target, and a button just to say "Details"
            // would clutter something whose whole job is to be glanceable.
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

          {/* Only rendered when there is an action. An empty row would still
              cost its own pt-6. */}
          {children && <div className="flex flex-wrap items-center gap-2 pt-6">{children}</div>}
        </div>
      </div>
    </div>
  );
}
