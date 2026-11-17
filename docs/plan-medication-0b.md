# Plan: commit 0b — Today and Insights move to guides

**Status: plan only, for the reviewer. No code. 0b is not approved.** Written 2026-11-17 on `medication-flows` after 0a (`a96f14c`) was merged into `code-ds`. It restates what `docs/plan-medication-flows.md` already decided for 0b (Q2, Q3, Q4, Q6, Q10, sections 1.2 to 1.4) and adds what reading the code turned up. Where this file and that one disagree, this one is newer and the other gets corrected when 0b is approved.

0b is **the commit that changes numbers**, so it is reviewed alone, before any screen. It builds no UI except one removal (question R1).

Labels: [certain] = read in the code today; [proposal] = my design, needs the reviewer; [guessing] = not checked.

## 1. What 0b does, in one list

1. `guideFor(type, guides)` and the places that read a limit move onto it (Q2, Q3).
2. M3: per-medicine limits fold into guides, once (Q3).
3. Counting moves from "class of the first entry with this name" to **per dose**, through `resolveDose` (Q4, Q10).
4. "Any attack medicine" includes untyped medicines and the old `other` class; gepants stay out (Q6).
5. `resolveDose` changes from 0a: step 1b (an unknown `medId` falls through to the name) and step 3 (strength compared with `parseStrength` where both sides parse). Both answered yes.
6. The sync merge tells a missing or null `medication_guides` from an explicit `{}`, and a clear is pushed as `{}` (the corrections in section 1.2 of the main plan).
7. The seeded test library, and the before and after table from it (section 1.4 of the main plan).

**Not in 0b:** any wizard, editor, overview or delete screen; `sameMedicine` (commit 1, it is used only by the wizard and the edit Save); `isLogged` / `daysTakenOf` in use (commit 4); the recovery copy; Export (its own branch, `export-fix`); badges and letters on Logs / Attack detail (see R3).

## 2. The data layer

### 2.1 `guideFor`

[proposal] In `src/utils/medGuardrails.ts`:

```
type GuideKey = 'triptan' | 'combination' | 'simple' | 'any'
guideFor(key: GuideKey, guides: MedGuides): number      // stored, else guideline
guidelineFor(key): 10 | 10 | 15 | 10                     // the MOH_DAYS_* constants
```

- Stored value must be a positive integer to count; anything else (0, negative, NaN, a string from a hand-edited backup) is ignored and the guideline is used. `cleanGuides` from 0a already drops junk on read [certain, `medResolve.ts`], so this is a second guard, not a new rule.
- A drug's key is `guideKeyOf(cls)`: `triptan | combination | simple` → itself; `gepant` → **none** (`null`: no guideline, no marker, as today [certain, `mohDaysFor`]); `undefined` or `other` → `'any'`.
- `mohDaysFor(name, medications)` is **deleted**, not left beside `guideFor`: two ways to ask for a limit is how the old flat `MOH_DAYS_TRIPTAN` drifted. Its two callers are moved (section 3).
- `MOH_DAYS_*` stay in `stats.ts` as the guideline numbers.
- `COUNTED_CLASSES` in `medClasses.ts` stops carrying `limit`. It becomes the list of `{ value, label, letter }`, and the limit is `guideFor(c.value, guides)` at the call site, so a constant cannot be stale.

### 2.2 Counting per dose

[certain] Today `classDaysInWindow(attacks, classOf)` takes `classOf(name)`, and `TodaySummary` passes `findMedication(medications, name)?.class`, which is the **first** entry with that name. [certain] `medicationDaysInWindow` groups by name and is used for the per-drug rows (Today attack mode and Insights).

[proposal]
- A pure `countingOf(dose, library)` in `medResolve.ts`, built on `resolveDose`:
  - candidates = `resolveDose(dose, library).candidates`;
  - **none** (the name is in no library entry, or a stale id with no name match): **untyped** → `{ bar: null, any: true }`;
  - **all candidates share one class** `c`: `bar = c` if `c` is triptan / combination / simple, else `null`; `any = c !== 'gepant'`;
  - **candidates differ** (old same-name pairs of different types only; Q10 stops new ones): `bar = null`; `any = true` if at least one candidate is not a gepant.
- `classDaysInWindow(attacks, countingOf, windowMs, now)` takes that function (passed in, as today, because `medGuardrails` imports from `stats`; `medResolve` also imports `stats`, so `stats` cannot import it). Output: `triptan`, `combination`, `simple`, `any` (distinct local days, a **union**, never a sum) and `untyped: string[]`.
- **`untyped` stays** in the output: it is what the Today line "X has no type set" reads [certain, `TodaySummary` lines 323 to 327]. It lists names whose doses count under Any only.
- **Per-name rows are unchanged:** `medicationDaysInWindow` still groups by name, so Insights keeps one row per name, and same-name versions share a row (they share a type under Q10). The row's limit uses `typeOfName(name, library)`: the shared class of every entry with that name, or "no marker" when old entries of that name differ. It must not pick the first entry.

### 2.3 `resolveDose` changes (both answered yes)

- **Step 1b:** a `medId` that matches no entry falls through to step 2 (name). The 0a doc comment and the one 0a check that asserts the old rule are rewritten, and new checks added (listed in section 7).
- **Step 3:** among same-name entries, the dose text matches an entry when `parseStrength` reads both sides and number and unit are equal, else when the trimmed text matches case-insensitively. "50mg" against a library "50 mg" now matches; this is seed case 10.
- Everything else in the order is as 0a.

### 2.4 M3 — per-medicine limits into guides, once

**Rule (changed 2026-11-17, reviewer item 203, June said yes): M3 only ever lowers a guide.** For each type, take the per-medicine limits **below** the guideline; if there are any, write the **lowest** as `guides[type]`. A limit **at or above** the guideline writes nothing and is **listed in the M3 report as "above the guideline, not copied"** (an equal limit is listed too, marked equal). A gepant's or an untyped medicine's limit stays inert and is listed. Why: a guide above the guideline would warn later than the number the app already uses, the one direction this page must not fail in. (The earlier text wrote the lowest *differing* value, which could write 12 over a guideline of 10; the m3 script surfaced it.) [proposal] on how it is run once, which the main plan left open:

- **M3 runs only when the local library has at least one medicine (reviewer item 198).** With an empty library it does nothing and **sets no marker**: an empty list is what a fresh install or a not-yet-synced device looks like, and a marker set then would stop M3 from ever running once the real list arrives.
- **A marker, device-local: `hd_med_guides_m3`** (a `localStorage` key, not synced, so Export backs it up like any `hd_` key). The migration runs when the marker is absent, **and only when stored `guides` is empty**. Reason for the second condition: a second device that pulls guides another device already wrote must not run M3 again over them, and one that does not pull any runs the same deterministic rule on the same items and arrives at the same answer. Either way it then sets the marker.
- **The marker is set even when M3 writes nothing, provided the library was not empty**, so a person who later clears a guide is never refilled from stale per-medicine limits.
- It writes through the normal save path (`commit` stamps `updatedAt` and pushes), so it is an ordinary whole-list write and the merge rules apply to it.
- **`maxDaysPerMonth` is not deleted from the stored medicines.** It is data the person typed. Nothing reads it after M3; the field stays in the type until a decision removes it.
- It logs a one-line console report of what it wrote (type and value, and which medicine it came from), and lists untyped medicines that carried a limit and were left inert.
- **Where the gate is:** M3 is **not coded** until June has seen the rule's output on the seeded test library (section 1.4 of the main plan; her backup is not used). The script that produces that output is the first thing built in 0b, with no wiring, and the reviewer sees it before the migration is wired in.

### 2.5 Sync (the two corrections, built now because M3 is the first writer of guides)

[proposal] in `medPrefsMerge.ts`, `useMedications.ts`, `lib/sync.ts`:

- The pulled row keeps the **raw** `medication_guides` value. **Where it is kept:** in memory for one sync run only, in `useMedications.sync` (a local variable, or a ref cleared when the run ends), handed to `mergeMedicationPrefs` and to `guidesForPush`. Nothing is stored. That is enough because **every sync pulls first**, so a push in the same run always has the row it needs; a push outside a sync run (a local edit) uses the `remoteGuidesPresent` flag from the last run's result, which is the same in-memory value and defaults to "no remote guides" when no run has happened yet, so a clear never sends `{}` it cannot justify. `mergeMedicationPrefs`, when the remote stamp is newer: **missing or null → keep local guides; `{}` → adopt it (local guides become empty); a non-empty object → adopt it.** The 0a code runs the value through `cleanGuides` first, which turns all three into the same thing; that is the bug to fix.
- `guidesForPush(local, remoteRaw)`: send the column when local guides are non-empty, **or** when local is empty and the remote row last pulled had non-empty guides (then send `{}`). Decided inside the merge's push-local outcome, so a failed clear is retried by the next sync from the pulled row. A remote row without the column never gets one.
- **The clear UI arrives in commit 2**, so this path cannot trigger from a screen in 0b; it is built and tested now so the data layer is complete before any screen depends on it.

## 3. The callers

[certain] for what each reads today; [proposal] for the change.

| Caller | Today | 0b |
|---|---|---|
| `TodaySummary` class bars | `COUNTED_CLASSES.limit`; classes with days or a library medicine of that class | limit from `guideFor`; days from `classDaysInWindow` with `countingOf` |
| `TodaySummary` mixed line | shown when **two or more classes** have days; limit `MOH_DAYS_MIXED` | limit `guideFor('any')`; shown when more than one of {triptan, combination, simple, untyped} has days, **or when untyped is the only group with days** (see R2) |
| `TodaySummary` warnings | class warnings, mixed, then a per-drug branch with the drug's own limit, and a per-drug default-10 branch for untyped drugs | class and mixed warnings only. **Both per-drug branches go** (Q3: no per-drug limit; Q6: untyped counts under Any, whose warning replaces the per-drug one at the same number, 10) |
| `TodaySummary` attack mode | per drug: days against `mohDaysFor(name)` | per drug: days against `guideFor(guideKeyOf(typeOfName))`; no marker for a gepant or an ambiguous name; "unchanged apart from the window" stays true in shape |
| `TodaySummary` "has no type set" line | "X has no type set, so it isn't counted here." | **that sentence becomes false** (it is counted, under Any). Draft wording per R4: "Sumatriptan has no type set, so it only counts under Any attack medicine." (marked a draft in the PR) |
| `MedicationInsights` | per-name rows; marker against `mohDaysFor` when `monthScale` | marker against `guideFor(...)` for the name's type; same `monthScale` gate; caption clause "or the limit you entered for it in My medications" is **deleted**, nothing added (R4) |
| `useMedications` consumers (`App.tsx` line 117, `StatsView.tsx` line 275) | pass `medications` | also pass `guides` (a prop on `TodaySummary` and `MedicationInsights`, threaded through `StatsView`) |
| `AttackCard`, `AttackDetail`, `QuickUpdateForm`, `MedicationInput`, `widgetSnapshot` | `findMedication` by name | **unchanged** (R3) |

## 4. Every number that can change, and why

This is the list the PR table is checked against: **a difference with no reason here is a bug.** The table is built from the seeded test library by running `diff-figures.sh` at the base commit (`a96f14c`) and at 0b; its first line says the library is seeded test data.

1. **"Any" gains untyped and `other` doses** (Q6). Seed cases 4, 5. Gepants (case 6) still add nothing.
2. **A lone untyped medicine's warning:** was a per-drug line naming the drug at 10; becomes the Any line at 10 (same number, different wording and label). Seed case 4.
3. **A drug's own limit stops mattering** (Q3): the "You entered a limit of N days" warning goes (seed case 1). A limit equal to the guideline changes nothing (case 2).
4. **M3 can move a type's guide below the guideline:** the bar's limit and its warning point change (seed case 3, lowest of two).
5. **Per-dose counting:** a name shared by two library entries no longer takes the first entry's class. Same type → no change. Different types (old data) → that name's doses count in **no bar** and under Any (seed case 8).
6. **Same-name versions of one type** count under that type, as before (case 7).
7. **Stopped medicines still count** while they have doses in the window, as before (case 9).
8. **`parseStrength` match** changes which version an old dose resolves to when it was ambiguous only by spelling (case 10).
9. **Step 1b** changes nothing in the seed (old doses have no id) and is covered by its own check.
10. **Not changing, and checked as unchanged:** per-name days and doses in Insights, the 24-hour unit figures, `checkDose`, the migraine-day and attack tiles, the widget payload.

## 5. Questions for the reviewer (flagged, not decided)

- **R1. ANSWERED (June, 2026-11-17): remove it.** Step 7 removes the "Max days a month" row and its hint from `MedicationEditor.tsx`; the stored `maxDaysPerMonth` field stays. (Step 7 is not built yet: the reviewer approved steps 1 and 2 only.) The current editor still has a "Max days a month" row. After M3 nothing reads it, and a value typed after M3 would be lost (the marker means M3 never reruns). Between 0b and commit 3 (the new editor) that is a dead control that saves a number the app ignores. **Recommendation: 0b removes that one row and its hint from `MedicationEditor.tsx`** (about 10 lines, no new UI), keeping the stored field. The alternative, leaving it until commit 3, risks a person entering a limit that does nothing. This is the only UI change in 0b.
- **R2. ANSWERED yes.** The Any row for a lone untyped medicine. Today's rule shows the mixed line only with two or more classes, to avoid repeating a single class's own row [certain]. An untyped-only user has no class row to repeat, so I propose showing Any then; otherwise their warning disappears, which is the failure this page must not have (staying quiet). **ANSWERED (June): yes.** The "Any attack medicine" row shows **on its own when untyped medicines are the only ones with days** (and, as in the table above, when more than one group has days).
- **R3. CONFIRMED by the reviewer.** Badges and letters stay name-based in 0b. `AttackCard`, `AttackDetail` and `MedicationInput` still use `findMedication` (first entry). For an old same-name pair of different types they can show the first entry's letter while Today counts the dose in no bar. Small and old-data only; moved onto `resolveDose` with the screens that touch them (commits 3 and 4). Reviewer to confirm that is acceptable.
- **R4. ANSWERED (June, 2026-11-17): use the drafts.** Three copy changes, **each marked as a draft in the PR** (the wording stays hers to change later): (1) Today's line becomes "Sumatriptan has no type set, so it only counts under Any attack medicine." (the medicine named as it is today, one name or the joined list as the existing line does); (2) Insights: the clause "or the limit you entered for it in My medications" is deleted, nothing added; (3) the warning when "Any attack medicine" is the only line firing uses the shortest honest wording the session writes in the PR, marked as a draft.
- **R5. The `alter table` must be run before 0b is used with sync.** M3 is the first thing that writes `guides`. On a Supabase table without `medication_guides`, the push (which now names the column) fails, and **all medications sync fails**, not only guides [certain, section 1.2 of the main plan]. Local data is safe and the app shows "Sync failed, will retry". It only happens when M3 writes something, i.e. a library with a limit that differs from its guideline. **Recommendation: the PR says the statement must be run first (it is in `supabase/schema.sql`); I do not run it and make no Supabase call.** No fallback "retry without the column" is built: it hides a missing migration. **CONFIRMED by the reviewer, no fallback.** **The PR gives the exact line and says in plain words where June runs it:** `alter table user_prefs add column if not exists medication_guides jsonb;`, pasted into the **Supabase SQL editor** (supabase.com, her project, SQL editor, New query, Run), once, before she uses 0b with sync. It is safe to run twice.
- **R6. CONFIRMED by the reviewer.** Unresolved doses count as untyped under Any (a dose whose name is in no library entry, for example a typed-in drug or a deleted one). Today they count in no bar and are listed as untyped [certain]; "Any" now includes them. This is a number change beyond the ones June named; it follows from "untyped counts". Reviewer to confirm.

## 6. Build order inside 0b (each step ends with the gates)

1. **Seed first:** `scripts/med-checks/seed.mts` with the ten cases (and `seed.json`), `figures.mts` reads it, `diff-figures.sh` unchanged. At this point the diff against `a96f14c` is empty, which proves the seed adds no change by itself.
2. **M3 as a script only**, run on the seed. **The reviewer reads its output first and gives June a plain table with three columns: type, old limit, new guide** (one row per type M3 would write, plus rows for the medicines it leaves alone and why). June does not read console output. Stop for her read of that table.
3. `guideFor`, `guideKeyOf`, `typeOfName`, `countingOf`; `resolveDose` 1b and step 3; checks for each.
4. `classDaysInWindow` takes `countingOf`; callers moved (section 3); `mohDaysFor` and `COUNTED_CLASSES.limit` deleted.
5. M3 wired into `useMedications` with the marker.
6. Merge and push-rule corrections (section 2.5) with their checks.
7. R1's row removal if the reviewer says yes.
8. Gates, then the before and after table.

Gates every step: `npm run typecheck`, `npm run lint` (zero), `npm run build`, `npm run med-checks`. Never touched: lockfile, `.env.local`, screens 33, 36, 37, any Supabase call, any signed-in origin, ports 5173 and 5174.

## 7. Checks added to `med-checks`

- `guideFor`: stored, missing, zero, negative, non-integer, string; every key; gepant has none.
- M3 on an **empty library**: writes nothing and **sets no marker**, then runs normally once a medicine exists.
- M3 on the seed: below the guideline → written; equals or above → nothing and listed; two of one type below → lowest; one at 12 beside one at 8 → guide 8, the 12 listed; one at 12 alone → no write, listed; untyped → inert and reported; marker set when nothing written; **does not run when guides are already non-empty**; does not run twice.
- `countingOf` and `classDaysInWindow`: untyped, `other`, gepant, same-type pair, different-type pair, no candidates; Any is a union (two untyped drugs on one day = one day).
- `resolveDose`: step 1b (unknown id + one name → that entry; unknown id + none → nothing; unknown id + two → step 3 then ambiguous); step 3 `"50mg"` against `"50 mg"`; free-text strengths compare trimmed.
- Merge: remote newer with `{}` and local guides → adopts `{}`; with null → keeps local; column absent → keeps local; remote older with `{}` and local guides non-empty → local wins and the push sends the local guides; remote older with `{}` and local empty → local wins and the column is omitted; a failed clear retried on the next sync sends `{}`; two devices: A clears, B pulls `{}` and does not push its old guides back.
- `guidesForPush` and `medicationsUpsertRow` for each of the above.
- The unchanged list in section 4.10, as figures in the diff.

## 8. Phone checks (none run yet)

On the native build only after the reviewer approves a device install (the same bundle id as the other worktree overwrites that app): load `seed.json` on a signed-out build, then compare Today and Insights line by line with the 0a numbers and the PR table. Check that every difference is in section 4, that attack mode still shows per-drug rows, and that nothing reads as an alarm that was not there (amber, not the alarm colour, per the tone rules). VoiceOver, 200% text and 44pt need no new check: 0b adds no control (R1 removes one).

## 9. Risks

- The seeded library is mine, so it can miss a case her real use would hit. The ten cases are June's list; the table is a proof for those, not for every library.
- M3 loses a lower per-medicine limit when two medicines of one type disagree and one is higher than the other's lowest: that is the rule (lowest wins), stated in the main plan.
- A mid-sync window where one device runs 0b and another does not: an old client ignores `guides`, and the 0a merge keeps local guides when the remote row has none, so nothing is overwritten; once both have the corrected merge, `{}` clears propagate.
- Counting per dose is the first time `Today` figures depend on `resolveDose`. A bug there changes a safety-adjacent number, which is why the table is a gate and why 0b lands alone.

## M3 seed run (item 203)

Written 2026-11-17 from `npm run med-m3` on `scripts/med-checks/seed.mts` (18 medicines; test data, not a diary). Rule: **M3 only ever lowers a guide** (section 2.4). **M3 is not wired.** Nothing here is committed.

Seed cases added for this rule: case 11 (Eletriptan, a triptan at 12 beside Rizatriptan 6 and Zolmitriptan 9) and case 12 (Aspirin, a simple painkiller at 20, the only limit in its type). "A triptan at 12 alone" and "a triptan at 12 beside one at 8" cannot both be seed cases (a seed library has one triptan group), so they run as small separate libraries inside the script's gate checks and both pass.

### Report

Library: 18 medicines. Gate: run. Marker set afterwards: yes.

### What M3 would write

| Type | Old limit(s) | Guideline now | New guide | Comes from |
| --- | --- | --- | --- | --- |
| Combination painkiller | Treo 8 | 10 | 8 | Treo |
| Triptan | Rizatriptan 6, Zolmitriptan 9 | 10 | 6 | the lowest of 2 |

Types with no row get no write and keep the guideline: Simple painkiller (15).

### At or above the guideline, not copied

| Medicine | Type | Limit | Guideline | Listed as |
| --- | --- | --- | --- | --- |
| Naproxen | Simple painkiller | 15 | 15 | equals the guideline, not copied |
| Eletriptan | Triptan | 12 | 10 | above the guideline, not copied |
| Aspirin | Simple painkiller | 20 | 15 | above the guideline, not copied |

### Limits M3 leaves alone

| Medicine | Limit | Why |
| --- | --- | --- |
| Rizalief | 7 | no type set, so no guide to put it in |
| Nurtec | 8 | a gepant: guides has no gepant, so the number has nowhere to go |

### Same-name pairs in the library

| Name | Versions | Types | Same type? |
| --- | --- | --- | --- |
| Sumatriptan | 50mg / 100mg | triptan / triptan | yes |
| Migraleve | 2 tablets / 1 tablet | combination / simple | **no** |
| Diclofenac | 50 mg / 25 mg | simple / simple | yes |

### Untyped medicines (no type, or class "other")

| Medicine | Class stored | Carries a limit |
| --- | --- | --- |
| Rizalief | (none) | 7 |
| Old thing | other | – |

### Gate checks

| Check | Result |
| --- | --- |
| empty library: does nothing and sets NO marker | ok |
| marker already set: does nothing | ok |
| guides already non-empty: does not run over them, marks M3 done | ok |
| nothing below a guideline: writes nothing but marks M3 done | ok |
| preventives are ignored | ok |
| a second run on the same input gives the same answer | ok |
| a triptan at 12 ALONE: no write, the 12 listed | ok |
| a triptan at 12 beside one at 8: guide 8, the 12 listed | ok |
| a triptan at 12 beside one at 10 (equal): no write, both listed | ok |
| a guide is never raised above its guideline (seed) | ok |

### Gate output (after the rule change)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (zero problems) |
| `npm run med-checks` | 26 checks passed |
| `npm run build` | exit 0 |
| `npm run med-m3` | exit 0, all ten gate checks ok |
| `diff-figures.sh` against `a96f14c` | base: a96f14c   lines before/after: 1992 / 1992. IDENTICAL: no figure on Today or Insights changed. |
| `package-lock.json` | unchanged (git shows no diff) |

Item 202's recommendation (compare across every medicine of the type, counting no limit as the guideline) is replaced by item 203 for this criterion; the results above are for the item 203 rule.

## Build steps 3 to 8 (item 205), run 2026-11-17

Steps 3 to 8 are built, **uncommitted**, and stopped here for review. Base for every comparison: `a96f14c`. All numbers below are on the seeded test library (test data, not a diary).

### What was built, step by step

| Step | What | Files |
| --- | --- | --- |
| 3 | `guideFor`, `GUIDELINE`, `guideKeyOf` (a gepant has none; no class and `other` are Any), `guideForName`; `countingOf`, `typeOfName`, `sameStrengthText`; `resolveDose` step 1b (an unknown `medId` falls through to the name) and step 3 (`parseStrength` match) | `src/utils/medGuardrails.ts`, `src/utils/medResolve.ts` |
| 4 | `classDaysInWindow` counts per dose through `countingOf` (new `DoseCounting`); `mohDaysFor` and `COUNTED_CLASSES.limit` deleted; Today and Insights read `guideFor` / `guideForName`; both per-drug warning branches removed; "Any attack medicine" shown per R2; R4 drafts; `guides` passed from `App` through `StatsView` | `src/utils/stats.ts`, `src/utils/medClasses.ts`, `src/components/TodaySummary.tsx`, `MedicationInsights.tsx`, `StatsView.tsx`, `src/App.tsx` |
| 5 | M3 as a pure `planM3` plus `runM3` (marker `hd_med_guides_m3`), applied when the library is loaded and again when a remote library is adopted; the script now prints from the same code | `src/utils/medMigrations.ts` (new), `src/hooks/useMedications.ts`, `scripts/med-checks/m3.mts` |
| 6 | The merge reads the raw `medication_guides` (missing or null keeps local; an explicit `{}` is adopted); `guidesForPush(guides, remoteHadGuides)` sends `{}` for a clear; the pulled-row answer is kept in memory for one sync run | `src/utils/medPrefsMerge.ts`, `src/hooks/useMedications.ts` |
| 7 | The "Max days a month" row and its hint are gone from the editor; the stored `maxDaysPerMonth` is untouched (the save patch no longer names it, so saving never clears it) | `src/components/MedicationEditor.tsx` |
| 8 | Seed adjusted so the number changes are visible; `figures.mts` reads either tree; the table below | `scripts/med-checks/seed.mts`, `seed.json`, `figures.mts` |

### Decisions I took that the plan did not spell out (reviewer to confirm)

1. **M3 keeps the list's `updatedAt`.** It is a migration, not an edit by the person, so it must not make this device's list win a last-write-wins merge it did not earn (a remote edit made on another device would otherwise be overwritten by a stale local list). Guides still survive a newer remote row without guides (the older-client rule), and an equal stamp pushes them on the next sync. The plan said M3 writes "through the normal save path"; this differs from that on purpose.
2. **The "Any of these" row is now labelled "Any attack medicine"**, the design's name and the name the R4 Today line refers to. It was not in the R4 list of copy changes.
3. **(Superseded by "Fix for item 206" below.)** **A `medication_guides` object whose values are all junk** (not a plain empty `{}`) is cleaned to `{}` and adopted, like an explicit `{}`; a non-object value (a string, an array) counts as missing and keeps local. The 0a check that expected "junk → local kept" was changed to match.
4. **The seed was adjusted** (the figures could not show the Any change because every one of the 30 days already had a typed dose): Ibuprofen days 18 to 27 (was 29), Imigran days 5 to 8 (was 9), and Migraleve also on days 28 and 29. Day 9 is now untyped-only (Rizalief) and days 28 and 29 are covered only by the ambiguous Migraleve pair. Both trees read the same seed, so the earlier "identical" result is unaffected.
5. **The Any row shows** when an untyped medicine had days, when two or more classes had days, or when doses counted under Any only pushed it past the single class shown (old different-type pairs).

### Before and after (`diff-figures.sh a96f14c`, fixed clock, UTC)

Seven of 24 figure sections differ; the 17 others are identical (migraine days and attacks, per-name days and doses at 7, 30 and 90 days and by month, response, frequency, the 24-hour units, `checkDose`, last-dose times, medication ids, Today in attack mode in both states, Insights all time).

| Figure | Before (`a96f14c`) | After (0b) | Reason (section 4) |
| --- | --- | --- | --- |
| Guides in force | none | triptan 6, combination 8 | 4: M3 (lowest of Rizatriptan 6 and Zolmitriptan 9; Treo 8). Eletriptan 12, Aspirin 20, Naproxen 15 not copied; Rizalief 7 and Nurtec 8 inert |
| Triptan days (30 d) | 19 | 19 | none |
| Triptan limit and warning | "19 of 10" | "19 of 6" | 4 |
| Combination days (30 d) | 10 | **8** | 5: two Migraleve doses (days 28 and 29, an old same-name pair of combination and simple) went to the first entry's class; now in no bar |
| Combination limit and warning | "10 of 10" | "8 of 8" (bar full) | 4 (Treo) and 5 |
| Simple days and limit | 14 and 15 | 14 and 15 | none (Naproxen's 15 equals the guideline, Aspirin's 20 is not copied) |
| Any attack medicine (days) | 29 | **30** | 1 and 5: day 9 has only Rizalief (untyped); the Migraleve days still count under Any |
| Any attack medicine warning | "29 of 10" | "30 of 10" | 1 |
| Warning "Rizalief on 8 days … limit of 7" | shown | gone | 3 and 2: a drug's own limit no longer applies; the untyped drug is covered by the Any line |
| Warning "Treo on 8 days … limit of 8" | shown | gone | 3: the class warning "8 of 8 combination" covers it |
| Insights, Rizalief (8 days, 30 d) | marked as nearing (limit 7) | not marked (Any guide 10) | 3 |
| Insights, Sumatriptan (7 days, 7 d) | not marked (limit 10) | marked (guide 6) | 4 |
| Insights 30 d: Sumatriptan 12 and Treo 8 | marked | marked | none |
| Today: "has no type set" line | "… so it isn't counted here." | "… so it only counts under Any attack medicine." | R4 draft |
| Today: row label | "Any of these" | "Any attack medicine" | decision 2 above |
| Insights caption | "… or the limit you entered for it in My medications." | clause deleted | R4 draft |

Every difference is in the "Every number that can change" list (section 4) or in the R4 copy changes; **none is unexplained.** Reason 9 (step 1b) and reason 8 (the `parseStrength` match) show no figure change on the seed and are covered by their own checks.

### Gate output

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 (also run after steps 3 to 7) |
| `npm run lint` | exit 0, zero problems (also after steps 4 and 7) |
| `npm run build` | exit 0 |
| `npm run med-checks` | **58 checks passed** (26 from 0a, 32 new; run after steps 3, 6 and 7 and at the end) |
| `npm run med-m3` | exit 0; the ten gate checks and the M3 table above are unchanged by the move into `src/` |
| `diff-figures.sh a96f14c` | DIFFERENT, as expected, with the table above |
| `package-lock.json` | unchanged (git shows no diff) |

Steps 3 and 4 share one gate run: step 4's new `classDaysInWindow` signature is needed by `TodaySummary` to compile, so step 3's work could not be gated on its own with the old callers.

New checks (32): `resolveDose` step 1b (three cases) and the `"50mg"` against `"50 mg"` match; `sameStrengthText`; `guideFor` (stored, missing, 0, negative, fractional, string, null) and `guideKeyOf`; `countingOf` (each class, untyped, `other`, no entry, gepant, same-class pair, different-class pair, gepant pairs, `medId` and unknown id); `typeOfName`; `classDaysInWindow` (per dose, Any is a union, window, retired); M3 (lowest below guideline, at or above listed, 12 beside 8, 12 alone, inert limits, empty library with no marker then runs, non-empty guides, runs once, nothing below a guideline); the merge (explicit `{}` adopted, null, absent and a non-object keep local); the push rule (local guides sent, `{}` only when the pulled row had guides, column omitted otherwise, a failed clear retried from the pulled row, two devices).

### In the app (signed-out origin on port 5176, no `sb-` key, cleared afterwards)

Seed pasted into `localStorage` in the old shape and the app reloaded. `hd_medications` gained `guides` of `{ combination: 8, triptan: 6 }` and the marker `hd_med_guides_m3`; `updatedAt` stayed `2026-11-01T00:00:00Z`; Treo's stored `maxDaysPerMonth` 8 and Eletriptan's 12 were kept. Today showed "13 of 6 triptan days", "8 of 8 combination painkiller days", the Any line and the new untyped line (the real clock, so the day counts differ from the fixed-clock table). With an empty library the app wrote no marker. The dev server was stopped and `.claude/launch.json` restored.

### Not done, by instruction or by design

Nothing committed or pushed; no native build; no Supabase call and no sign-in; the clear-guides UI (commit 2) and `sameMedicine` (commit 1) are not built; badges and letters stay name-based (R3).

## Fix for item 206

Reviewer item 206 changed decision 3; item 207 recorded June's "keep it" for the "Any attack medicine" label (nothing to change there). Done 2026-11-17, uncommitted.

**The problem (reviewer's, confirmed):** my merge treated any plain object as written by a client that knows guides, so a newer remote row carrying `{"triptan": "abc"}` cleaned to `{}` and wiped the local guides. The M3 marker is set, so M3 never runs again, and the guide falls back to the guideline: on the seed, the triptan warning would move from 6 days to 10, the later-warning direction item 203 ruled out.

**The fix** (`guidesFromRemote` in `src/utils/medPrefsMerge.ts`): a newer remote row's guides are adopted **only when the raw value is a literal empty `{}`** (the clear) **or every key in it cleans to a valid number**. Anything else keeps the local guides whole: missing, null, a non-object, or an object with any key that does not clean. That includes an **unknown key** (a value from a newer client that this one cannot read), which I treated as junk on the same reasoning: keeping local is the safe direction, and the next write from this device overwrites the remote either way.

**Checks changed, said plainly:**
- The 0a check "remote newer, guides column is junk: cleaned away, local kept" is **restored to its 0a name and its 0a expectation** (`{ simple: 14 }` kept). I had changed it last turn to expect `{}`; that was the wrong change and is reverted.
- Added: a mixed object (one valid key, one junk) keeps local guides whole, in three shapes (`{ triptan: 7, any: 'x' }`, `{ triptan: 'abc' }`, `{ triptan: 7, futureKey: 3 }`); and an object whose every key is valid is adopted.
- Still passing and unchanged: an explicit `{}` is adopted, null and absent keep local, a non-object keeps local, the two-device clear, and the push-rule checks.

**Gate output after the fix**

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, zero problems |
| `npm run build` | exit 0 |
| `npm run med-checks` | **60 checks passed** (58 before, 2 added) |
| `npm run med-m3` | exit 0 |
| `diff-figures.sh a96f14c` | same differences as the table above; the after-figures file is byte-identical to the one before this fix (the seed has no remote row) |
| `package-lock.json` | unchanged (git shows no diff) |

### Addendum (item 209): the two guards now agree

Item 209 corrected item 208's last note: `guideFor` already required a whole number (plan-0b line 33 is accurate), but `cleanGuides` accepted any positive finite number. A newer remote row with `{ "triptan": 7.5 }` therefore counted as "every key cleans", was adopted over a local `{ "triptan": 6 }`, and `guideFor` then ignored the 7.5 and fell back to the guideline 10: the later-warning direction item 203 ruled out, by the route item 206 closed. Reach was only a hand-edited remote row or a future client writing a decimal; no screen in 0b writes guides.

**Fix:** `cleanGuides` (`src/utils/medResolve.ts`) now requires `Number.isInteger(n) && n > 0`, the same test `guideFor` applies, so a decimal falls under the mixed-object rule and the local guides are kept whole. A stored decimal in `hd_medications` is likewise dropped on read.

**Check added (1):** remote newer `{ triptan: 7.5 }` over local `{ triptan: 6 }` keeps `{ triptan: 6 }`, plus `cleanGuides({ triptan: 7.5, simple: 12 })` → `{ simple: 12 }`. No existing check was changed.

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, zero problems |
| `npm run build` | exit 0 |
| `npm run med-checks` | **61 checks passed** (60 before, 1 added) |
| `npm run med-m3` | exit 0 |
| `diff-figures.sh a96f14c` | after-figures byte-identical to before this addendum |
| `package-lock.json` | unchanged (git shows no diff) |

