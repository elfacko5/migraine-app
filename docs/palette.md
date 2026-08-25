# The three palettes

The app ships **dark** (default) and **attack** (`data-theme="attack"`). A **light** palette is
specified here and is **not wired up** — see "What shipping light mode would take" at the bottom.

Every value below is measured, not transcribed. The dossier's §10 tokens are *starting values it
tells you to tune on real screens*, and the dark palette already diverges from them in three places
for exactly that reason. The light palette diverges in the same way and for the same reason: its
literal `--text: #2A2724` measures 13.0:1 against its own `--bg`, which is the max-contrast pairing
§8.1 says to avoid in the same breath as it asks for AA.

## The Figma library

These tokens are mirrored in Figma: **Lidd Design System** —
<https://www.figma.com/design/eIOtxkHeEPguTLY2gWdhxF> (built 2026-08-25).

- **The `Color` collection carries all three modes** — Dark, Light, Attack — as Figma variable
  modes, so selecting a frame and switching the mode re-resolves everything bound to a semantic
  token. The Colour page shows the three side by side, driven by one set of variables with
  `setExplicitVariableModeForCollection` per column.
- **Semantic tokens alias a hidden `Primitives` ramp** (48 values across `sand` / `sage` / `amber` /
  `clay`, named by hue family and lightness). The primitives have **empty scopes** so they never
  appear in a property picker; binding one directly would produce a value that cannot respond to a
  mode. **Primitives deliberately carry no code syntax**, because no CSS variable corresponds to
  `sand/450` — inventing one would misrepresent the codebase.
- Every semantic variable carries its real CSS name as WEB code syntax (`var(--color-bg-base)`), so
  Dev Mode reports the token this repo actually uses.
- **Scopes come from the call sites, not from the token's name** — corrected 2026-08-25 after
  `accent` showed a single swatch in the Fill picker. Figma filters that picker to
  `FRAME_FILL`/`SHAPE_FILL`, and three tokens had been scoped by what their names implied rather
  than by how the app uses them: `accent/light` is `.btn-primary`'s hover background and the sync
  dot, `border/control` fills both toggle tracks, and `text/secondary` fills the sync dot, the
  "not recorded" rule and the 15-day line. All three now carry fill scopes. The three that stay
  stroke/text-only — `border/subtle`, `text/primary`, `button/secondary-border` — have zero fill
  call sites, and `text/primary` only became one of them when the switch thumb moved to
  `bg-bg-surface`. Re-grep before narrowing a scope.
- **There are no effect styles, deliberately** — the app uses no drop shadows; depth is the four
  surface tones.
- **The hand-mirrored constants are tokens too** — added 2026-08-25 after the first pass shipped
  without them. `diagram/head-fill`, `diagram/disabled` and `severity/{low,mid,high}-edge` live in
  `headDiagram.ts` as TypeScript constants because an SVG presentation attribute cannot read
  `var()`. They are exactly the values that go stale, so leaving them out of the library left the
  most drift-prone half of the palette undocumented. **They deliberately carry no WEB code syntax**
  — there is no CSS variable to name, and inventing one would be a lie; the description names the
  constant instead.
- **`accent/tint` and `accent/ring` are the one place a semantic holds a raw value.** They are the
  chip contract from `chipStyles.ts` (`bg-accent/20` + `ring-accent/50`), and Figma cannot express
  alpha through an alias — so they must be kept in step with `accent/default` by hand.
- **This file is a mirror, not the source.** `src/index.css` stays authoritative for Dark and
  Attack, and this document for Light. Nothing syncs automatically: a value changed here has to be
  changed in Figma by hand, and vice versa.

## The rules all three obey

Straight from §8.1, and they are what makes these three palettes one system rather than three
themes:

1. **No pure white, no pure black, no max-contrast pairing.** Both ends pulled inward. Body text
   lands past AAA (7:1) on the page and stays above AA (4.5:1) on the tightest surface.
2. **No saturated blue.** Nothing in any of the three has a blue cast.
3. **Warm-neutral and low-saturation throughout** — candlelight, not daylight.
4. **The accent is a low-saturation sage**, because ~530 nm is the one band the photophobia
   research exempts. It never becomes a bright green.
5. **Contrast is checked against the tightest surface, not the page.** In dark that means
   `bg-raised`/`bg-elevated`, which are lighter than the page; in light it means the same two
   tokens, which are *darker* than the page. Checking against `bg-base` flatters every value.
6. **Never convey meaning by colour alone** (§8.2) — some users read through FL-41 tinted lenses,
   which shifts every hue here. Severity is always printed as a number beside its colour.

## Surface direction, and why light inverts it

Dark raises by getting **lighter**; light raises by getting **darker**. That follows from rule 1
rather than from convention: the light page is already a warm off-white one step below white, so
"raise toward white" runs out of room immediately and ends at the pure white the spec forbids.
Going the other way keeps four distinguishable steps inside the safe range.

The consequence is that **`--color-accent-light` is darker than `--color-accent` in light mode.**
The token's job is "accent as text, and the primary button's hover" — both of which need *more*
contrast against their background, which in light mode means darker. The name is inherited from the
dark palette where those two things coincided; it is a wart, not a mistake to fix by swapping the
values.

---

## Tokens

| Token | Light *(new)* | Dark *(shipping)* | Attack *(shipping)* |
|---|---|---|---|
| `--color-bg-base` | `#f5f2ec` | `#1b1a18` | `#14140f` |
| `--color-bg-surface` | `#ece7dd` | `#262421` | `#1e1e17` |
| `--color-bg-raised` | `#e2dcd0` | `#302d29` | `#262218` |
| `--color-bg-elevated` | `#d8d1c3` | `#383430` | `#2f2a1f` |
| `--color-bg-border` | `#d5cec0` | `#3a3733` | `#34322a` |
| `--color-border-subtle` | `#bfb7a6` | `#47433d` | `#403d33` |
| `--color-border-control` | `#827966` | `#7d7669` | `#736d5a` |
| `--color-text-primary` | `#3a3733` | `#cdc7bb` | `#c9c4b8` |
| `--color-text-secondary` | `#5a554c` | `#a39d92` | `#9a9689` |
| `--color-accent` | `#4f6b57` | `#7fa187` | `#7fa187` |
| `--color-accent-light` | `#3c5544` | `#9bb9a1` | `#93ae99` |
| `--color-button-secondary-bg` | `#ece7dd` | `#262421` | `#1e1e17` |
| `--color-button-secondary-border` | `#827966` | `#7d7669` | `#736d5a` |
| `--color-severity-low` | `#3f6249` | `#8fb096` | `#8fb096` |
| `--color-severity-mid` | `#7b5020` | `#c39257` | `#c39257` |
| `--color-severity-high` | `#82423b` | `#c68880` | `#c68880` |
| `--color-warning` | `#7b5020` | `#b07a3c` | `#b07a3c` |
| `--color-positive` | `#4f6b57` | `#7fa187` | `#7fa187` |

Attack mode deliberately reuses dark's accent and severity ramp: the mode's reduction is carried by
the surfaces, the dim floor, the 20px type floor and the cut animation, not by re-hueing the one
set of colours that encode meaning.

## Measured contrast

Contrast ratio of each foreground against each surface. **Bold** is below AA 4.5:1.

**Light**

| | base | surface | raised | elevated |
|---|---|---|---|---|
| text-primary | 10.59 | 9.60 | 8.67 | 7.79 |
| text-secondary | 6.62 | 6.00 | 5.42 | 4.87 |
| accent | 5.26 | 4.77 | 4.30 | **3.87** |
| accent-light | 7.30 | 6.62 | 5.97 | 5.37 |
| severity-low | 6.15 | 5.58 | 5.04 | 4.53 |
| severity-mid / warning | 6.24 | 5.66 | 5.11 | 4.59 |
| severity-high | 6.73 | 6.10 | 5.51 | 4.95 |

**Dark**

| | base | surface | raised | elevated |
|---|---|---|---|---|
| text-primary | 10.34 | 9.20 | 8.14 | 7.33 |
| text-secondary | 6.46 | 5.75 | 5.08 | 4.58 |
| accent | 6.09 | 5.42 | 4.79 | **4.32** |
| accent-light | 8.16 | 7.26 | 6.42 | 5.79 |
| severity-low | 7.30 | 6.50 | 5.75 | 5.18 |
| severity-mid | 6.27 | 5.58 | 4.94 | **4.45** |
| severity-high | 5.99 | 5.33 | 4.72 | **4.25** |
| warning | 4.72 | 4.20 | 3.71 | **3.35** |

**Attack**

| | base | surface | raised | elevated |
|---|---|---|---|---|
| text-primary | 10.62 | 9.63 | 9.11 | 8.20 |
| text-secondary | 6.24 | 5.66 | 5.36 | 4.82 |
| accent | 6.47 | 5.86 | 5.55 | 4.99 |
| accent-light | 7.70 | 6.99 | 6.61 | 5.95 |
| severity-low | 7.76 | 7.04 | 6.66 | 5.99 |
| severity-mid | 6.66 | 6.04 | 5.72 | 5.14 |
| severity-high | 6.36 | 5.77 | 5.46 | 4.92 |
| warning | 5.01 | 4.54 | 4.30 | **3.87** |

`accent` failing on `bg-elevated` in every mode is expected and not a defect: it is a **fill**
token (`btn-primary`, the FAB), never a text colour. `accent-light` is the text form and clears AA
everywhere. The dark and attack cells in bold are pre-existing and are recorded here rather than
changed — see "Audit findings" below.

## Derived combinations

Checked because these are composites, not tokens, so a token table can't show them.

| Combination | Light | Dark | Attack |
|---|---|---|---|
| `btn-primary` label — `bg-base` on `accent` | 5.26 | 6.09 | 6.47 |
| `btn-primary` hover — `bg-base` on `accent-light` | 7.30 | 8.16 | 7.70 |
| chip-on label over `bg-raised` — `accent-light` on `accent/20` | 4.68 | 4.67 | — |
| chip-on label over `bg-elevated` | **4.29** | **4.25** | — |

The light chip tracks the dark one to within 0.04 across all four surfaces, which is the point: a
selected chip should feel the same weight in either mode. Both dip just under AA over `bg-elevated`
— an existing dark-mode condition the light palette reproduces rather than introduces, and only
reachable where a chip sits on the third surface level.

`.btn-primary` sets `color: var(--color-bg-base)`, so the light button is off-white text on sage at
5.26:1. **No `--color-on-accent` token is needed** — that was the obvious-looking fix and it isn't
required.

## The hand-mirrored constants

An SVG presentation attribute and a Recharts prop can't read `var()`, so `headDiagram.ts`,
`SeverityChart.tsx`, `HeadHeatmap.tsx`, `StatsView.tsx`, `medDisplay.ts` and `AreaSeverityPicker.tsx`
carry literal hex. A light mode needs a second set of every one of them.

| Constant | Light | Dark (shipping) |
|---|---|---|
| `HEAD_FILL` | `#e7e1d5` | `#2b2823` |
| `DISABLED_FILL` | `#efeae0` | `#26241f` |
| `SEVERITY_LOW/MID/HIGH` | `#3f6249` / `#7b5020` / `#82423b` | `#8fb096` / `#c39257` / `#c68880` |
| `SEVERITY_*_EDGE` (`sevStroke`) | `#1b3325` / `#3d2609` / `#441d19` | `#5c7a63` / `#7d5c35` / `#7d554f` |
| zone badge fill / text | `#f5f2ec` / `#3a3733` | `#1b1a18` / `#e4dfd6` |
| Recharts tick + label | `#5a554c` | `#a39d92` |
| Recharts tooltip bg / border | `#e2dcd0` / `#d5cec0` | `#302d29` / `#3a3733` |

`DISABLED_FILL` inverts its relationship along with the surfaces. The dark rule is "darker than the
head, so the two regions you cannot tap aren't the first thing the eye lands on"; in light the same
rule means **lighter** than the head. The edge strokes were tuned to ~2.0:1 against their own fill,
matching dark's 2.00 / 2.19 / 2.20, so the focus ring reads at the same strength in both.

## Accessibility audit

Measured on the pairs that **actually render**, not on the token table — a token pair nothing puts
together proves nothing. `text-accent` turns out to be unused anywhere in `src/`, which confirms
`--color-accent` is fill-only and its sub-AA reading against `bg-elevated` is not a text failure.

### 1.4.3 Contrast (minimum) — text, 4.5:1

| Rendered pair | Dark | Attack | Light |
|---|---|---|---|
| `FreqBars` count · `MigraineDaysChart` month label — 14px secondary on `bg-elevated` | 4.58 | 4.82 | 4.87 |
| Chart content — 14px primary on `bg-elevated` | 7.33 | 8.20 | 7.79 |
| `StatCard` label — 12px secondary on `bg-raised/60` | 5.66 | 4.93 | 5.89 |
| `StatCard` value — 28px primary | 9.06 | 9.78 | 9.43 |
| Disabled button / chip-off label — secondary on `bg-raised` | 5.08 | 5.36 | 5.42 |
| Chip-on label — `accent-light` on `accent/20` over `bg-raised` | 4.67 | 4.78 | 4.68 |

**Passes.** It did not when this was first measured: attack mode's `--color-text-secondary` was
`#8e8a7e` and read **4.14:1** on `bg-elevated`, which is where `InsightSection` puts a chart's own
labels once the section has a note — so the frequency-bar counts and the migraine-days month labels
rendered below AA whenever attack mode was on, Insights being untouched by that mode. **Fixed
2026-08-25** by lifting the token to `#9a9689` (4.82 on elevated, 6.24 on the page).

The dark palette's own fix for the identical bug moved `bg-elevated` rather than the text, and that
route is closed in attack mode: its elevated sits only 1.11 from `bg-raised`, and darkening it far
enough to clear 4.5 collapses the two together (1.03 apart at `#28241b`, and still only 4.48). Dark
had room because its elevated goes *lighter* than raised. Attack mode remains the lower-contrast of
the two themes — dark's secondary reads 6.46 on its own page against this 6.24.

The 12px `StatCard` labels are the documented type-scale exception. They pass 1.4.3 comfortably —
the divergence there is from the app's own 14px caption floor, not from WCAG.

### 1.4.11 Non-text contrast — UI components and states, 3:1

**Fixed 2026-08-25.** Every author-drawn edge measured 1.15–1.8:1 when first
audited. The fix was not a brighter `--color-bg-border`: that token has 73 call
sites and only ~17 are controls — 47 are decorative dividers, info-box outlines
and section cards, and raising it globally would have turned all of them into a
visible grid, which *is* a photophobia regression under §8.1. A separate
`--color-border-control` was added instead, at 3:1 against the tightest surface
a control sits on, and applied only to controls.

| Boundary | Dark | Attack | Light |
|---|---|---|---|
| Chip / preset ring vs its own fill | 1.16 → **3.04** | 1.24 → **3.07** | 1.15 → **3.15** |
| Chip / preset ring vs the page | 1.47 → **3.87** | 1.44 → **3.58** | 1.40 → **3.85** |
| `btn-secondary` ring vs its own fill | 1.58 → **3.44** | 1.54 → **3.24** | 1.62 → **3.49** |
| Toggle OFF track vs page | 1.47 → **3.87** | 1.44 → **3.58** | 1.40 → **3.85** |
| Toggle thumb vs track (off / on) | **3.44 / 5.42** | **3.24 / 5.86** | — |
| Toggle ON track vs page | 6.09 | 6.47 | 5.26 |
| Focus ring vs page / vs `bg-raised` | 6.09 / 4.79 | 6.47 / 5.55 | 5.26 / 4.30 |
| Logs sparkline (low / high) vs card | 6.50 / 5.33 | 7.04 / 5.77 | 5.58 / 6.10 |
| `MigraineDaysChart` bar vs its track | 4.21 | 4.68 | 3.79 |
| 15-day threshold line vs track | *2.23* | *2.01* | *2.00* |
| Diagram zone fill vs head fill | 6.16 | 6.16 | 5.28 |
| Diagram disabled region vs head fill | *1.06* | *1.06* | *1.09* |
| Diagram head vs page | *1.18* | *1.26* | *1.17* |

The italicised rows are **exempt, not outstanding** — see "Deliberately left"
below. The `btn-secondary` ring stays an inset `box-shadow`, so raising it
costs no layout: it still measures 44px beside its paired primary.

**A second defect surfaced while looking at the screen**, which is the argument
for verifying with neighbours in frame rather than trusting the token table.
The app has two switches and they had drifted: `ProfileView`'s attack-mode
toggle used a light thumb (`bg-text-primary`) where `NotificationSettings`'
used a dark one (`bg-bg-surface`). The light thumb measured **1.70:1 against
the accent track when ON** — the switch's own state indicator was the least
visible thing on it, in the state that matters, and that was true before any of
this work. Both now use the dark thumb. `NotificationSettings`' interval rows
were also hand-rolling their unselected state as `bg-bg-border` instead of
`CHIP_OFF`, against the documented rule; they use `chipClass` now.

### State difference — selected vs unselected, 3:1

**Fixed 2026-08-25** by adding a mark rather than by raising contrast.

| | Before | After |
|---|---|---|
| Chip fill: `accent/20` tint vs `bg-raised` | 1.38 | 1.38 *(unchanged)* |
| Chip label: `accent-light` vs `text-secondary` | 1.26 | 1.26 *(unchanged)* |
| **`ChipCheck` glyph on the selected tint** | — | **4.68** |
| Toggle track: accent vs off-track | 4.14 | 4.14 |

The colour deltas are deliberately unchanged: raising them would mean a louder
selected state on screens that show dozens of chips. `ChipCheck`
(`src/components/ChipCheck.tsx`) carries the state instead, at 4.68:1 with no
palette change — and it satisfies §8.2's stricter "never by colour alone",
which matters here specifically because FL-41 lenses shift exactly the
sage-vs-grey distinction the chips were relying on.

**The slot is always rendered, at `opacity-0` when unselected.** A check that
appears on tap makes a chip wider than its unselected self, so a wrapped row
reflows on every toggle — the same failure as the "Woke up with this migraine"
toggle that changed height as it toggled. Verified at 375px: toggling one chip
in an 8-chip wrapped row moved **nothing** — zero change in width, x or y for
all eight.

### Deliberately left failing

Each has a WCAG exemption, and claiming otherwise would be worse than the gap:

- **Diagram disabled regions** (1.06) — 1.4.11 exempts inactive components.
- **The 15-day threshold line** (2.23) — every row prints its day count as
  text, and the line is already `aria-hidden`; information available in text is
  exempt.
- **The diagram head outline and decorative hairlines** — not required to
  identify any control. This is the whole point of keeping `--color-bg-border`
  quiet.
- **The selected chip's own ring** (`accent/50`, 1.71 against its tint) — the
  selected state is identified by the tint plus the glyph; the ring is
  reinforcement, and raising it would undo the "selected is a tint, never a
  solid fill" rule.

### The other colour criteria

- **1.4.1 Use of colour — passes.** Severity always prints its number beside its colour; the
  laterality glyph carries an `sr-only` label; the sync dot is paired with text; impact renders as a
  named degree. This one was designed for, and §8.2's "never convey meaning by colour alone" is
  stricter than the criterion because FL-41 lenses shift every hue.
- **1.4.4 Resize text — knowingly does not pass**, at a 150% ceiling against the required 200%.
  Already recorded in CLAUDE.md with its justification and the condition that it must be revisited
  before any public release.

### The tension, resolved

1.4.11 pushes toward stronger edges; §8.1 pushes contrast inward. They turned
out to be far less opposed than they looked. 3:1 is not a harsh boundary, and a
1px hairline adds negligible luminance whatever its contrast — §8.1's concern is
large bright fields and saturated hues. The trap was the *token*, not the
requirement: one value doing both jobs meant fixing controls would have meant
brightening 47 decorative lines. Splitting it made the fix cost nothing the
palette cares about.

