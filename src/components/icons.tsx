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
