// Icons supplied as SVG files in `/icons` at the repo root, hand-inlined here
// as components. Adding one: drop the file in `/icons`, then add a component
// below.
//
// Three things change on the way in:
//  - the `<style>`/`class="a"` block the exports carry becomes attributes on
//    the <svg>. Left as-is it would define a global `.a` rule in whichever
//    component rendered first, and the last one to render would win.
//  - `<title>` is dropped. These are decorative: every one of them sits in a
//    button that already carries an aria-label, and a title would be read out
//    twice.
//  - stroke stays `currentColor` and size comes from `className`, so an icon
//    inherits the colour and text size of whatever it's placed in.

interface IconProps { className?: string }

export function BinIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.25,21H6.75a1.5,1.5,0,0,1-1.5-1.5V6h13.5V19.5A1.5,1.5,0,0,1,17.25,21Z" />
      <line x1="9.75" y1="16.5" x2="9.75" y2="10.5" />
      <line x1="14.25" y1="16.5" x2="14.25" y2="10.5" />
      <line x1="2.25" y1="6" x2="21.75" y2="6" />
      <path d="M14.25,3H9.75a1.5,1.5,0,0,0-1.5,1.5V6h7.5V4.5A1.5,1.5,0,0,0,14.25,3Z" />
    </svg>
  );
}


// "Woke up with this migraine" — inlined from `icons/day-sunrise-2.svg`,
// replacing a hand-drawn stand-in.
//
// It replaces a 🌙 before that. The moon was the wrong metaphor — it says
// *night*, where what's being recorded is the moment of waking — but the
// reason this isn't a 🌅 either is the palette. That emoji is saturated orange
// and yellow, the one hue family the app works hardest to avoid (it's why the
// focus ring is restyled at all), which would have made the least important
// glyph on the card the brightest thing on the page. In `currentColor` it
// inherits whatever it sits in — including a toggle's pressed state, which an
// emoji could not have followed.
//
// Three things changed on the way in, the usual set: the `<style>` block's
// `.cls-1` rule became attributes on the `<svg>` (left alone it's a *global*
// class and the last icon to render wins), `<title>` dropped since every
// caller supplies its own label, and `aria-hidden` added. The source's
// `id="Regular"` went too — a document-global id that every instance would
// duplicate.
export function SunriseIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="0.75" y1="20.207" x2="23.25" y2="20.207" />
      <line x1="12" y1="5.207" x2="12" y2="3.707" />
      <line x1="18.894" y1="8.062" x2="19.955" y2="7.002" />
      <line x1="21.75" y1="14.957" x2="23.25" y2="14.957" />
      <line x1="2.25" y1="14.957" x2="0.75" y2="14.957" />
      <line x1="5.106" y1="8.062" x2="4.045" y2="7.002" />
      <path d="M18.337,17.207a6.75,6.75,0,1,0-12.674,0" />
    </svg>
  );
}

// The brightness mark — a sun, inlined from `icons/brightness 1.svg`. It
// replaces a `🔆` emoji (2026-08-25), which was the last one left in the app
// and broke the rule the attack-mode pill gave up its own emoji for: a
// full-colour glyph can't inherit `currentColor`, so it made the brightest
// thing on screen a control that exists to make the screen dimmer.
//
// The usual three changes on the way in, plus one: each path's literal
// `stroke="black"` moves to the `<svg>` as `currentColor`, and the wrapping
// `<g clip-path>` and its `<clipPath>` def are dropped — the clip rect was the
// full viewBox, so it clipped nothing, and its id was a document-global that
// would collide with itself the moment the icon rendered twice.
export function BrightnessIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 16.5A4.5 4.5 0 1 0 12 7.5a4.5 4.5 0 0 0 0 9Z" />
      <path d="M12 1.5v3" />
      <path d="M12 19.5v3" />
      <path d="M22.5 12h-3" />
      <path d="M4.5 12h-3" />
      <path d="M19.425 4.576 17.304 6.697" />
      <path d="M6.697 17.304 4.576 19.425" />
      <path d="M19.425 19.425 17.304 17.304" />
      <path d="M6.697 6.697 4.576 4.576" />
    </svg>
  );
}
