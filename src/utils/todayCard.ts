// The card every block on Today below the hero is built from, since v3
// (2026-10-26): `bg-surface`, a 20px radius, 16px padding, and **no border
// and no ring**. It replaced the `rounded-xl bg-bg-raised/60 border` tiles
// and medication rows, which read as a grid of outlined boxes under a hero
// that has no frame at all.
//
// **Today only, for now.** Insights keeps its own bordered tiles until it gets
// the same pass, so the two pages differ on purpose in the meantime (Sunny,
// 2026-10-26). One constant rather than the classes spelled out per card,
// because four cards spelling out a radius is how one of them drifts.
export const TODAY_CARD = 'rounded-[1.25rem] bg-bg-surface p-4';
