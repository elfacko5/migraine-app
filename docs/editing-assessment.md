# Editing an existing record — assessment

**Status:** assessment only, agreed 2026-08-19. No code has been written and
none should be until this is read and an option is picked. It exists because
backlog item 6 ("Edit details" + per-section voice editing) is the largest
unscoped thing left, and its size turned out to be mostly an illusion created
by treating three different jobs as one.

## 1. "Editing" is three jobs, not one

The backlog entry says *"change one part of an existing record"*, which reads
as a single feature. It isn't. The three differ in cost by roughly an order of
magnitude each, and only the third touches the invariant everyone is worried
about.

| | What it changes | Touches snapshots? | Rough cost |
|---|---|---|---|
| **A. Attack metadata** | `triggers`, `wokeWithMigraine`, `impact`, `end` | No | Small |
| **B. Correct a reading** | a `Snapshot`'s areas / severities / medication / symptoms / reliefs / note | Yes — rewrites one | Medium |
| **C. Remove a reading** | deletes a `Snapshot` outright | Yes — changes the count | Medium, different risks |

**A is already half-built and nobody noticed.** `useAttacks.setImpact` mutates
an ended attack's metadata today, and `endAttack` rewrites `end`. The precedent
is set and the invariant is untouched: neither goes near `snapshots`. A is
plumbing plus a form.

## 2. The invariant is narrower than it sounds

CLAUDE.md says the stored snapshots are never rewritten, and that is stated
twice — under retirement, and under `setImpact`. Read in context, **it is a
rule about retirement and about metadata, not a blanket ban on correction**:

> Retiring removes an entry from the aggregates and the pickers, which is a
> different claim from saying it never happened.

That is the actual principle: *the app must not silently revise what the user
reported.* Correcting a severity that was mistyped as 8 when it was 3 is not
the app revising anything — it is the user correcting their own record, which
is the opposite case. The rule was never argued against user-initiated
correction; it was argued against retirement quietly rewriting history.

**So B is permitted by the principle, but it needs the principle's other
half honoured:** an edited reading should carry an `editedAt`, and the timeline
should say so. A diary whose entries can change with no trace is a worse
record than one that can't change at all — and the app already applies exactly
this reasoning to invented severities and invented reminder times.

## 3. What actually breaks — much less than expected

Checked against the code rather than assumed:

- **Sync is a non-issue.** `pushAttacks` writes the *whole attack* as one row
  with a `jsonb` snapshots array, and merging is last-write-wins on
  `updatedAt` per attack. Editing a snapshot is exactly as granular as adding
  one — the same row, the same key, the same conflict semantics. No schema
  change, no migration, no new column. The only requirement is that every edit
  path bumps `updatedAt`, which every existing mutation already does.
- **Every derived figure recomputes from snapshots.** `attackAvgSeverity`,
  `longestPlateauMinutes`, `medicationResponse`, `migraineDaysByMonth`,
  `preventiveEffect`, the breakdown, the sparklines — nothing caches a derived
  value anywhere. Edit the source and the readings self-heal on next render.
  This is the single biggest reason the job is smaller than it looks.
- **`source` needs one explicit rule.** Editing a snapshot written by
  `notification_no_change` makes it no longer a statement that severity held.
  It should become `manual` on edit, or the plateau analytics will keep
  counting a hand-edited reading as an unanswered plateau. One line, but it
  has to be a decision rather than an accident.
- **Editing the *first* snapshot's time has clinical reach.** It moves
  `attackDayKeys`, and therefore migraine days per month, the chronic-migraine
  line, and which side of a preventive's `startedOn` the attack falls. Not a
  reason to forbid it — a wrongly-dated attack is wrong in those figures right
  now — but it is the one edit that changes numbers on other screens, and it
  should be clamped against the other snapshots' times the way
  `EndAttackDialog` already clamps.
- **Already-queued reminders won't re-time.** The dose→`dose + 2h` retiming is
  computed when a dose is written. Editing that dose's time afterwards will not
  move a reminder already sitting in the OS queue. This is the same class of
  staleness already documented for the reminders readout, and the same answer
  applies: accept it, and don't build a diagnostic that lies about it.

## 4. What C (removing a reading) costs that B doesn't

Deleting a snapshot changes the *count*, and two things read the count:

- The adaptive reminder interval (+1h after the first, +2h after subsequent),
  and the `followUpMs` the native handler was handed at schedule time.
- Deleting the **only** snapshot would leave an attack with an empty
  `snapshots` array, which `attackDayKeys`, `attackAvgSeverity` and the Logs
  card all index into unguarded. That has to be forbidden outright: an attack
  with no readings is not a record, it is a deletion — and there is already a
  delete-attack path for that.

C is therefore best framed as *"delete this reading, unless it is the last
one"*, and is worth doing only if double-logging turns out to be a real
problem in practice. Nothing in the diary suggests it is yet.

## 5. Per-section voice editing

**This is an entry point, not a feature, and it cannot be scoped before B
exists.** Voice editing means saying "change the severity to eight" and having
it land — which needs an answer to *which reading*, and that is a targeting
problem the parser has no vocabulary for. `voiceParse.ts` is deliberately
low-precision substring matching against the user's own chip lists; it has no
notion of referring to an existing record.

The realistic version is much smaller: once B exists, the existing voice draft
flow can open the **edit** sheet prefilled instead of the **new attack** sheet
when an attack is ongoing — which is very close to what `QuickUpdateForm`
routing already does. Anything more ambitious is a separate piece of work and
should not be bundled here.

## 6. Options

**Option 1 — metadata only (A).** An "Edit details" sheet on `AttackDetail`
covering triggers, the woke-with-it flag, impact and end time. Snapshots
untouched, invariant untouched, sync untouched. Ships the button the design
already specifies as the primary action on a past attack, and removes the
current oddity of a parked primary slot.

**Option 2 — metadata + correct a reading (A + B).** Adds a per-reading edit
on the timeline, reusing `QuickUpdateForm`'s steps against an existing
snapshot, with an `editedAt` stamp and a quiet "edited" marker on the card,
and `source` demoted to `manual`. This is the version that answers the actual
complaint ("I typed the wrong number").

**Option 3 — everything (A + B + C).** Adds deleting a reading, guarded
against emptying the attack.

**Recommendation: Option 1 now, Option 2 next, and only add C if double-logging
proves real.** Option 1 is small, unblocks a slot the UI is already holding
open, and carries no risk at all; Option 2 is the one worth the design care and
should be started with the `editedAt` marker rather than having it retrofitted.
Voice editing waits for Option 2 and is then a routing change, not a parser
change.

## 7. What this assessment does not settle

- Whether the edit sheet reuses `QuickUpdateForm`'s steps or is its own
  narrower form. Reuse is tempting and probably right, but `QuickUpdateForm` is
  built around *every field starting blank* — an edit form must start
  **populated**, which is the opposite rule, and that is a real change to a
  component with load-bearing behaviour.
- Whether an edited attack should be visibly marked at the *attack* level (on
  the Logs card) or only at the reading level. Reading level is quieter; attack
  level is more honest for a record handed to a clinician.
