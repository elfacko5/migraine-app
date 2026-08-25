# The three palettes

The app ships **dark** (default) and **attack** (`data-theme="attack"`). A **light** palette is
specified here and is **not wired up** — see "What shipping light mode would take" at the bottom.

Every value below is measured, not transcribed. The dossier's §10 tokens are *starting values it
tells you to tune on real screens*, and the dark palette already diverges from them in three places
for exactly that reason. The light palette diverges in the same way and for the same reason: its
literal `--text: #2A2724` measures 13.0:1 against its own `--bg`, which is the max-contrast pairing
§8.1 says to avoid in the same breath as it asks for AA.

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
| `--color-text-primary` | `#3a3733` | `#cdc7bb` | `#c9c4b8` |
| `--color-text-secondary` | `#5a554c` | `#a39d92` | `#8e8a7e` |
| `--color-accent` | `#4f6b57` | `#7fa187` | `#7fa187` |
| `--color-accent-light` | `#3c5544` | `#9bb9a1` | `#93ae99` |
| `--color-button-secondary-bg` | `#ece7dd` | `#262421` | `#1e1e17` |
| `--color-button-secondary-border` | `#bfb7a6` | `#47433d` | `#403d33` |
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
| text-secondary | 5.35 | 4.86 | 4.60 | **4.14** |
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
| `FreqBars` count · `MigraineDaysChart` month label — 14px secondary on `bg-elevated` | 4.58 | **4.14** | 4.87 |
| Chart content — 14px primary on `bg-elevated` | 7.33 | 8.20 | 7.79 |
| `StatCard` label — 12px secondary on `bg-raised/60` | 5.66 | 4.93 | 5.89 |
| `StatCard` value — 28px primary | 9.06 | 9.78 | 9.43 |
| Disabled button / chip-off label — secondary on `bg-raised` | 5.08 | 4.60 | 5.42 |
| Chip-on label — `accent-light` on `accent/20` over `bg-raised` | 4.67 | 4.78 | 4.68 |

**Passes, with one exception.** Attack mode's `--color-text-secondary` measures **4.14:1** on
`bg-elevated`, which is where `InsightSection` puts a chart's own labels once the section has a
note. Reachable today: Insights is untouched by attack mode, so the frequency-bar counts and the
migraine-days month labels render there below AA whenever attack mode is on. Nudging the token to
`#96917f` clears it at 4.52 without changing anything else; `#9a9689` gives 4.82 with more headroom.

The 12px `StatCard` labels are the documented type-scale exception. They pass 1.4.3 comfortably —
the divergence there is from the app's own 14px caption floor, not from WCAG.

### 1.4.11 Non-text contrast — UI components and states, 3:1

| Boundary | Dark | Attack | Light |
|---|---|---|---|
| Chip-off ring vs its own fill | **1.16** | **1.24** | **1.15** |
| Chip-off fill vs the page | **1.27** | **1.17** | **1.22** |
| Chip-on ring (`accent/50`) vs its tint | **1.71** | **1.79** | **1.54** |
| `btn-secondary` ring vs its own fill | **1.58** | **1.54** | **1.62** |
| `btn-secondary` ring vs the page | **1.77** | **1.70** | **1.78** |
| Toggle OFF track vs page | **1.47** | **1.44** | **1.40** |
| Toggle ON track vs page | 6.09 | 6.47 | 5.26 |
| Focus ring vs page / vs `bg-raised` | 6.09 / 4.79 | 6.47 / 5.55 | 5.26 / 4.30 |
| Logs sparkline (low / high) vs card | 6.50 / 5.33 | 7.04 / 5.77 | 5.58 / 6.10 |
| `MigraineDaysChart` bar vs its track | 4.21 | 4.68 | 3.79 |
| 15-day threshold line vs track | **2.23** | **2.01** | **2.00** |
| Diagram zone fill vs head fill | 6.16 | 6.16 | 5.28 |
| Diagram disabled region vs head fill | **1.06** | **1.06** | **1.09** |
| Diagram head vs page | **1.18** | **1.26** | **1.17** |

**Does not pass, and the failure is structural rather than palette-specific** — the same boundaries
fall short in all three modes by almost identical margins, because they come from one decision:
outlines are drawn one step off their own surface. Everything that carries *meaning* through colour
— focus ring, severity fills, sparklines, the on-state toggle — clears 3:1 with room. Everything
that merely draws an *edge* is around 1.2–1.8:1.

### State difference — selected vs unselected, 3:1

| | Dark | Attack | Light |
|---|---|---|---|
| Chip fill: `accent/20` tint vs `bg-raised` | **1.38** | **1.38** | **1.28** |
| Chip label: `accent-light` vs `text-secondary` | **1.26** | **1.44** | **1.10** |
| Toggle track: accent vs `bg-border` | 4.14 | 4.49 | 3.76 |

The chip's selected state is carried by three simultaneous changes — fill tint, ring, label colour —
**none of which individually reaches 3:1**, though they compound. The toggle passes.

### The other colour criteria

- **1.4.1 Use of colour — passes.** Severity always prints its number beside its colour; the
  laterality glyph carries an `sr-only` label; the sync dot is paired with text; impact renders as a
  named degree. This one was designed for, and §8.2's "never convey meaning by colour alone" is
  stricter than the criterion because FL-41 lenses shift every hue.
- **1.4.4 Resize text — knowingly does not pass**, at a 150% ceiling against the required 200%.
  Already recorded in CLAUDE.md with its justification and the condition that it must be revisited
  before any public release.

### The tension, stated honestly

1.4.11 pushes toward stronger edges; §8.1 pushes contrast inward. These are less opposed than they
look — 3:1 is not a harsh boundary, and most of the shortfalls above sit at 1.2–1.8, with a lot of
room below "harsh". The toggle's off-track reaches 3:1 at roughly `#6b655c` in dark, which is still
a quiet grey.

The **chip ring is the genuinely hard case**, because it sits between two colours and needs 3:1
against *both*: in dark that means about `#7d7669` (3.04 against the chip fill, 3.87 against the
page), which is a visibly brighter outline on every chip in the app, on screens that show dozens.
That one is a real design trade, not an oversight to correct — and it is the decision to take
deliberately if the app is ever released publicly on an accessibility thesis.

## Audit findings on the shipping palettes

Found while measuring, not part of the light-mode work, and **not changed**:

- **Dark `--color-warning` is 3.35:1 on `bg-elevated`** and 3.71 on `bg-raised` — below the AA this
  palette is tuned to hit. It currently renders on Today (`bg-base`, 4.72) so nothing on screen is
  failing, but it is the one token that would fail the moment it moved into an Insights section.
  Attack mode's is 3.87 on elevated.
- **Dark severity-mid (4.45) and severity-high (4.25) are just under AA on `bg-elevated`.**
  CLAUDE.md's rule names `bg-raised` as the tight surface, where both pass (4.94 / 4.72).
  `bg-elevated` is tighter still and postdates that rule.
- Four call sites still hardcode `#e4dfd6` (the dossier's rejected text value) and one hardcodes
  `#a65a52` (the rejected severity-high). Listed in the session that found them; they are in the
  SVG/Recharts group above, which is exactly the group that goes stale.

## What shipping light mode would take

The palette is the small half. In order:

1. A `[data-theme="light"]` block in `src/index.css` — the table above, mechanical.
2. **`color-scheme: light`** switched with it, or every native control (the `datetime-local`
   pickers, scrollbars, the WKWebView's own chrome) stays dark inside a light page.
3. **A second copy of every hand-mirrored constant**, read through a function rather than a
   module constant, because those files are evaluated once at import and can't respond to a theme
   attribute. This is the real work, and it touches the head diagram, both charts and the heatmap.
4. **The Today hero artwork.** The gradients fade from `bg-bg-base` so the photograph dissolves into
   the page; against a light page the same images need a light-mode treatment or the hero becomes
   the one dark rectangle in the app.
5. A third state on the theme control, which today is a boolean (`hd_attack_mode`), plus the
   interaction with `BrightnessOverlay` — its scrim is a warm *dark* wash and would need to become
   a lightening one, or dimming a light page would only muddy it.
6. Re-verification on device. §8.1's whole point is that a large light field at phone brightness is
   itself the aggravating stimulus, so a light mode has to be judged on a phone in a dark room by
   someone with photophobia — which is the test this palette has not had.

**Whether to ship it is a separate question from whether it exists.** §8.1 says to offer warm light
*and* true dark *and* attack mode; CLAUDE.md's "the app is always dark" is a narrower call taken
because this is a single-user app whose user wanted dark. This document exists so that call can be
revisited with the numbers already done.
