// Drawn icons — symptoms, relief methods, medication forms and the Profile
// menu, plus the laterality glyph.
//
// Unlike `icons.tsx` — whose components are hand-inlined from SVG files in
// `/icons` — these were authored here, so there is no source file to keep in
// step. Everything else follows the same rules: one 24×24 viewBox, no fill,
// `stroke="currentColor"` at 1.5, round caps and joins, size from
// `className`. Inheriting colour is the whole point: a full-colour emoji on
// every chip would make the least important glyph on the row the brightest
// thing on a screen the palette works to keep quiet, which is the rule the
// attack-mode pill's emoji broke and why it became a drawn mark.
//
// **Matched by pattern, not by exact name.** The symptom and relief lists are
// add-only open text — someone can type "light sensitivity in left eye" — so
// each family matches on what a name *contains* and falls back to a neutral
// mark rather than guessing. Extend the rule tables as new ones come up; order
// matters, because the first match wins.
//
// Each is drawn to read at 14–16px, which rules out faces and anything with
// interior detail: at that size a nauseated face is a grey smudge. They are
// schematic — a spiral for dizziness, a fortification zigzag for aura — and
// they're labelling text that is right there, so they only have to be
// *distinguishable*, not self-explanatory.

import { useId } from 'react';
import { medForm, type MedForm } from '../utils/medDisplay';

interface IconProps { className?: string }

const svg = (className: string, children: React.ReactNode) => (
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
    {children}
  </svg>
);

/** A stomach, with the churn inside it. */
export function NauseaIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M8 4v5a5.5 5.5 0 0 0 5.5 5.5h.5a4 4 0 0 0 4-4V9" />
    <path d="M6 12.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0" />
    <path d="M6 16.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0" />
  </>);
}

/** Downward expulsion — the arrow is what separates it from nausea. */
export function VomitingIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M5 6h9a4 4 0 0 1 0 8H9" />
    <path d="M9 14v5" />
    <path d="M6.5 16.5 9 19l2.5-2.5" />
  </>);
}

/** The fortification zigzag — the shape people actually describe seeing. */
export function AuraIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M3 12h2.5l2-4 2.5 8 2.5-8 2 4H17" />
    <path d="M19.5 8a6.5 6.5 0 0 1 0 8" />
  </>);
}

/** Light, with the rays that are the problem. */
export function LightIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </>);
}

/** Sound arriving — arcs into an ear, not a speaker, so it reads as hearing. */
export function SoundIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M7 9a4 4 0 0 1 8 0c0 2.5-2.5 3-3 5a2 2 0 0 1-3.8.5" />
    <path d="M17.5 5.5a8 8 0 0 1 0 11" />
    <path d="M20.5 3a12 12 0 0 1 0 16" />
  </>);
}

/** A pulse — throbbing is a rhythm, so it gets a waveform. */
export function ThrobbingIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <path d="M2 12h3.5l2-5 3 10 2.5-7 1.5 2H22" />);
}

/** A spiral, which is what dizziness looks like in every icon set there is. */
export function DizzinessIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, (
    <path d="M12 12a2 2 0 1 1 2 2 3.5 3.5 0 0 1-3.5-3.5 5 5 0 0 1 5-5 6.5 6.5 0 0 1 6.5 6.5" />
  ));
}

/** Stacked vertebrae with a strain arc — a neck, seen from behind. */
export function NeckIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M9.5 4h5M9.5 8h5M9.5 12h5M9.5 16h5" />
    <path d="M6 6c-1.5 2-1.5 8 0 12" />
    <path d="M18 6c1.5 2 1.5 8 0 12" />
  </>);
}

/** Anything the rules don't recognise — a custom symptom someone typed. */
export function OtherSymptomIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <circle cx="12" cy="12" r="6" />);
}

type IconComponent = (p: IconProps) => React.ReactElement;

// Order matters: the first match wins, so anything more specific goes first.
// "Light sensitivity" and "Sound sensitivity" both contain "sensitivity",
// which is why neither rule uses that word.
const SYMPTOM_ICON_RULES: { pattern: RegExp; Icon: IconComponent }[] = [
  { pattern: /vomit|sick\b|throwing up/i, Icon: VomitingIcon },
  { pattern: /nausea|queasy|stomach/i, Icon: NauseaIcon },
  { pattern: /aura|zigzag|visual|blind spot|scintill/i, Icon: AuraIcon },
  { pattern: /light|photophobia|glare|bright/i, Icon: LightIcon },
  { pattern: /sound|noise|phonophobia|audio/i, Icon: SoundIcon },
  { pattern: /throb|puls|pound/i, Icon: ThrobbingIcon },
  { pattern: /dizz|vertigo|spin|balance|faint/i, Icon: DizzinessIcon },
  { pattern: /neck|shoulder|stiff/i, Icon: NeckIcon },
];

/** The icon for a symptom name, matched on what it contains. */
export function SymptomIcon({ name, className }: { name: string; className?: string }) {
  const Icon = SYMPTOM_ICON_RULES.find((r) => r.pattern.test(name))?.Icon ?? OtherSymptomIcon;
  return <Icon className={className} />;
}


// ── Relief methods ───────────────────────────────────────────────────────
// Same rules as the symptoms. A few share a mark on purpose: "Cold compress"
// and "Cold shower" are both cold, and the chip's own text is right beside it,
// so the icon only has to group and distinguish at a glance — inventing two
// near-identical snowflakes would be a distinction nobody could see at 16px.

/** Light, struck through — a dark room is the absence of it. */
export function DarkRoomIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3.5v1.5M12 19v1.5M3.5 12H5M19 12h1.5M6 6l1 1M17 17l1 1M18 6l-1 1M7 17l-1 1" />
    <path d="M4 20 20 4" />
  </>);
}

/** Sound, struck through. */
export function QuietRoomIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M4 9.5h3L11 6v12l-4-3.5H4z" />
    <path d="M15.5 9.5a4 4 0 0 1 0 5" />
    <path d="M4 20 20 4" />
  </>);
}

export function ColdIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5" />
    <path d="M9.5 4.8 12 7l2.5-2.2M9.5 19.2 12 17l2.5 2.2" />
  </>);
}

/** Rising heat. */
export function HeatIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M7 19c-1.5-1.6-1.5-3.4 0-5s1.5-3.4 0-5" />
    <path d="M12 19c-1.5-1.6-1.5-3.4 0-5s1.5-3.4 0-5" />
    <path d="M17 19c-1.5-1.6-1.5-3.4 0-5s1.5-3.4 0-5" />
  </>);
}

export function LeafIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M19 4c0 8-4.5 12-10 12a5 5 0 0 1 0-10c4 0 6-1 10-2z" />
    <path d="M5 20c2-5 5-8 9-10" />
  </>);
}

export function MoonIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />);
}

export function ShowerIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M5 11h14a7 7 0 0 0-14 0z" />
    <path d="M12 11V5a2 2 0 0 1 2-2h3" />
    <path d="M8 15v1.5M12 15v2.5M16 15v1.5M10 18.5v1M14 18.5v1" />
  </>);
}

export function AirIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5" />
    <path d="M3 12h13a2.5 2.5 0 1 1-2.5 2.5" />
    <path d="M3 16h7" />
  </>);
}

export function DropletIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <path d="M12 3.5c3 4 5.5 6.6 5.5 9.5a5.5 5.5 0 1 1-11 0c0-2.9 2.5-5.5 5.5-9.5z" />);
}

export function CoffeeIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
    <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" />
    <path d="M7 3.5v2M11 3.5v2" />
  </>);
}

export function EyeMaskIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M5 9.5h14a1 1 0 0 1 1 1.2l-.6 2.8a2 2 0 0 1-2 1.5h-2.6a2 2 0 0 1-1.7-1l-.6-1a.6.6 0 0 0-1 0l-.6 1a2 2 0 0 1-1.7 1H6.6a2 2 0 0 1-2-1.5L4 10.7a1 1 0 0 1 1-1.2z" />
    <path d="M2.5 10.5 5 9.5M21.5 10.5 19 9.5" />
  </>);
}

/** Pulled apart in both directions. */
export function StretchIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M4 6v12M20 6v12" />
    <path d="M8 12h8" />
    <path d="M8 12l2.5-2.5M8 12l2.5 2.5M16 12l-2.5-2.5M16 12l-2.5 2.5" />
  </>);
}

export function FoodIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M6 3v7a2 2 0 0 0 4 0V3" />
    <path d="M8 12v9" />
    <path d="M17 3c-1.5 1.5-2 3-2 5.5S16 12 17 12s2-1 2-3.5S18.5 4.5 17 3z" />
    <path d="M17 12v9" />
  </>);
}

export function DumbbellIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M4 9v6M7 7.5v9M17 7.5v9M20 9v6" />
    <path d="M7 12h10" />
  </>);
}

const RELIEF_ICON_RULES: { pattern: RegExp; Icon: IconComponent }[] = [
  { pattern: /dark|light off|blackout|curtain/i, Icon: DarkRoomIcon },
  { pattern: /quiet|silen|noise|earplug/i, Icon: QuietRoomIcon },
  { pattern: /shower|bath/i, Icon: ShowerIcon },
  { pattern: /cold|ice|cool/i, Icon: ColdIcon },
  { pattern: /hot|heat|warm/i, Icon: HeatIcon },
  { pattern: /peppermint|menthol|oil|balm/i, Icon: LeafIcon },
  { pattern: /sleep|rest|nap|lie down|lying/i, Icon: MoonIcon },
  { pattern: /air|window|outside|walk outside/i, Icon: AirIcon },
  { pattern: /hydrat|water|drink/i, Icon: DropletIcon },
  { pattern: /caffeine|coffee|tea|cola/i, Icon: CoffeeIcon },
  { pattern: /mask|eye cover|blindfold/i, Icon: EyeMaskIcon },
  { pattern: /stretch|yoga|massage/i, Icon: StretchIcon },
  { pattern: /food|eat|meal|snack|sugar/i, Icon: FoodIcon },
  { pattern: /exercise|workout|gym|run|cycl/i, Icon: DumbbellIcon },
];

export function ReliefIcon({ name, className }: { name: string; className?: string }) {
  const Icon = RELIEF_ICON_RULES.find((r) => r.pattern.test(name))?.Icon ?? OtherSymptomIcon;
  return <Icon className={className} />;
}

// ── Medication forms ─────────────────────────────────────────────────────
// The matching rules stay in `medDisplay.ts` as a plain function returning a
// form key, so the "what form is this" logic is testable and importable from
// non-JSX code; this only maps the key to a mark.

export function TabletIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" />
    <path d="M12 8.5v7" />
  </>);
}

/** A tablet dissolving. */
export function SolubleIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M4 13a8 8 0 0 0 16 0" />
    <circle cx="9" cy="7.5" r="1.6" />
    <circle cx="14.5" cy="5.5" r="1.1" />
    <circle cx="12.5" cy="9.5" r="0.8" />
  </>);
}

export function SprayIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M8 9h6v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
    <path d="M9.5 9V6h3" />
    <path d="M17 4.5h2M17 7h2M17 9.5h2" />
  </>);
}

export function InjectionIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="m14 4 6 6" />
    <path d="m17.5 7.5-9 9-4.5 1.5L5.5 13.5l9-9z" />
    <path d="m10 9 5 5" />
  </>);
}

export function SuppositoryIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <path d="M12 3c3 4 4.5 6.5 4.5 10a4.5 4.5 0 0 1-9 0C7.5 9.5 9 7 12 3z" />);
}

export function PatchIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <rect x="3" y="8.5" width="18" height="7" rx="3" transform="rotate(-20 12 12)" />
    <path d="M10.5 10.5v3M13.5 10.5v3" />
  </>);
}

/** The mark for a medication, from its own name and dose text. */
export function MedIcon({ name, dose = '', className }: { name: string; dose?: string; className?: string }) {
  const Icon = MED_FORM_ICONS[medForm(name, dose)];
  return <Icon className={className} />;
}

const MED_FORM_ICONS: Record<MedForm, IconComponent> = {
  tablet: TabletIcon,
  soluble: SolubleIcon,
  spray: SprayIcon,
  injection: InjectionIcon,
  suppository: SuppositoryIcon,
  patch: PatchIcon,
};

// ── Profile menu ─────────────────────────────────────────────────────────

export function EyeIcon({ className = 'h-5 w-5' }: IconProps) {
  return svg(className, <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </>);
}

export function CloudIcon({ className = 'h-5 w-5' }: IconProps) {
  return svg(className, (
    <path d="M7 18.5a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6-1.4A3.75 3.75 0 0 1 17.5 18.5z" />
  ));
}

export function DataIcon({ className = 'h-5 w-5' }: IconProps) {
  return svg(className, <>
    <path d="M3.5 6.5c0-1.4 3.8-2.5 8.5-2.5s8.5 1.1 8.5 2.5-3.8 2.5-8.5 2.5-8.5-1.1-8.5-2.5z" />
    <path d="M3.5 6.5v11c0 1.4 3.8 2.5 8.5 2.5s8.5-1.1 8.5-2.5v-11" />
    <path d="M3.5 12c0 1.4 3.8 2.5 8.5 2.5s8.5-1.1 8.5-2.5" />
  </>);
}

// ── Laterality ───────────────────────────────────────────────────────────

/**
 * A head seen from the front, with the affected side filled.
 *
 * **Mirrored, like the picker.** `AreaSeverityPicker`'s front view shows the
 * subject facing you, so the subject's *left* is on the screen's *right* —
 * that's how a clinician looks at a patient, and the head diagram already
 * commits to it. A glyph that flipped it would put the shading on the
 * opposite side from where the same person just tapped to record it, which is
 * a worse confusion than the one it would solve. The visible label and the
 * `sr-only` text both still say which side it is.
 *
 * **Interim artwork.** Sunny is drawing a proper illustration; this is a
 * schematic head so the layout can be built and judged now. Swapping it means
 * replacing the two paths below and nothing else — the sizing, the mirroring
 * and the accessible label all live here.
 */
export function SideGlyph({ side, className = 'h-8 w-8' }: {
  side: 'left' | 'right' | 'both';
  className?: string;
}) {
  // **Ids must be per-instance.** These were two fixed strings, so a Logs list
  // of ten rows emitted ten copies of each — duplicate ids are invalid, and
  // `url(#id)` resolves to whichever the parser saw first, which is only
  // harmless here because every instance happens to define the same geometry.
  // `useId` makes that a fact rather than a coincidence.
  const uid = useId();
  const clipLeft = `${uid}-screen-left`;
  const clipRight = `${uid}-screen-right`;
  // The head outline, and the vertical midline the fill is clipped against.
  const head = 'M12 3c3.6 0 5.8 2.6 5.8 6.2 0 2.3-.5 3.6-1.2 4.7-.5.8-.6 1.2-.6 2.1V18c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-2c0-.9-.1-1.3-.6-2.1-.7-1.1-1.2-2.4-1.2-4.7C6.2 5.6 8.4 3 12 3z';
  // Screen-left is the subject's RIGHT (mirrored), so the fills are crossed.
  const fillLeft = side === 'left' || side === 'both';
  const fillRight = side === 'right' || side === 'both';
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        {/* Half-width rects, used to clip the same head path to each side. */}
        <clipPath id={clipLeft}><rect x="0" y="0" width="12" height="24" /></clipPath>
        <clipPath id={clipRight}><rect x="12" y="0" width="12" height="24" /></clipPath>
      </defs>
      {/* Subject's right = screen-left. */}
      {fillRight && (
        <path d={head} fill="currentColor" fillOpacity="0.9" clipPath={`url(#${clipLeft})`} />
      )}
      {/* Subject's left = screen-right. */}
      {fillLeft && (
        <path d={head} fill="currentColor" fillOpacity="0.9" clipPath={`url(#${clipRight})`} />
      )}
      <path d={head} fill="none" stroke="currentColor" strokeWidth={1.3} strokeOpacity="0.65" />
      <path d="M12 3.4v16.2" stroke="currentColor" strokeWidth={0.9} strokeOpacity="0.4" />
    </svg>
  );
}
