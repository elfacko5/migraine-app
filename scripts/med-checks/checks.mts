// Checks for 0a of the medication flows: the merge, the sync row, the read-time
// migrations and the dose-resolution rule. No runner exists in this repo, so
// this is a plain script: `npm run med-checks` (tsx + node:assert). It touches
// no network, no localStorage and no account.
import assert from 'node:assert/strict';
import type { Attack, Medication } from '../../src/types/index.ts';
import { cleanGuides, daysTakenOf, formOf, isLogged, parseStrength, resolveDose, stampMedId, stampSnapshot } from '../../src/utils/medResolve.ts';
import { guidesForPush, medicationsUpsertRow, mergeMedicationPrefs, type StoredMedications } from '../../src/utils/medPrefsMerge.ts';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok  ${name}`); };

const med = (id: string, name: string, dose: string, extra: Partial<Medication> = {}): Medication =>
  ({ id, name, dose, kind: 'acute', createdAt: '2026-01-01T00:00:00Z', ...extra });

// ── merge ──────────────────────────────────────────────────────────────────
const A = med('a', 'Sumatriptan', '50mg');
const local = (updatedAt: string, guides = {}, items = [A]): StoredMedications => ({ items, guides, updatedAt });

t('remote newer, with guides: adopt remote guides', () => {
  const m = mergeMedicationPrefs(local('2026-02-01T00:00:00Z', { triptan: 8 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z', medication_guides: { triptan: 12, any: 9 },
  });
  assert.equal(m.kind, 'adopt-remote');
  if (m.kind === 'adopt-remote') {
    assert.deepEqual(m.stored.guides, { triptan: 12, any: 9 });
    assert.equal(m.stored.updatedAt, '2026-03-01T00:00:00Z');
  }
});
t('remote newer, written by an older client (no guides): keep local guides', () => {
  const m = mergeMedicationPrefs(local('2026-02-01T00:00:00Z', { triptan: 8 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z',
  });
  assert.equal(m.kind, 'adopt-remote');
  if (m.kind === 'adopt-remote') assert.deepEqual(m.stored.guides, { triptan: 8 });
});
t('remote newer, guides column is junk: cleaned away, local kept', () => {
  const m = mergeMedicationPrefs(local('2026-02-01T00:00:00Z', { simple: 14 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z',
    medication_guides: { triptan: -1, foo: 3, any: '10', simple: 0 },
  });
  assert.equal(m.kind, 'adopt-remote');
  if (m.kind === 'adopt-remote') assert.deepEqual(m.stored.guides, { simple: 14 });
});
t('local newer: push local', () => {
  const m = mergeMedicationPrefs(local('2026-04-01T00:00:00Z'), { medications: [A], medications_updated_at: '2026-03-01T00:00:00Z' });
  assert.equal(m.kind, 'push-local');
});
t('equal stamps: push local (unchanged behaviour)', () => {
  const m = mergeMedicationPrefs(local('2026-03-01T00:00:00Z'), { medications: [A], medications_updated_at: '2026-03-01T00:00:00Z' });
  assert.equal(m.kind, 'push-local');
});
t('no remote row, local has items: push local', () => {
  assert.equal(mergeMedicationPrefs(local('2026-03-01T00:00:00Z'), null).kind, 'push-local');
});
t('no remote row, empty local: nothing', () => {
  assert.equal(mergeMedicationPrefs(local('1970-01-01T00:00:00.000Z', {}, []), null).kind, 'nothing');
});
t('remote row exists but has no medications, empty local: nothing', () => {
  assert.equal(mergeMedicationPrefs(local('1970-01-01T00:00:00.000Z', {}, []), { medications: null, medications_updated_at: null }).kind, 'nothing');
});
t('remote older: push local, remote guides never read', () => {
  const m = mergeMedicationPrefs(local('2026-04-01T00:00:00Z', { triptan: 8 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z', medication_guides: { triptan: 99 },
  });
  assert.equal(m.kind, 'push-local');
});

// ── the row that is pushed ─────────────────────────────────────────────────
t('guidesForPush: empty means omit, never {}', () => {
  assert.equal(guidesForPush({}), undefined);
  assert.deepEqual(guidesForPush({ triptan: 8 }), { triptan: 8 });
});
t('upsert row: no medication_guides column unless guides are given (safe before the alter table)', () => {
  const without = medicationsUpsertRow([A], 'T', 'u', undefined, 'N');
  assert.deepEqual(Object.keys(without).sort(), ['medications', 'medications_updated_at', 'updated_at', 'user_id']);
  const withG = medicationsUpsertRow([A], 'T', 'u', { any: 10 }, 'N');
  assert.deepEqual(withG.medication_guides, { any: 10 });
  assert.equal(withG.medications_updated_at, 'T');
});

// ── M1 / M2, read-time ─────────────────────────────────────────────────────
t('M2: a value with no guides reads as {}', () => {
  assert.deepEqual(cleanGuides(undefined), {});
  assert.deepEqual(cleanGuides(null), {});
  assert.deepEqual(cleanGuides([1, 2]), {});
  assert.deepEqual(cleanGuides({ triptan: 10, gepant: 5, simple: Infinity, any: 'x' }), { triptan: 10 });
});
t('M1: form from unit, stored form wins, nothing is written', () => {
  const old = { unitLabel: 'capsule' };
  assert.equal(formOf({}), 'Tablet');
  assert.equal(formOf({ unitLabel: 'tablet' }), 'Tablet');
  assert.equal(formOf(old), 'Capsule');
  assert.equal(formOf({ unitLabel: 'puff' }), 'Nasal spray');
  assert.equal(formOf({ unitLabel: 'spray' }), 'Nasal spray');
  assert.equal(formOf({ unitLabel: 'injection' }), 'Injection');
  assert.equal(formOf({ unitLabel: ' sachet ' }), 'sachet');
  assert.equal(formOf({ unitLabel: 'tablet', form: 'Melt' }), 'Melt');
  assert.deepEqual(old, { unitLabel: 'capsule' });
});

// ── strength ───────────────────────────────────────────────────────────────
t('parseStrength: one number and one unit only', () => {
  assert.deepEqual(parseStrength('50 mg'), { value: 50, unit: 'mg' });
  assert.deepEqual(parseStrength('50mg'), { value: 50, unit: 'mg' });
  assert.deepEqual(parseStrength('0.5 g'), { value: 0.5, unit: 'g' });
  for (const bad of ['500/50 mg', '100 mg/5 ml', '2 x 25 mg', '', '0 mg', 'mg', '50', null, undefined]) {
    assert.equal(parseStrength(bad), null, String(bad));
  }
});

// ── resolveDose: the Q4 rule ───────────────────────────────────────────────
const s50 = med('s50', 'Sumatriptan', '50 mg', { class: 'triptan' });
const s100 = med('s100', 'Sumatriptan', '100 mg', { class: 'combination' });
const twin1 = med('t1', 'Treo', '1 tablet · 500/50 mg');
const twin2 = med('t2', 'Treo', '1 tablet · 500/50 mg', { class: 'simple' });
const lib = [s50, s100, twin1, twin2, med('i', 'Ibuprofen', '400 mg')];

t('resolveDose 1: medId wins, even against the name', () => {
  assert.equal(resolveDose({ name: 'Sumatriptan', dose: '50 mg', medId: 's100' }, lib).med?.id, 's100');
});
t('resolveDose 1: a medId whose entry is gone is nothing, not a name fallback', () => {
  const r = resolveDose({ name: 'Sumatriptan', dose: '50 mg', medId: 'deleted' }, lib);
  assert.deepEqual([r.med, r.ambiguous, r.candidates.length], [null, false, 0]);
});
t('resolveDose 2: one entry of that name', () => {
  assert.equal(resolveDose({ name: ' ibuprofen ', dose: '' }, lib).med?.id, 'i');
});
t('resolveDose 3: same name, told apart by dose text', () => {
  assert.equal(resolveDose({ name: 'sumatriptan', dose: '100 mg' }, lib).med?.id, 's100');
  assert.equal(resolveDose({ name: 'Sumatriptan', dose: '50 mg' }, lib).med?.id, 's50');
});
t('resolveDose 4: same name, same dose text, different types is ambiguous and goes to nobody', () => {
  const r = resolveDose({ name: 'Treo', dose: '1 tablet · 500/50 mg' }, lib);
  assert.equal(r.med, null);
  assert.equal(r.ambiguous, true);
  assert.deepEqual(r.candidates.map((c) => c.id), ['t1', 't2']);
});
t('resolveDose 4: same name, dose text matches neither is ambiguous', () => {
  const r = resolveDose({ name: 'Sumatriptan', dose: '25 mg' }, lib);
  assert.equal(r.ambiguous, true);
});
t('resolveDose: unknown or empty name matches nothing and is not ambiguous', () => {
  for (const d of [{ name: 'Nope', dose: '' }, { name: '  ', dose: '' }, null, undefined]) {
    const r = resolveDose(d as never, lib);
    assert.deepEqual([r.med, r.ambiguous, r.candidates.length], [null, false, 0]);
  }
});

// ── stamping: an id is written only when certain ───────────────────────────
t('stampMedId: certain gets an id and keeps its other fields', () => {
  assert.deepEqual(stampMedId({ name: 'Ibuprofen', dose: '400 mg', amount: 2 }, lib), { name: 'Ibuprofen', dose: '400 mg', amount: 2, medId: 'i' });
});
t('stampMedId: ambiguous, typed-in and already-stamped come back unchanged', () => {
  const amb = { name: 'Treo', dose: '1 tablet · 500/50 mg' };
  assert.equal(stampMedId(amb, lib), amb);
  const typed = { name: 'Something else', dose: '' };
  assert.equal(stampMedId(typed, lib), typed);
  const done = { name: 'Ibuprofen', dose: '', medId: 'zzz' };
  assert.equal(stampMedId(done, lib), done);
  assert.equal(stampMedId(null, lib), null);
});
t('stampSnapshot: same object when nothing changes', () => {
  const snap = { time: 'x', medication: null };
  assert.equal(stampSnapshot(snap, lib), snap);
});

// ── in the diary ───────────────────────────────────────────────────────────
const snap = (time: string, name: string, dose: string, medId?: string) => ({
  time, areas: { 'Temple left': 5 }, symptoms: [], reliefs: [], note: null, source: 'manual' as const,
  medication: { name, dose, ...(medId ? { medId } : {}) },
});
const attack = (id: number, snaps: ReturnType<typeof snap>[]): Attack => ({
  id, snapshots: snaps, end: null, triggers: [],
  notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 },
});
const diary = [
  attack(1, [snap('2026-10-01T08:00:00', 'Sumatriptan', '50 mg', 's50'), snap('2026-10-01T20:00:00', 'Sumatriptan', '50 mg', 's50')]),
  attack(2, [snap('2026-10-03T08:00:00', 'Sumatriptan', '100 mg'), snap('2026-10-05T08:00:00', 'Sumatriptan', '50 mg')]),
  attack(3, [snap('2026-10-07T08:00:00', 'Treo', '1 tablet · 500/50 mg')]),
  attack(4, [snap('2026-10-08T08:00:00', 'a beer', '')]),
];
t('daysTakenOf: distinct days, matched doses only, ambiguous counted apart', () => {
  assert.deepEqual(daysTakenOf(s50, lib, diary), { days: 2, ambiguousDoses: 0 }); // 1 Oct (two doses), 5 Oct
  assert.deepEqual(daysTakenOf(s100, lib, diary), { days: 1, ambiguousDoses: 0 }); // 3 Oct
  assert.deepEqual(daysTakenOf(twin1, lib, diary), { days: 0, ambiguousDoses: 1 });
  assert.deepEqual(daysTakenOf(twin2, lib, diary), { days: 0, ambiguousDoses: 1 });
});
t('isLogged: conservative about ambiguous doses; retired names are not doses', () => {
  assert.equal(isLogged(s50, lib, diary), true);
  assert.equal(isLogged(twin1, lib, diary), true);   // could be this one
  assert.equal(isLogged(lib[4], lib, diary), false); // Ibuprofen never logged
  assert.equal(isLogged(med('b', 'A beer', ''), [med('b', 'A beer', '')], diary), false);
});

console.log(`\n${n} checks passed`);
