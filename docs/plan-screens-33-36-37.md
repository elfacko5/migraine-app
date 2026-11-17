# Plan: screens 33, 36, 37 adopt the package defaults (Lidd `code-ds`)

Written 2026-11-17 from `code-ds` `40a6ddd`. **Plan only. No code changed.** Waiting for the reviewer to read it.

Direction (review items 168, 171, 173, 174): these three screens take the package defaults. The old look is not matched. No before and after pair reviews. A role is added only if a screen needs one, and a missing one is recorded as a gap, not worked around in Lidd.

Tags: [certain] read in the code this session, [likely] read but not run, [guessing] not checked.

## What each screen is today [certain]

| Screen | Where | Raw or Lidd-own parts that the package has |
|---|---|---|
| 36 Account & sync | `AccountPanel` and `SignInForm`, `ProfileView.tsx:334` and `:395` | 2 raw `<input>` (email, 6-digit code), 3 `btn-primary` / `btn-secondary` buttons, a hand-drawn card (`rounded-inset border bg-raised/40`) |
| 37 Data | `DataPanel`, `ProfileView.tsx:476` | 2 `btn-secondary` buttons in a 2-column grid, a hidden file `<input>` (stays raw), the Lidd `ConfirmDialog` (danger), the same hand-drawn card, plus `ReminderDiagnostics` |
| 33 Headache impact | `Hit6View.tsx` (250 lines, 4 stages: intro, 6 questions, result, delete) | `btn-primary` / `btn-secondary` footer buttons, 6 answer rows as raw buttons with `ChipCheck`, a hand-drawn progress rule, a result card, a history list with raw Delete buttons, the Lidd `ConfirmDialog` (danger) |

All three render inside Lidd's `ProfileSubPage` inside Lidd's `Sheet`. Screens 1 and 2 left that shell alone, and so do these (Sheet and top bar belong to screens that wait for June's design).

## Package parts used

- **`Button`** (variant primary, secondary, tertiary, danger; `fullWidth`, `loading`, `loadingLabel`, `disabled`, `type="submit"`). Replaces every `btn-*` here.
- **`TextField`** for the email and the code. It has `label`, `hint`, `error`, `type="email"`, `inputMode`, `autoComplete`, `required`. [likely] `autoComplete="one-time-code"` and `inputMode="numeric"` both exist on it. A visible label replaces the `aria-label` plus placeholder pair.
- **`ChipGroup type="one"` and `Chip`** for the six HIT-6 answers, as on Reminders (screen 2) [certain that screen 2 uses them]. Five options per question, each label is a sentence fragment ("Rarely", "Very often"), so one chip per row and full width [likely it needs a full-width mode; if the chip only hugs its label the answers become a ragged column, which is a gap to record, not to fix].
- **`List` and `ListRow`** for the Previous list on 33 (score, band, date; Delete as the trailing action). [guessing] A `ListRow` with a trailing button works. If it does not, the row stays a plain row and the gap is recorded.
- **`ConfirmDialog`** (package: `tone="destructive"`, `description`, `onOpenChange`, required `cancelLabel`). See decision 1.
- Not used: package `Sheet` and `TopBar` (screens that wait), `EmptyState` (nothing here is empty), `Toast`.

## Order and commits

One commit per screen, so each can be dropped alone. Order: **36, 37, 33**, smallest to largest. 36 first because it is the only one with form fields, so it tests `TextField` inside Lidd's Sheet with the keyboard plugin on `resize: 'native'`. 37 shares the card removal with 36.

1. **36 Account & sync.** Remove the hand card. Signed in: the email line, the sync line (`SyncIndicator` stays Lidd's: it is a status, no package part), `Button variant="secondary" fullWidth` Sign out. Signed out: `TextField` (email, `hint` carries the "no password, we'll email you a link" sentence), `Button primary fullWidth` with `loading` / `loadingLabel` "Sending…". Code step: `TextField` for the code, `Button secondary fullWidth` Verify code with `loading`. Errors go to `TextField`'s `error` prop, not a loose `<p>`.
2. **37 Data.** Remove the hand card. Two `Button secondary` side by side stay a two-column grid [likely fine], the explainer sentence stays as text, the import error moves to a plain error line in the package error colour. The file input stays a hidden raw `<input type="file">`: no package part picks a file, and it is not a visible control. `ReminderDiagnostics` is **not touched** (diagnostic text, no package part) and is listed so it is not silently restyled.
3. **33 Headache impact.** Footer pair (Back, Next / See my score, Done) become `Button`. Start / Answer again become `Button primary fullWidth`. Answers become `ChipGroup type="one"`. The result number card and the progress rule stay Lidd-drawn (no package part): the rule is a bar with no role, see gap 2. Delete rows: see above.

## Decisions I need before code (the reviewer or June)

1. **Two ConfirmDialogs.** The package one has a different API from Lidd's `ConfirmDialog`, which five other screens use (`AttackDetail`, `InsightSection`, `MedicationEditor`, `QuickUpdateForm`, plus these two). Adopting the package one on 37 and 33 leaves two dialogs in the app until the others adopt. Option A: adopt it on 37 and 33 now, accept two for a while. Option B: leave both on Lidd's dialog now, adopt in one pass with the screens that wait. **My recommendation: A**, because a dialog opened over a Sheet is exactly what the package version has to prove, and the decision says adopt now. Risk, [guessing]: the package dialog drawn over Lidd's Sheet (z-index, scrim, focus trap against Lidd's own Sheet trap) has not been run; screen 37's import dialog is the first test. If it fails, fall back to B and record why.
2. **The progress rule on 33** stays Lidd-drawn with no package part. Accept, or ask for a package progress component. I assume accept (no new role until a screen needs one).

## Gaps expected, to be recorded and not worked around

- The List card is drawn in `surface` (June accepted this, item "List card colour").
- No hint slot on `Switch`: not relevant here, no switch on these screens.
- Answer chips may hug their label (see above).
- 33's result card and progress rule have no package part.

## Checks I will run [certain they are the ones named, none run yet]

- `npm run typecheck`, `npm run lint`, `npm run contrast`: all zero.
- Raw `<button>` and `<input>` left in 33, 36, 37: none except the hidden file input.
- Chromium by hand at the default and the 150% text size, in dark, light and attack: sign-in form (send link, code step, error), sign out, export, import (confirm, cancel), HIT-6 intro, one question, result, delete confirm.
- Sign-in is **not** exercised against Supabase: the origin must be signed out first and I will not send a real email. The forms are checked up to the submit call only. Said now so it is not read as tested later.
- Not run on a phone. Items for June's phone: the keyboard over the Account email field and the code field (first package `TextField` in Lidd's `resize: 'native'` Sheet), and the package confirm dialog over a Lidd Sheet.

## Reviewer's six points, answered (2026-11-17)

1. **Why Sheet and ProfileSubPage stay.** Not the keyboard. Two reasons. (a) Lidd's Sheet is what every other screen sits in (My medications, both wizards, Attack detail); swapping it for the package Sheet inside three screens would put two sheet implementations on one stack, and the sheet and the top bar are Today, Logs and flow work that waits for June's design (items 170, 171). Screens 1 and 2 did the same. (b) The keyboard: with `resize: 'native'` Lidd's shell is shortened by the plugin, and the package Sheet has been tested only against the showcase, not under that plugin [likely]. **Recorded as a gap: package Sheet and Top bar under `resize: 'native'` are untested in Lidd.** I would not call it the reason, because I did not try it.
2. **Code field.** [likely] `TextField` spreads its remaining props into Base UI's `Field.Control` (`TextField.tsx`, `{...rest}`), and its props type lists `autoComplete` and `inputMode: 'numeric'`, so `one-time-code` and a numeric keyboard are passed through. Not run: I have not checked the rendered attributes or seen iOS offer the code. Check: read the DOM attributes in Chromium; the iOS autofill offer is a phone check. If an attribute is dropped, that is a gap. Also a difference to accept: the field gets a visible label (the package has no placeholder), so the "123456" hint goes.
3. **HIT-6 chips at large text.** Added. Lidd's ceiling is **150%** (`CLAUDE.md`, the text scale runs 87.5 to 150%; 200% is not offered), so I will check 150% and, because the reviewer asks, also force 200% with `data-scale` in Chromium. Check: longest answer wraps without clipping, every chip's hit area is 44px or more, the footer pair stays on screen. Phone: June at 150%.
4. **Pressed colour.** Added. [certain] Lidd's `theme.css` sets no `--color-pressed`. [certain] The linked package build (`lidd-phase7-integration`, `01966af`) does not have the `pressed-role` branch: its pressed tint is `bg-selected` directly (`src/styles/pressable.ts`), and Lidd does set `--color-selected` in all three modes. So today a pressed secondary or tertiary Button shows Lidd's selected tint. Phone check for June, in dark, light and attack: hold Sign out (secondary), Export backup (secondary) and a tertiary Button if any screen shows one (none of these three does; I will say so rather than invent one), and say what the button looks like while held. Chromium cannot hold a press.
5. **Checks and delivery.** Checks are the list above plus items 2 to 4. **Package linked: branch `lidd-phase7-integration`, commit `01966af`** (throwaway, never pushed, never to main; `node_modules/code-ds` links to `/Users/sunny/code-design-system-main`). Delivery to the phone: June runs the `App` scheme in Xcode from this worktree (`ios/App`); the run-script phase builds the web bundle and runs `cap copy` itself, so no extra step. Free provisioning, 7-day expiry. The `VITE_VIEWPORT_PROBE` flag stays unset. I tell June which commit to be on.
6. **Branching.** One commit per screen on `code-ds`, as screens 1 and 2 were done (`7b3f943`, `dc43508`), not one branch per screen. The older `code-ds-screen-*` branches exist but the last two screens did not use them [certain from `git log`]. If the reviewer wants a branch per screen, say so; the cost is three merges.

## Not touched

`ProfileSubPage`, `Sheet`, `SettingsGroup`, `AppRoot`, the package, `CLAUDE.md`, `docs/viewport-architecture.md`, the temporary viewport probe (still in the tree, off), `project.pbxproj`. Nothing pushed.
