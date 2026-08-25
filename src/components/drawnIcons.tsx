// Drawn icons — symptoms, triggers, relief methods, medication forms and the
// Profile menu, plus the laterality glyph.
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
// **Matched by pattern, not by exact name.** The symptom, trigger and relief
// lists are add-only open text — someone can type "light sensitivity in left eye" — so
// each family matches on what a name *contains* and falls back to a neutral
// mark rather than guessing. Extend the rule tables as new ones come up; order
// matters, because the first match wins.
//
// Each is drawn to read at 14–16px, which rules out faces and anything with
// interior detail: at that size a nauseated face is a grey smudge. They are
// schematic — a spiral for dizziness, a fortification zigzag for aura — and
// they're labelling text that is right there, so they only have to be
// *distinguishable*, not self-explanatory.

import { medForm, type MedForm } from '../utils/medDisplay';

interface IconProps { className?: string }

// `strokeWidth` is a parameter rather than a constant for exactly one caller:
// the six medication forms use 1.75. Everything else stays 1.5 and should —
// this is not a knob to reach for. See the note above MedIcon.
const svg = (className: string, children: React.ReactNode, strokeWidth = 1.5) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
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

/**
 * Attack mode — a flare radiating from a centre, as arcs rather than rays.
 *
 * It replaces `FlareUpIcon` (2026-08-25), which was the same idea as *filled*
 * artwork: five concentric scalloped rings in a 39×40 box, carrying more
 * detail than a 20px pill can resolve, so on device it rendered as a small
 * flower or a gear. This is the same metaphor drawn to the contract everything
 * else here follows — five elements, one stroke weight, no interior detail.
 *
 * **Arcs, not rays, and that is the constraint to respect if it's redrawn.**
 * A dot with straight rays is a sun, and the sun is the *brightness* pill,
 * which sits at the same screen position in the opposite state. A crescent was
 * the other obvious option and is also taken: `MoonIcon` means sleep, as a
 * relief and as a trigger, and all three can be on screen together.
 */
export function AttackModeIcon({ className = 'h-5 w-5' }: IconProps) {
  return svg(className, <>
    <circle cx="12" cy="12" r="2.25" />
    <path d="M9 7a6.75 6.75 0 0 0 0 10" />
    <path d="M15 7a6.75 6.75 0 0 1 0 10" />
    <path d="M6 3a13.5 13.5 0 0 0 0 18" />
    <path d="M18 3a13.5 13.5 0 0 1 0 18" />
  </>);
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

// ── Triggers ─────────────────────────────────────────────────────────────
// Added 2026-08-25, reversing the earlier "triggers have no icon set" note in
// `ChipSelector` — that was a description of what existed, not a decision to
// keep, and a chip row with marks on symptoms and reliefs but not triggers is
// the inconsistency the drawn-icon set exists to prevent.
//
// Most of the list is already covered by marks drawn for the other two
// families, and reusing them is right rather than merely cheap: caffeine is
// the same cup whether it helped or set the attack off, and drawing a second
// near-identical one would be a distinction nobody could see at 16px. Only
// the six with nothing to borrow from are new.

/** Squeezed from both sides — pressure, not a lightning bolt. A bolt would be
 *  one zigzag too close to `AuraIcon`, and the two can sit on the same screen
 *  in `AttackDetail`. */
export function StressIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M12 4v16" />
    <path d="M6.5 8.5 3 12l3.5 3.5" />
    <path d="M17.5 8.5 21 12l-3.5 3.5" />
  </>);
}

/** A stemmed glass. */
export function AlcoholIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M7 4h10l-1 5a4 4 0 0 1-8 0L7 4z" />
    <path d="M12 13v5" />
    <path d="M9 20h6" />
  </>);
}

/** A cloud. Weather *change* has no mark of its own that reads at this size —
 *  the chip's own text carries the change. */
export function WeatherIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <path d="M7.5 19h9.5a3.5 3.5 0 0 0 .3-7A5 5 0 0 0 7.6 11 3.9 3.9 0 0 0 7.5 19z" />);
}

/** A smooth wave — a level that rises and falls. Deliberately smooth: the ECG
 *  spike is `ThrobbingIcon`, and at 14px a sharp wave would read as that. */
export function HormoneIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <path d="M3 15c3 0 3-6 6-6s3 6 6 6 3-6 6-6" />);
}

/** A cycle. A droplet was the obvious mark and is already the hydration
 *  relief, which `AttackDetail` can show on the same screen. */
export function CycleIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <path d="M20 12a8 8 0 1 1-3.4-6.5" />
    <path d="M20 4v4h-4" />
  </>);
}

/** A display on a stand. */
export function ScreenIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return svg(className, <>
    <rect x="3" y="4.5" width="18" height="12" rx="2" />
    <path d="M12 16.5V20" />
    <path d="M8.5 20h7" />
  </>);
}

// Order matters, first match wins. "Bright light" has to reach LightIcon
// before anything broader claims it, and "Skipped meal" is still a meal.
const TRIGGER_ICON_RULES: { pattern: RegExp; Icon: IconComponent }[] = [
  { pattern: /stress|anxiet|tension|worry/i, Icon: StressIcon },
  { pattern: /sleep|insomnia|tired|fatigue|oversle/i, Icon: MoonIcon },
  { pattern: /alcohol|wine|beer|spirit|hangover/i, Icon: AlcoholIcon },
  { pattern: /caffeine|coffee|tea\b|cola|energy drink/i, Icon: CoffeeIcon },
  { pattern: /light|glare|bright|sun\b|flicker/i, Icon: LightIcon },
  { pattern: /noise|loud|sound|music/i, Icon: SoundIcon },
  { pattern: /meal|food|eat|hunger|hungry|fasting|sugar/i, Icon: FoodIcon },
  { pattern: /weather|pressure|humid|storm|heat wave|cold front/i, Icon: WeatherIcon },
  { pattern: /menstr|period|cycle/i, Icon: CycleIcon },
  { pattern: /hormon|oestrogen|estrogen|ovulat/i, Icon: HormoneIcon },
  { pattern: /screen|phone|computer|laptop|monitor/i, Icon: ScreenIcon },
  { pattern: /dehydrat|water|thirst/i, Icon: DropletIcon },
  { pattern: /exercise|exertion|workout|gym|run|cycl/i, Icon: DumbbellIcon },
  { pattern: /smell|perfume|odour|odor|smoke/i, Icon: AirIcon },
  { pattern: /neck|posture|shoulder/i, Icon: NeckIcon },
];

/** The icon for a trigger name, matched on what it contains. */
export function TriggerIcon({ name, className }: { name: string; className?: string }) {
  const Icon = TRIGGER_ICON_RULES.find((r) => r.pattern.test(name))?.Icon ?? OtherSymptomIcon;
  return <Icon className={className} />;
}

// ── Medication forms ─────────────────────────────────────────────────────
// The matching rules stay in `medDisplay.ts` as a plain function returning a
// form key, so the "what form is this" logic is testable and importable from
// non-JSX code; this only maps the key to a mark.

export function TabletIcon({ className = 'h-4 w-4' }: IconProps) {
  return svg(className, <>
    <rect x="2" y="6.5" width="20" height="11" rx="5.5" />
    <path d="M12 6.5v11" />
  </>, MED_STROKE);
}

/** A tablet dissolving. */
export function SolubleIcon({ className = 'h-4 w-4' }: IconProps) {
  return svg(className, <>
    <path d="M3 12.5a9 9 0 0 0 18 0" />
    <circle cx="8" cy="6.5" r="2.1" />
    <circle cx="15.5" cy="4.5" r="1.5" />
    <circle cx="13" cy="9" r="1.1" />
  </>, MED_STROKE);
}

export function SprayIcon({ className = 'h-4 w-4' }: IconProps) {
  return svg(className, <>
    <path d="M6.5 8.5h8v11.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z" />
    <path d="M8.5 8.5V4.5h4" />
    <path d="M17 3.5h3.5M17 6.5h3.5M17 9.5h3.5" />
  </>, MED_STROKE);
}

export function InjectionIcon({ className = 'h-4 w-4' }: IconProps) {
  return svg(className, <>
    <path d="m14.5 3 6.5 6.5" />
    <path d="m18.5 7-11 11L2.5 19.5 4 14.5l11-11z" />
    <path d="m9.5 8.5 6 6" />
  </>, MED_STROKE);
}

export function SuppositoryIcon({ className = 'h-4 w-4' }: IconProps) {
  return svg(className, <path d="M12 2.5c3.7 5 5.5 8 5.5 12.3a5.5 5.5 0 0 1-11 0C6.5 10.5 8.3 7.5 12 2.5z" />, MED_STROKE);
}

export function PatchIcon({ className = 'h-4 w-4' }: IconProps) {
  return svg(className, <>
    <rect x="1.5" y="7" width="21" height="10" rx="3.5" transform="rotate(-25 12 12)" />
    <path d="M10 10v4M14 10v4" />
  </>, MED_STROKE);
}

/** The medication family alone runs heavier than the shared 1.5. */
const MED_STROKE = 1.75;

// The six medication marks are drawn deliberately *fuller* than the symptom
// and relief ones, and default to `h-4` rather than `h-3.5`. The complaint
// they fix (2026-08-19) was that they read "flat and small" — the tablet was
// the clearest case: a 19x7 capsule inside a 24x24 box put its whole mass in
// 29% of the height, so at 14px it rendered about 4px tall next to text more
// than three times that. Being generic is fine; being a sliver is not. Each
// now uses roughly the full box height, and the family keeps the shared
// stroke weight bumped one notch to 1.75: at 16px a 1.5 stroke in a 24-unit
// box renders as a single pixel, which is the other half of "flat". Everything
// else here stays at 1.5.
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

export function ChecklistIcon({ className = 'h-5 w-5' }: IconProps) {
  return svg(className, <>
    <path d="M8 4.5h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V6A1.5 1.5 0 0 1 8 4.5z" />
    <path d="M9.5 9.5h5M9.5 13h5M9.5 16.5h3" />
  </>);
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
 * A face seen from the front, with the affected side filled.
 *
 * Inlined from `Face.svg` at the repo root — Sunny's artwork, which arrives
 * already split into one path per half, so the fill is a per-path opacity and
 * there is no clipping to do.
 *
 * **Mirrored, like the picker.** `AreaSeverityPicker`'s front view shows the
 * subject facing you, so the subject's *left* is on the screen's *right*, and
 * the head diagram already commits to that. A glyph that flipped it would put
 * the shading on the opposite side from where the same person just tapped to
 * record it. The visible label on the row and the `sr-only` text both still
 * say which side it is.
 *
 * The unaffected half stays faintly filled rather than disappearing: at this
 * size a lone half-face reads as a smudge, where a whole face with one side
 * darker reads as a face.
 */

/** Screen-right half — the subject's LEFT. */
const FACE_SCREEN_RIGHT =
  'M159.881 429.876C210.074 433.554 260.325 354.348 277.172 330.135C294.018 305.921 284.179 283.969 301.951 269.821C319.724 255.673 323.468 198.862 316.766 188.201C313.655 183.252 305.646 186.775 304.773 171.87C301.613 117.931 315.734 0.352052 159.881 0V429.876Z';

/** Screen-left half — the subject's RIGHT. */
const FACE_SCREEN_LEFT =
  'M159.881 429.876C109.726 433.554 59.5119 354.348 42.6781 330.135C25.8442 305.921 35.6756 283.969 17.9167 269.821C0.156952 255.673 -3.58347 198.862 3.11322 188.201C6.22189 183.252 14.2246 186.775 15.0975 171.87C18.2553 117.931 4.1443 0.352052 159.881 0V429.876Z';

export function SideGlyph({ side, className = 'h-9 w-auto' }: {
  side: 'left' | 'right' | 'both';
  className?: string;
}) {
  const subjectLeft = side === 'left' || side === 'both';
  const subjectRight = side === 'right' || side === 'both';
  return (
    <svg viewBox="0 0 320 430" className={className} aria-hidden="true">
      {/* Screen-left is the subject's right, and vice versa — see above. */}
      <path d={FACE_SCREEN_LEFT} fill="currentColor" fillOpacity={subjectRight ? 0.85 : 0.16} />
      <path d={FACE_SCREEN_RIGHT} fill="currentColor" fillOpacity={subjectLeft ? 0.85 : 0.16} />
    </svg>
  );
}
