// Getting rid of a junk entry — a mis-dictated relief, a "medication" that
// was never one — can't be done by deleting it, and this is the whole reason
// why: the trigger/symptom/relief lists merge across devices as a *union*, so
// a local delete is undone by the next sync pulling the remote copy back.
// Retiring names the entry instead, and every path that produces a list runs
// the prune — including after the union, which is the half that would
// otherwise resurrect it.
//
// **It also has to reach attack history, not just the lists.** The chip lists
// are only where an entry is *offered*; the Insights tallies are built from
// what's stored in the snapshots, so pruning the list alone left a retired
// relief still on "Top reliefs" and a retired medication still counted as a
// medication day. Both are aggregates — figures about a pattern — and a
// retired entry is by definition not part of one.
//
// **The stored snapshots are never rewritten.** `AttackDetail`'s timeline is
// the record of what was actually logged and still shows it; retirement
// removes an entry from the aggregates and the pickers, which is a different
// claim from saying it never happened.
//
// Matched case-insensitively on the trimmed string, so it survives however
// the entry was capitalised when it was typed.
const RETIRED_ENTRIES = [
  'a beer and dry',
  'a beer',
  // The tail of "a beer and dry" after the voice parser split it — it reached
  // attack history as a medication name, so it was counted as a medication day
  // and a dose in Insights, and offered as a filter option.
  'dry',
  'hjgkfdgkdfjgkdfg',
  // Dropped from DEFAULT_RELIEFS (2026-08-19): near-duplicate of "Exercise"
  // and rarely used. Retiring is the half that actually removes it — a
  // default taken out of the array is still in every stored list, and the
  // union merge would hand it straight back on the next sync. Never logged
  // here, so nothing leaves the Insights tallies with it.
  'stretching',
];

export function isRetired(name: string | null | undefined): boolean {
  if (!name) return false;
  return RETIRED_ENTRIES.includes(name.trim().toLowerCase());
}

export function pruneRetired(list: string[]): string[] {
  return list.filter((item) => !isRetired(item));
}
