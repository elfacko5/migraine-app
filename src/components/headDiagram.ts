// Pain-area diagram geometry, inlined from the user's exported SVG
// ("New head.svg" at the repo root — front, back, and the three laterality
// heads that back `SideGlyph`). Each selectable area is one closed path from
// that file; the ears and the front neck are the paths it leaves unfilled.
//
// Two of the drawn regions cross the midline where the zone list has a left
// and a right — the chin and the low occipital band — so each is split down
// the midline here rather than in the artwork (Sunny's call, 2026-09-02). The
// splits are exact: the crossing beziers are subdivided at the intersection,
// not re-traced.
//
// Front is a MIRRORED view (screen-left = subject's right); back is direct.

export interface Zone {
  name: string;
  path: string;
  center: [number, number];
  label: string;
}

export interface DiagramView {
  id: string;
  label: string;
  viewBox: string;
  base: string[];        // the head's full extent — the clip, and the ground
  outline: string[];     // stroked silhouette of the *selectable* body
  dividers: string[];    // dashed section lines
  inert: string[];       // drawn but never selectable — the ears, the front neck
  details: string[];     // solid feature strokes (the nostrils, the eyelids)
  zones: Zone[];
  sideLabels: { left: string; right: string };
  showLabels: boolean;   // in-diagram text labels (off when too many zones)
}

// ── Palette ─────────────────────────────────────────────────────────────
export const HEAD_FILL = '#2b2823';
// The head's silhouette. Dropped from 0.55 (and 4 wide) on 2026-09-03 — it was
// the loudest mark in a diagram whose loudest mark should be the reading, and
// on a screen the palette works to keep quiet. It can afford to go quiet
// without losing anything: the outer edge of every edge zone is *also* drawn as
// a divider, clipped to the same line, so the boundary information survives at
// divider strength whatever the silhouette does.
export const LINE_COLOR = 'rgba(208,216,230,0.4)';
// The zone boundaries. **Do not take these down with the rest.** They measure
// 3.15:1 against the head, which is the floor WCAG 1.4.11 asks of the visual
// information that identifies a control, and here they are exactly that — the
// lines that say where one tappable region ends and the next begins.
export const DIVIDER_COLOR = 'rgba(208,216,230,0.45)';
// The nostrils and eyelids. The quietest mark in the diagram, and deliberately
// below the dividers: they identify nothing and record nothing, they only help
// you find your bearings on the face. They shipped at LINE_COLOR, which put a
// drawn eyelid at the same weight as the head's own edge.
export const DETAIL_COLOR = 'rgba(208,216,230,0.26)';
// Non-selectable regions — the ears, the front neck, and the jawline either
// side of the back's neck.
//
// **They are not a fifth surface tone, and that is the point.** They were
// `#26241f`, one step darker than the head: correct in direction (at the
// original `#a39d92` they were the *lightest* thing in the diagram, so the two
// areas you cannot touch drew the eye first) but far too quiet to read as a
// different class of thing — Sunny couldn't tell which parts were disabled
// (2026-09-03). Tone cannot fix it: this palette's dark end is compressed, and
// head-against-page is only 1.18:1 to begin with, so every candidate fill was
// either invisible or brighter than the thing it sits beside.
//
// So the signal is **texture, not lightness** — a categorical difference where
// the tonal range has none left to give. Three things together, and the hatch
// is the one doing the work (the other two were tried alone and weren't
// enough): the fill drops a step below every surface the diagram sits on, so
// the region reads as a recess rather than as more head; it carries a 45°
// hatch; and its outline is dimmed to `DISABLED_LINE`, because at full
// `LINE_COLOR` the ears and neck still read as parts of the same drawn object.
// Measured alternatives are in `docs/decisions.md`.
export const DISABLED_FILL = '#1b1a18';
export const DISABLED_HATCH = 'rgba(208,216,230,0.11)';
export const DISABLED_LINE = 'rgba(208,216,230,0.28)';
export const SELECTED_FILL = '#8fb096';
export const HOVER_FILL = 'rgba(208,216,230,0.14)';

// Same low/mid/high thresholds and colours as the severity-* CSS tokens
// (index.css) — used to tint each selected zone by its own severity.
const SEVERITY_LOW = '#8fb096';
const SEVERITY_MID = '#c39257';
const SEVERITY_HIGH = '#c68880';

export function sevFill(s: number): string {
  if (s <= 3) return SEVERITY_LOW;
  if (s <= 7) return SEVERITY_MID;
  return SEVERITY_HIGH;
}

// A darker shade of each severity colour, for the outline on the zone the
// slider is currently controlling.
//
// That outline used to be accent green, which meant a focused zone showed two
// unrelated colours at once — its severity as fill, and "this one is focused"
// as a bright ring — and the ring was the louder of the two on a screen the
// palette works to keep quiet. Same hue, darker, reads as an edge of the shape
// rather than a second signal competing with it.
const SEVERITY_LOW_EDGE = '#5c7a63';
const SEVERITY_MID_EDGE = '#7d5c35';
const SEVERITY_HIGH_EDGE = '#7d554f';

export function sevStroke(s: number): string {
  if (s <= 3) return SEVERITY_LOW_EDGE;
  if (s <= 7) return SEVERITY_MID_EDGE;
  return SEVERITY_HIGH_EDGE;
}

// ── FRONT ────────────────────────────────────────────────────────────────
const FRONT_HEAD =
  'M21.6947 358.497C17.1607 326.118 -3.14528 173.096 158.32 173.453C319.786 173.811 311.882 293.265 308.429 348.048C307.484 363.042 298.113 417.151 295.607 447.779C293.703 471.059 285.54 492.289 278.76 507.786C267.779 532.885 213.957 608.527 163.545 610.272C113.133 612.017 55.5697 537.189 46.3747 511.832C25.7487 454.947 26.6057 393.569 21.6947 358.497Z';
// Open path: three sides of the neck. It is part of `base` (so it is drawn and
// clipped with the head) but carries no zone, which is what makes it inert —
// there is no separate disabled shape to keep in step with it.
const FRONT_NECK =
  'M80.0436 558.492C80.0436 558.492 87.452 621.415 73 655.071C136.621 675.591 223.714 673.315 250.5 655.071C247.154 638.975 237.173 579.531 242.024 559.212';
// Ears are drawn and never selectable. They sit outside `base`, so they have
// to be named in `inert` to pick up the disabled treatment.
const FRONT_EARS = [
  'M23.0957 367.959C23.0957 367.959 -2.90928 352.673 3.79572 389.613C10.5007 426.553 19.1177 456.925 30.1917 443.681',
  'M306.925 364.232C306.925 364.232 328.236 352.201 324.079 385.777C319.923 419.354 305.499 448.169 295.606 447.778',
];
const FRONT_ZONES: Zone[] = [
  { name: 'Forehead right', label: 'Forehead', center: [108, 242], path: 'M43.4066 224.878C61.5606 197.373 81.7286 189.382 95.1686 183.636C104.606 179.602 140.889 170.838 162.576 173.491C162.648 257.205 162.648 257.205 162.72 340.918C153.077 340.831 149.015 340.842 140.463 340.872C129.461 319.627 103.554 323.887 83.3656 324.736C63.9296 293.572 56.7266 258.164 43.4066 224.878Z' },
  { name: 'Forehead left', label: 'Forehead', center: [218, 239], path: 'M282.421 222.566C266.282 199.859 246.226 191.106 232.785 185.361C223.348 181.326 200.093 174.012 162.863 173.366C162.791 257.08 162.791 257.08 162.719 340.794C173.386 340.778 173.276 340.778 184.976 340.747C196.763 321.65 221.582 325.049 240.797 325.763C260.233 294.599 269.102 255.853 282.421 222.566Z' },
  { name: 'Temple right',  label: 'Temple',   center: [46, 311], path: 'M43.4068 224.877C43.4068 224.877 69.2497 306.572 84.1917 324.621C60.8637 327.208 32.3687 352.463 36.4357 380.807C32.7127 385.346 26.6057 393.57 26.6057 393.57C26.6057 393.57 3.04775 277.19 43.4068 224.877Z' },
  { name: 'Temple left',   label: 'Temple',   center: [280, 311], path: 'M282.401 222.541C282.401 222.541 257.619 301.409 240.92 325.58C262.098 327.99 290.991 350.524 289.8 381.721C293.523 386.26 301.853 397.275 301.853 397.275C301.853 397.275 328.992 268.199 282.401 222.541Z' },
  { name: 'Eye right',     label: 'Eye',      center: [88, 367], path: 'M36.3207 378.127C32.5587 356.801 57.0017 325.804 88.1807 324.261C119.359 322.718 133.18 325.328 139.49 341.254C147.942 371.112 132.211 400.609 108.168 406.926C72.3687 416.5 40.0827 399.453 36.3207 378.127Z' },
  { name: 'Eye left',      label: 'Eye',      center: [237, 369], path: 'M288.824 379.289C292.586 357.963 268.143 326.966 236.964 325.423C205.785 323.881 191.964 326.49 185.654 342.416C177.203 372.274 192.934 401.772 216.977 408.088C252.776 417.663 285.062 400.615 288.824 379.289Z' },
  { name: 'Cheek right',   label: 'Cheek',    center: [69, 450], path: 'M36.3387 380.639C36.3387 380.639 30.1647 387.916 26.4097 393.878C27.7417 422.836 27.9557 498.818 68.2977 544.108C91.1507 527.217 109.726 513.446 109.726 513.446C109.726 513.446 109.492 489.372 106.677 451.172C106.388 447.243 107.537 424.755 81.1037 413.837C54.6707 402.919 47.9527 400.863 36.3387 380.639Z' },
  { name: 'Cheek left',    label: 'Cheek',    center: [257, 450], path: 'M289.819 381.689C289.819 381.689 295.994 388.966 299.749 394.927C294.968 450.393 298.905 489.519 255.4 543.339C233.634 525.645 216.464 512.446 216.464 512.446C216.464 512.446 216.667 490.422 219.481 452.222C219.77 448.293 218.621 425.805 245.054 414.887C271.488 403.969 278.206 401.913 289.819 381.689Z' },
  { name: 'Nose',          label: 'Nose',     center: [163, 443], path: 'M139.332 340.862C162.154 340.804 162.154 340.804 184.976 340.747C180.544 368.08 185.565 383.414 200.303 399.006C211.669 411.031 237.65 412.45 253.925 408.933C221.452 424.829 220.808 435.281 218.987 459.148C217.635 476.882 217.306 494.68 216.465 512.446C203.456 510.194 198.627 509.906 190.787 510.128C175.486 510.562 178.777 510.853 163.3 512.529C152.598 511.346 146.653 510.909 136.789 510.281C128.163 509.732 114.369 511.783 109.721 513.45C108.576 491.693 107.949 470.704 106.187 447.017C104.545 424.936 90.5436 418.552 75.2156 410.035C119.932 415.795 150.197 385.982 139.332 340.862Z' },
  { name: 'Jaw right',     label: 'Jaw',      center: [124, 549], path: 'M162.7 610.294C137.76 610.725 112.141 592.152 91.054 570.5C82.636 561.855 74.94 552.72 68.298 544.108C85.797 530.879 96.266 523.757 109.31 513.672C121.266 506.906 159.004 512.009 162.7 512.529L162.7 610.294Z' },
  { name: 'Jaw left',      label: 'Jaw',      center: [200, 548], path: 'M162.7 512.529C162.892 512.556 162.992 512.571 162.992 512.571C162.992 512.571 202.382 506.935 216.43 512.419C235.563 527.006 229.937 522.395 254.841 543.473C248.583 551.564 241.593 560.032 234.05 568.117C213.46 590.187 188.751 609.399 163.545 610.272C163.263 610.282 162.982 610.289 162.7 610.294L162.7 512.529Z' },
];

export const FRONT: DiagramView = {
  id: 'front',
  label: 'Front',
  // Crown at y+10, skull centred on x. See the note on BACK's viewBox.
  // Measured: skull box (18.42, 173.45, 291.3 × 436.9), silhouette bottom 669.6.
  viewBox: '-1.93 163.45 332 513',
  base: [FRONT_HEAD, FRONT_NECK],
  // The chin is selectable, so the head's own silhouette is the selectable
  // body's edge; the neck is not, so it moves to `inert` and is stroked dim.
  outline: [FRONT_HEAD],
  // The zone outlines *are* the section lines in this artwork — there is no
  // separate set of divider strokes to inline, and deriving them by hand would
  // be 20 paths that can drift out of step with the shapes they border.
  dividers: FRONT_ZONES.map((z) => z.path),
  inert: [FRONT_NECK, ...FRONT_EARS],
  // Nostrils and the two closed eyelids. Unlike the old artwork's mouth these
  // are drawn: the eyelid sits inside a zone called Eye and the nose names the
  // zone it sits in, so both help say which region is which rather than
  // decorating a control.
  details: [
    'M142.002 420.885C142.002 420.885 127.659 433.457 135.773 445.118',
    'M183.351 420.706C183.351 420.706 197.695 433.278 189.58 444.939',
    'M144.265 442.782C138.869 438.397 149.719 438.025 152.965 439.185C157.733 440.888 153.593 447.566 163.453 446.499C173.314 445.432 170.398 441.246 173.888 439.252C176.741 437.622 185.991 437.786 181.065 442.506',
    'M204.54 371.251C204.54 371.251 240.981 385.18 263.217 372.439',
    'M61.0557 373.177C61.0557 373.177 97.7067 385.955 119.626 371.896',
  ],
  // Mirrored: screen-right = subject's LEFT.
  zones: FRONT_ZONES,
  sideLabels: { left: 'Right', right: 'Left' },
  showLabels: false,
};

// ── BACK ─────────────────────────────────────────────────────────────────
const BACK_HEAD =
  'M466.913 555.844C452.04 538.483 441.202 521.213 437.637 511.38C417.011 454.495 417.867 393.117 412.956 358.045C408.423 325.666 388.116 172.644 549.582 173.001C711.047 173.359 703.143 292.813 699.691 347.596C698.746 362.59 689.374 416.699 686.868 447.327C684.964 470.607 676.801 491.837 670.022 507.333C665.615 517.404 654.312 535.612 639.1 553.918';
// The neck's outer edges only — its bottom and its two sides. The neck is two
// closed zones here, and stroking those as the silhouette would draw a solid
// line down the midline between them, where every other boundary in the
// diagram is a dotted divider. The shared edge is dropped instead.
const BACK_NECK_EDGES = [
  'M552.369 669.5C503 669.5 489 665 464.149 655C482.103 595.882 469.931 576.857 464.149 535.925',
  'M552.364 669.5C588.317 668.383 606.5 666.5 644.215 654.5C631.089 587.298 632.827 561.211 644.215 535.208',
];
const BACK_EARS = [
  'M414.222 366.32C414.222 366.32 389.801 353.598 399.694 395.686C406.917 426.411 413.959 443.625 422.003 444.483',
  'M698.407 363.662C698.407 363.662 724.919 349.446 715.026 391.534C707.212 424.773 696.447 443.293 687.488 442.927',
];

const BACK_ZONES: Zone[] = [
  { name: 'Top of head',   label: 'Top',      center: [553, 224], path: 'M541.173 271.821C509.188 269.606 469.937 254.48 456.463 200.3C476.792 183.939 506.093 173.256 548.492 173.351C596.38 173.459 631.221 183.393 653.083 199.951C641.488 234.175 610.886 255.892 600.384 260.735C582.928 268.785 567.731 273.66 541.173 271.821Z' },
  { name: 'Crown left',    label: 'Crown',    center: [465, 296], path: 'M553.455 370.832C498.367 359.144 478.12 325.788 413.387 355.881C411.497 326.05 399.901 246.806 455.632 200.976C467.894 240.823 491.215 270.274 553.794 272.195C554.008 314.808 553.332 348.23 553.455 370.832Z' },
  { name: 'Crown right',   label: 'Crown',    center: [648, 293], path: 'M553.836 370.832C608.924 359.144 624.221 324.793 698.916 356.999C701.318 328.301 712.122 241.487 653.073 199.943C636.461 235.088 609.26 270.795 553.497 272.195C553.283 314.808 553.959 348.23 553.836 370.832Z' },
  { name: 'Occiput left',  label: 'Occiput',  center: [482, 406], path: 'M553.843 369.408L553.852 456.076C553.852 456.076 491.046 453.526 447.145 484.678C429.315 431.975 416.087 399.651 413.387 355.88C478.416 323.432 517.698 368.385 553.843 369.408Z' },
  { name: 'Occiput right', label: 'Occiput',  center: [627, 410], path: 'M552.887 369.46C552.887 369.46 553.848 419.105 552.877 456.129C574.264 455.785 609.156 465.124 661.03 482.239C680.275 450.009 693.39 403.836 698.916 356.998C632.058 325.31 593.353 365.205 552.887 369.46Z' },
  { name: 'Nape left',     label: 'Nape',     center: [512, 501], path: 'M553.5 456.073C507.444 455.693 477.209 466.731 447.145 484.678C447.145 484.678 454.432 505.406 464.149 535.925C507.678 542.238 507.348 544.495 552.365 544.315C552.746 544.313 553.124 544.312 553.5 544.31L553.5 456.073Z' },
  { name: 'Nape right',    label: 'Nape',     center: [594, 502], path: 'M553.5 544.31C597.501 544.086 604.663 541.16 644.215 535.208C648.566 506.425 661.2 482.297 661.2 482.297C661.2 482.297 586.226 456.543 555.292 456.093C554.692 456.084 554.095 456.077 553.5 456.073L553.5 544.31Z' },
  { name: 'Neck left',     label: 'Neck',     center: [512, 626], path: 'M464.149 535.925C461.207 532.996 500.505 545.514 552.369 544.315C554.049 622.648 551.352 620.757 552.369 669.5C503 669.5 489 665 464.149 655C482.103 595.882 469.931 576.857 464.149 535.925Z' },
  { name: 'Neck right',    label: 'Neck',     center: [596, 623], path: 'M644.215 535.208C647.157 532.279 604.228 545.421 552.364 544.222C553.13 623.09 553.38 620.757 552.364 669.5C588.317 668.383 606.5 666.5 644.215 654.5C631.089 587.298 632.827 561.211 644.215 535.208Z' },
];

export const BACK: DiagramView = {
  id: 'back',
  label: 'Back',
  // **Both views share one viewBox size (332×513), aligned on the crown.**
  //
  // The rule and the reasoning behind it are unchanged from the first artwork
  // (two earlier attempts are recorded in git): the crown is the only landmark
  // that means the same thing in both views, so the skull is centred on x and
  // the crown pinned 10 units below the top edge, with the box tall enough for
  // the longer silhouette below it.
  //
  // Re-measured for this artwork, which is drawn far more consistently than
  // the last: both skulls are 291.30 wide to two decimal places, and the two
  // silhouettes run 496.2 and 496.5 below the crown. The width is set by the
  // ears rather than the skull — they reach 161.9 from the centre, so 332
  // leaves ~4 units of margin — and the height is 10 + 496.5 + 6.
  //
  // **Re-measured again on 2026-09-03**, when Sunny shortened the neck: the
  // box lost 31 units of height (544 → 513) and nothing else moved, since the
  // skulls and the ears are untouched. The aspect is now 0.647, within a
  // thousandth of the original artwork's 340×524 — so the diagram occupies
  // about the height it did before the redraw.
  //
  // Re-measure the skull box and the silhouette bottom for both views if the
  // art is re-exported.
  viewBox: '389.33 163 332 513',
  // The neck is two selectable zones here, so it is part of the base (and of
  // the clip) rather than a disabled region as on the front.
  base: [BACK_HEAD, BACK_ZONES[7].path, BACK_ZONES[8].path],
  outline: [BACK_HEAD, ...BACK_NECK_EDGES],
  dividers: BACK_ZONES.map((z) => z.path),
  // The jawline either side of the neck needs no path of its own: it is inside
  // `base` and covered by no zone, so the disabled treatment reaches it by
  // construction. Only the ears, which sit outside `base`, have to be named.
  inert: BACK_EARS,
  details: [],
  // Back is NOT mirrored: screen-left = subject's left.
  zones: BACK_ZONES,
  sideLabels: { left: 'Left', right: 'Right' },
  showLabels: false,
};

export const VIEWS: DiagramView[] = [FRONT, BACK];

export const ALL_ZONES: string[] = VIEWS.flatMap((v) => v.zones.map((z) => z.name));

export function sevText(s: number): string {
  if (s <= 3) return 'text-severity-low';
  if (s <= 7) return 'text-severity-mid';
  return 'text-severity-high';
}
