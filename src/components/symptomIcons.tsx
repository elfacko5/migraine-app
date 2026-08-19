// Symptom icons, drawn rather than exported.
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
// **Matched by pattern, not by exact name.** The symptom list is add-only and
// open text — someone can type "light sensitivity in left eye" — so the same
// approach `medIcon` takes applies here: match on what the name contains, and
// fall back to a neutral mark rather than guessing. Extend `SYMPTOM_ICON_RULES`
// as new ones come up.
//
// Each is drawn to read at 14–16px, which rules out faces and anything with
// interior detail: at that size a nauseated face is a grey smudge. They are
// schematic — a spiral for dizziness, a fortification zigzag for aura — and
// they're labelling text that is right there, so they only have to be
// *distinguishable*, not self-explanatory.

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
  // The head outline, and the vertical midline the fill is clipped against.
  const head = 'M12 3c3.6 0 5.8 2.6 5.8 6.2 0 2.3-.5 3.6-1.2 4.7-.5.8-.6 1.2-.6 2.1V18c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-2c0-.9-.1-1.3-.6-2.1-.7-1.1-1.2-2.4-1.2-4.7C6.2 5.6 8.4 3 12 3z';
  // Screen-left is the subject's RIGHT (mirrored), so the fills are crossed.
  const fillLeft = side === 'left' || side === 'both';
  const fillRight = side === 'right' || side === 'both';
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        {/* Half-width rects, used to clip the same head path to each side. */}
        <clipPath id="side-glyph-screen-left"><rect x="0" y="0" width="12" height="24" /></clipPath>
        <clipPath id="side-glyph-screen-right"><rect x="12" y="0" width="12" height="24" /></clipPath>
      </defs>
      {/* Subject's right = screen-left. */}
      {fillRight && (
        <path d={head} fill="currentColor" fillOpacity="0.9" clipPath="url(#side-glyph-screen-left)" />
      )}
      {/* Subject's left = screen-right. */}
      {fillLeft && (
        <path d={head} fill="currentColor" fillOpacity="0.9" clipPath="url(#side-glyph-screen-right)" />
      )}
      <path d={head} fill="none" stroke="currentColor" strokeWidth={1.3} strokeOpacity="0.65" />
      <path d="M12 3.4v16.2" stroke="currentColor" strokeWidth={0.9} strokeOpacity="0.4" />
    </svg>
  );
}
