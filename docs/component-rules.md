# Shared component rules

Extended notes for shared UI components. Rules are in CLAUDE.md; this file carries API details, state machines, and design reasoning.

## Sheet (`Sheet.tsx`)

Full-screen overlay with two modes:
- **`flush`**: content fills edge-to-edge (used by log/update forms).
- **`bareHeader`**: header with back/close buttons, no title decoration.

### Modal management (`syncModal`)

When multiple sheets are open, the **topmost** (by DOM order, not open order) makes everything behind it `inert` and `aria-hidden`. This is enforced by `syncModal`, which runs on every sheet open/close.

Exception: elements with `data-modal-exempt` attribute are never made inert (used by `Toast`).

### Focus management

- On open: focus moves into the sheet (first focusable element or the sheet container).
- On close: focus returns to the element that was focused when the sheet opened, tracked by `recentPress`. This handles the case where the trigger element has since been removed from the DOM.

## ChipSelector

Pill-shaped toggles with an "Add custom…" button at the end. Visual states come from `chipStyles.ts`:

- **`CHIP_ON`**: selected state — `--color-selected-fill` background, `--color-accent` border, `text-primary font-semibold` label, `ChipCheck` glyph visible.
- **`CHIP_OFF`**: unselected state — `bg-raised` background, `border-control` border, normal-weight label, `ChipCheck` at `opacity-0` (always rendered for stable width).

For pick-one groups (`role="radiogroup"`), use `RadioDot` instead of `ChipCheck`. For pick-any (`aria-pressed`), use `ChipCheck`.

Both states use `ring` (inset box-shadow), **never `border`** — border adds 2px and shifts layout.

## MedicationInput

Composite input for medication selection within log/update forms:

1. **Chip row** first, populated from `recentMeds` (library-acute-first, then history).
2. **Free-text input** behind a ghost button ("Something else?") — only appears when tapped.
3. **Quantity quick-pick** — stepper outside the collapsible section (always visible when a drug is selected).
4. **Radio groups** with `RadioDot` for dose selection.
5. **Dose-time card** — only in the new-attack wizard (LogForm), not in QuickUpdateForm.

## DateTimeField

Two-field date-time input:
- **Time field**: standalone time input.
- **Combined date-time field**: date + time in one row.

On iOS, uses the native `UIDatePicker` plugin (`LiddDatePickerPlugin`) instead of the HTML `<input type="datetime-local">`, which has poor UX in WKWebView.

Time bounds are **day-scoped** — the picker won't let you select a time outside the current day's valid range (e.g. future times are disabled for "when did it start?").

**Auto-open**: when the field appears, the time half opens automatically (via `autoFocus` on the time input). This matters for the update flow where the user expects to set the time immediately.

## NotificationSettings

A real toggle switch (`role="switch"` with proper `aria-checked`), not a checkbox. Uses `BellIcon` from drawn icons, never emoji.

The toggle controls whether the attack's notification schedule is active. Toggling off cancels pending notifications; toggling on reschedules from the current time.

## SnapshotRow

Timeline card rendered on a continuous vertical rail:
- Timestamp text **knocks a gap** in the vertical line (the timestamp's background matches the parent surface colour, creating a visual break).
- **Pain areas first**, then sections named and separated by hairlines.
- `notification_no_change` source renders as "No change" label — severities are carried forward from the previous snapshot for data continuity but **not repeated** in the display. Symptoms and reliefs are **not** carried forward.

## Icons (`drawnIcons.tsx`)

All custom icons use the `svg()` helper:
- 24×24 viewBox, `currentColor` stroke, stroke-width 1.5.
- Med-form icons (tablet, capsule, etc.) at stroke-width 1.75 (`MED_STROKE`).
- **No emoji ever** in the app — emoji render inconsistently across platforms and don't respect the photophobia-aware palette.

Icon usage:
- **Lucide** for UI affordances (back, close, chevron, settings cog, etc.) at stroke 1.8.
- **Hand-drawn** (`drawnIcons.tsx`) for domain-specific marks (pain areas, medication forms, symptoms, triggers, reliefs).
- **`MedIcon`** shared by all medication readers. Call sites render at `h-4`.

## InlineNote / Toast / ValueSheet

Medication flows' shared UI parts:
- **`InlineNote`**: contextual information box within forms. No icon, just text on a surface.
- **`Toast`**: temporary confirmation message. z-60, minimum 5 seconds display, `data-modal-exempt` so it stays visible above sheets.
- **`ValueSheet`**: bottom sheet for selecting from a predefined list of values (used for unit selection, form selection, etc.).
