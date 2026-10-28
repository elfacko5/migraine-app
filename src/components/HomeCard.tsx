import type { ReactNode } from 'react';

interface Props {
  /**
   * Decorative artwork, filling the right-hand side of the hero — one of the
   * drawn pieces in `heroArt.tsx`. A node rather than an image URL, so it can
   * take its colours from the theme tokens instead of being a fixed picture.
   */
  art: ReactNode;
  /**
   * The kicker above the headline: a time-of-day greeting between attacks,
   * "Ongoing attack" during one. Never a greeting mid-attack — "Good morning"
   * above an ongoing attack would be the app failing to notice.
   */
  label: string;
  /** The one thing the hero exists to say, at a glance. */
  headline: string;
  /**
   * A small figure between the headline and the detail line — the ongoing
   * hero's trajectory. When present, the detail line sits 8px under it
   * instead of 16px under the headline: the figure is what separates them.
   */
  figure?: ReactNode;
  /**
   * Supporting line under the headline — "since your last attack", or where
   * an ongoing attack sits now. Optional; nothing passes a date here, which
   * would be the headline's own figure said a second way.
   */
  detail?: ReactNode;
  /**
   * A control pinned to the hero's top-left corner — the attack mode button,
   * since v3 (moved from the right on 2026-10-28, and icon-only since). The
   * text block's 110px top padding still clears it. Positioned against the
   * hero, so it scrolls away with it.
   */
  topAction?: ReactNode;
  /** When set, the text block becomes the way through to the detail view. */
  onOpenDetail?: () => void;
  /**
   * Action buttons, laid out in a row under the text. Optional, and usually
   * absent on the attack-free hero. The ongoing hero carries "Add an update"
   * and "End attack" — see the note in `OngoingAttackBanner` for why both.
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
 * The artwork is `aria-hidden` and `focusable="false"` — it carries mood, not
 * information, and every fact is in the text beside it.
 */
export function HomeCard({ art, label, headline, figure, detail, topAction, onOpenDetail, children }: Props) {
  const text = (
    <>
      {/* Deliberately uneven gaps, to spec: 4px under the label so it reads as
          a kicker attached to the headline, then 16px before the detail line
          so it separates as its own fact. A uniform stack made the label float
          between the two. */}
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      {/* Never wrapped. "Started 24h 38m" broke onto a second line against the
          64% text width and pushed the hero taller for no reason — the
          headline is the one line that has to be readable at a glance, and
          running it over the artwork costs nothing. 44px at weight 600 with a
          tight 1.05 line-height, to the v3 spec; written in rem so the
          text-size control still scales it. */}
      <p className="mt-1 whitespace-nowrap text-[2.75rem] font-semibold leading-[1.05] text-text-primary">{headline}</p>
      {/* Allowed to wrap now. It was `whitespace-nowrap` because a date and a
          time ("Since Tue 18 Aug, 20:18") broke after the comma and read as
          two facts; neither hero carries a date any more, and at the largest
          text size a nowrap line would run off the screen edge. */}
      {figure && <span className="mt-3.5 block">{figure}</span>}
      {detail && <p className={`${figure ? 'mt-2' : 'mt-4'} text-base text-text-primary`}>{detail}</p>}
    </>
  );

  return (
    // -mx cancels the page's own horizontal padding so the artwork reaches
    // both screen edges; the scroll container's pt-5 is cancelled by -mt-5.
    // Today renders no TopBar while a hero is on screen — the label and
    // headline are the page's heading.
    //
    // **The hero runs to the top of the screen and the artwork does not.** The
    // art box starts 40px below the hero's top edge, *on top of* the safe-area
    // inset — never instead of it, since the inset reads as 0 in the browser
    // preview and a flat value tuned there would sit under the clock on
    // device. Running the picture to y=0 put the clock and battery on top of
    // it.
    //
    // **No `isolate`, and the layers carry explicit z-indices instead.** The
    // hero used to be its own stacking context with the art at -z-10, which
    // was fine until it held the attack mode button: that control has to sit
    // *above* the attack-mode dim scrim (z-35 on the shell root), because it
    // is the control that turns attack mode off — the floating pill sat at
    // z-45 for the same reason. Inside an isolated hero no z-index can escape
    // to the root, so the art and fades are z-0, the text z-1, and the button
    // z-45 in the root's own stacking context. Sheets (z-50) still cover it.
    <div className="relative -mx-4 -mt-5 flex min-h-[20rem] items-center sm:-mx-6">
      {/* Right-aligned and 64% wide. With the drawn art the box's *height*
          still drives the scale — `xMaxYMid slice` covers the box the way
          `object-cover` did — so if it ever looks too zoomed, the number is
          the hero's min-height, not this width. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 z-0 w-[64%] [&>svg]:h-full [&>svg]:w-full"
        style={{ top: 'calc(2.5rem + env(safe-area-inset-top))' }}
      >
        {art}
      </div>
      {/* Three fades, one per edge the image actually has. Across: opaque
          past its left edge (36%), so the hard box edge is never visible in
          a stretch the gradient has already started to fade. Down from the
          top and up from the bottom: the edges the old card's radius used to
          hide, and the top one only exists because the artwork no longer
          runs to the screen edge there. The right needs nothing — the image
          reaches the viewport. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-bg-base from-40% via-bg-base/55 via-66% to-bg-base/0 to-90%"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[30%] bg-gradient-to-b from-bg-base via-bg-base/45 via-40% to-bg-base/0"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-2/5 bg-gradient-to-t from-bg-base via-bg-base/55 via-40% to-bg-base/0"
      />

      {/* Centred against the artwork rather than sitting at the top of it:
          the picture is the other half of this composition, and a text block
          top-aligned against a full-height image reads as text that happens
          to have a picture behind it. `items-center` on the band is what
          does it, so the two stay centred on each other however the hero
          grows at larger text sizes. */}
      {topAction && (
        <div
          className="absolute left-4 z-[45]"
          style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          {topAction}
        </div>
      )}

      {/* 24px sides and bottom, to spec. The 110px top clears the attack mode
          button above it, on top of the safe-area inset — added rather than
          substituted, for the same reason as the art box. */}
      <div
        className="relative z-[1] w-full px-6 pb-6"
        style={{ paddingTop: 'calc(6.875rem + env(safe-area-inset-top))' }}
      >
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
  );
}
