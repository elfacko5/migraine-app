// M3 as a script only (docs/plan-medication-0b.md, section 2.4, build step 2).
// NOT wired into the app: nothing here reads or writes localStorage, the
// network or any account. It runs the M3 rule over the seeded test library and
// prints what it would do as plain tables, so the rule can be read before it is
// built into `useMedications`.
//
// **Rule: M3 only ever lowers a guide.** Per type, the limits below the
// guideline; the lowest is written. At or above: listed, not copied.
// The rule itself lives in `src/utils/medMigrations.ts` (step 5); this script
// only prints what it does on the seeded library.
import { library } from './seed.mts';

import { planM3 as m3, type M3Result } from '../../src/utils/medMigrations.ts';
import { GUIDELINE } from '../../src/utils/medGuardrails.ts';
import { isCountedClass as isKey } from '../../src/utils/medClasses.ts';
import type { Medication } from '../../src/types/index.ts';

type Med = Medication;
type Key = 'triptan' | 'combination' | 'simple';

// ── output ────────────────────────────────────────────────────────────────

const items = library as unknown as Med[];
void ({} as M3Result);
const TYPE_NAME: Record<Key, string> = { triptan: 'Triptan', combination: 'Combination painkiller', simple: 'Simple painkiller' };
const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const out: string[] = [];

const r = m3(items, {}, false);
out.push('# M3 on the seeded test library (test data, not a diary)\n');
out.push(`Library: ${items.length} medicines. Gate: ${r.gate}. Marker set afterwards: ${r.setsMarker ? 'yes' : 'no'}.\n`);

out.push('## What M3 would write\n');
out.push(table(['Type', 'Old limit(s)', 'Guideline now', 'New guide', 'Comes from'],
  r.writes.map((w) => [TYPE_NAME[w.type], w.from.map((f) => `${f.name} ${f.limit}`).join(', '), String(w.guideline), String(w.value),
    w.from.length > 1 ? `the lowest of ${w.from.length}` : w.from[0].name])));
out.push('\nTypes with no row get no write and keep the guideline: ' +
  (['triptan', 'combination', 'simple'] as Key[]).filter((k) => !r.writes.some((w) => w.type === k)).map((k) => `${TYPE_NAME[k]} (${GUIDELINE[k]})`).join(', ') + '.');

out.push('\n## At or above the guideline, not copied\n');
out.push(r.notCopied.length ? table(['Medicine', 'Type', 'Limit', 'Guideline', 'Listed as'],
  r.notCopied.map((n) => [n.name, TYPE_NAME[n.type], String(n.limit), String(n.guideline), n.limit === n.guideline ? 'equals the guideline, not copied' : 'above the guideline, not copied'])) : 'none');

out.push('\n## Limits M3 leaves alone\n');
out.push(r.inert.length ? table(['Medicine', 'Limit', 'Why'], r.inert.map((i) => [i.name, String(i.limit), i.why])) : 'none');

out.push('\n## Same-name pairs in the library\n');
const groups = new Map<string, Med[]>();
for (const m of items) groups.set(m.name.trim().toLowerCase(), [...(groups.get(m.name.trim().toLowerCase()) ?? []), m]);
const pairs = [...groups.values()].filter((g) => g.length > 1);
out.push(table(['Name', 'Versions', 'Types', 'Same type?'], pairs.map((g) => [
  g[0].name, g.map((m) => m.strength || m.dose || '?').join(' / '), g.map((m) => m.class ?? 'none').join(' / '),
  new Set(g.map((m) => m.class ?? 'none')).size === 1 ? 'yes' : '**no**'])));

out.push('\n## Untyped medicines (no type, or class "other")\n');
const untyped = items.filter((m) => m.kind === 'acute' && !isKey(m.class) && m.class !== 'gepant');
out.push(table(['Medicine', 'Class stored', 'Carries a limit'], untyped.map((m) => [m.name, m.class ?? '(none)', m.maxDaysPerMonth ? String(m.maxDaysPerMonth) : '–'])));

// The gating cases, asserted so the script fails loudly if the rule drifts.
const checks: [string, boolean][] = [
  ['empty library: does nothing and sets NO marker', (() => { const e = m3([], {}, false); return e.gate === 'empty-library' && e.writes.length === 0 && !e.setsMarker; })()],
  ['marker already set: does nothing', m3(items, {}, true).gate === 'marker-set' && m3(items, {}, true).writes.length === 0],
  ['guides already non-empty: does not run over them, marks M3 done', (() => { const g = m3(items, { triptan: 7 }, false); return g.gate === 'guides-not-empty' && g.writes.length === 0 && g.setsMarker; })()],
  ['nothing below a guideline: writes nothing but marks M3 done', (() => { const g = m3([{ id: 'a', name: 'X', kind: 'acute', class: 'simple', maxDaysPerMonth: 15 }], {}, false); return g.gate === 'run' && g.writes.length === 0 && g.setsMarker; })()],
  ['preventives are ignored', m3([{ id: 'a', name: 'P', kind: 'preventive', class: 'triptan', maxDaysPerMonth: 3 }], {}, false).writes.length === 0],
  ['a second run on the same input gives the same answer', JSON.stringify(m3(items, {}, false)) === JSON.stringify(r)],
];
// The same rule on small libraries, for shapes the seed cannot hold at once (a
// seed library has one triptan group, so "a triptan at 12 alone" has to be its own).
const t = (id: string, limit?: number): Med => ({ id, name: id, kind: 'acute', class: 'triptan', ...(limit ? { maxDaysPerMonth: limit } : {}) });
const scen = (meds: Med[]) => m3(meds, {}, false);
checks.push(
  ['a triptan at 12 ALONE: no write, the 12 listed', (() => { const e = scen([t('A', 12)]); return e.writes.length === 0 && e.notCopied.length === 1 && e.notCopied[0].limit === 12; })()],
  ['a triptan at 12 beside one at 8: guide 8, the 12 listed', (() => { const e = scen([t('A', 12), t('B', 8)]); return e.writes.length === 1 && e.writes[0].value === 8 && e.notCopied.some((n) => n.limit === 12); })()],
  ['a triptan at 12 beside one at 10 (equal): no write, both listed', (() => { const e = scen([t('A', 12), t('B', 10)]); return e.writes.length === 0 && e.notCopied.length === 2; })()],
  ['a guide is never raised above its guideline (seed)', r.writes.every((w) => w.value < w.guideline)],
);
out.push('\n## Gate checks\n');
out.push(table(['Check', 'Result'], checks.map(([n, ok]) => [n, ok ? 'ok' : '**FAILED**'])));

console.log(out.join('\n'));
if (checks.some(([, ok]) => !ok)) process.exit(1);
