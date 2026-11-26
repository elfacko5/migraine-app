// Fictional diary for portfolio screenshots. Every timestamp is relative to
// "now", so the attacks always fall inside the 30-day / 3-month periods
// whenever this runs. None of it is real data.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A local time `daysAgo` days back, at hh:mm. */
function at(now, daysAgo, hh, mm = 0) {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

const iso = (ms) => new Date(ms).toISOString();
const notif = { enabled: true, mode: 'adaptive', fixedIntervalMinutes: 60 };

function snap(ms, areas, extra = {}) {
  return {
    time: iso(ms),
    areas,
    symptoms: extra.symptoms ?? [],
    reliefs: extra.reliefs ?? [],
    medication: extra.med ?? null,
    note: null,
    source: extra.source ?? 'manual',
  };
}

const SUMA = { name: 'Sumatriptan', dose: '1 tablet · 50mg', amount: 1, medId: 'med-suma' };
const PARA = { name: 'Paracetamol', dose: '2 tablets · 500mg', amount: 2, medId: 'med-para' };
const IBU = { name: 'Ibuprofen', dose: '1 tablet · 400mg', amount: 1, medId: 'med-ibu' };

/**
 * One ordinary attack: a start, a dose, a reading ~2h after the dose, and an
 * end. `helped` decides whether the 2h reading drops.
 */
function ordinary(now, id, daysAgo, startH, { side = 'left', peak = 6, med = SUMA, helped = true, hours = 6, symptoms = ['Nausea', 'Light sensitivity'], triggers = [], quality = ['Throbbing'], impact = 1, woke = false } = {}) {
  const t0 = at(now, daysAgo, startH);
  const s = side === 'left' ? 'left' : 'right';
  const a1 = { [`Temple ${s}`]: peak - 1, [`Eye ${s}`]: peak - 2 };
  const a2 = { [`Temple ${s}`]: peak, [`Eye ${s}`]: peak - 1, [`Forehead ${s}`]: peak - 2 };
  const after = helped ? Math.max(1, Math.round(peak / 2) - 1) : peak;
  const snaps = [
    snap(t0, a1, { symptoms }),
    snap(t0 + 0.75 * HOUR, a2, { med, reliefs: ['Dark room'] }),
    snap(t0 + 2.75 * HOUR, { [`Temple ${s}`]: after, [`Eye ${s}`]: Math.max(1, after - 1) }, { source: 'notification_yes' }),
  ];
  if (!helped) snaps.push(snap(t0 + 4 * HOUR, { [`Temple ${s}`]: Math.max(1, peak - 3) }, { source: 'notification_yes' }));
  return {
    id: id ?? t0,
    snapshots: snaps,
    end: iso(t0 + hours * HOUR),
    triggers,
    notificationConfig: notif,
    updatedAt: iso(now),
    wokeWithMigraine: woke || undefined,
    impact,
    painQuality: quality,
  };
}

/** The attack the case study's plateau chart is about: the first dose holds
 *  the pain flat for hours ("No change" readings), only the second breaks it. */
function plateau(now) {
  const t0 = at(now, 4, 9, 10);
  const snaps = [
    snap(t0, { 'Eye left': 5, 'Temple left': 4 }, { symptoms: ['Light sensitivity'] }),
    snap(t0 + 0.6 * HOUR, { 'Eye left': 7, 'Temple left': 6, 'Forehead left': 5 }, { med: PARA, symptoms: ['Nausea'], reliefs: ['Dark room'] }),
    snap(t0 + 2.6 * HOUR, { 'Eye left': 7, 'Temple left': 7, 'Forehead left': 5 }, { source: 'notification_no_change' }),
    snap(t0 + 4.6 * HOUR, { 'Eye left': 7, 'Temple left': 7, 'Forehead left': 5 }, { source: 'notification_no_change' }),
    snap(t0 + 5.1 * HOUR, { 'Eye left': 8, 'Temple left': 9, 'Forehead left': 6, 'Temple right': 4 }, { med: SUMA, symptoms: ['Sound sensitivity'] }),
    snap(t0 + 7.1 * HOUR, { 'Temple left': 4, 'Eye left': 3 }, { source: 'notification_yes', reliefs: ['Sleep / rest'] }),
    snap(t0 + 8.4 * HOUR, { 'Temple left': 2 }, { source: 'notification_yes' }),
  ];
  return {
    id: t0,
    snapshots: snaps,
    end: iso(t0 + 9.2 * HOUR),
    triggers: ['Poor sleep', 'Stress'],
    notificationConfig: notif,
    updatedAt: iso(now),
    impact: 2,
    painQuality: ['Throbbing', 'Pressing'],
  };
}

/** Under five minutes and not yet confirmed: raises the Logs banner and the
 *  Detail card. */
function tooShort(now) {
  const t0 = at(now, 9, 16, 20);
  return {
    id: t0,
    snapshots: [snap(t0, { 'Temple right': 3 })],
    end: iso(t0 + 3 * 60 * 1000),
    triggers: [],
    notificationConfig: notif,
    updatedAt: iso(now),
  };
}

/** Gone when you woke up: no end time is invented. */
function endedInSleep(now) {
  const t0 = at(now, 13, 22, 40);
  return {
    id: t0,
    snapshots: [
      snap(t0, { 'Occiput right': 5, 'Nape right': 4 }, { symptoms: ['Neck stiffness'] }),
      snap(t0 + 0.5 * HOUR, { 'Occiput right': 6, 'Nape right': 5 }, { med: IBU }),
    ],
    end: iso(t0 + 1 * HOUR),
    endUnknown: true,
    triggers: [],
    notificationConfig: notif,
    updatedAt: iso(now),
    painQuality: ['Pressing'],
  };
}

/** Ongoing: started ~2h ago, one dose taken, easing. */
function ongoing(now) {
  const t0 = now - 2.3 * HOUR;
  return {
    id: Math.round(t0),
    snapshots: [
      snap(t0, { 'Temple left': 6, 'Eye left': 5 }, { symptoms: ['Light sensitivity', 'Nausea'] }),
      snap(t0 + 0.4 * HOUR, { 'Temple left': 7, 'Eye left': 6, 'Forehead left': 4 }, { med: SUMA, reliefs: ['Dark room'] }),
      snap(t0 + 1.9 * HOUR, { 'Temple left': 5, 'Eye left': 4 }, { source: 'notification_yes' }),
    ],
    end: null,
    triggers: [],
    notificationConfig: notif,
    updatedAt: iso(now),
  };
}

function history(now) {
  return [
    ordinary(now, null, 6, 15, { side: 'right', peak: 5, med: IBU, hours: 5, quality: ['Pressing'], triggers: ['Screen time'] }),
    ordinary(now, null, 18, 14, { peak: 7, triggers: ['Poor sleep'] }),
    ordinary(now, null, 24, 7, { side: 'right', peak: 5, med: PARA, helped: false, hours: 9, woke: true, quality: ['Pressing'], impact: 1 }),
    ordinary(now, null, 29, 19, { peak: 8, hours: 11, symptoms: ['Nausea', 'Vomiting', 'Light sensitivity'], impact: 3, triggers: ['Menstruation'] }),
    ordinary(now, null, 38, 11, { peak: 6, triggers: ['Skipped meal'] }),
    ordinary(now, null, 45, 16, { side: 'right', peak: 4, med: IBU, hours: 4, quality: ['Dull'], impact: 0 }),
    ordinary(now, null, 52, 8, { peak: 7, hours: 14, woke: true, impact: 2 }),
    ordinary(now, null, 59, 20, { peak: 8, symptoms: ['Nausea', 'Sound sensitivity'], triggers: ['Alcohol'] }),
    ordinary(now, null, 66, 13, { side: 'right', peak: 6, med: PARA, helped: false, hours: 8 }),
    ordinary(now, null, 71, 9, { peak: 7, impact: 2, triggers: ['Stress'] }),
    ordinary(now, null, 79, 17, { peak: 5, med: IBU, hours: 5, quality: ['Pressing'] }),
    ordinary(now, null, 86, 10, { peak: 9, hours: 20, symptoms: ['Nausea', 'Vomiting', 'Light sensitivity', 'Sound sensitivity'], impact: 3 }),
  ];
}

export function medications(now) {
  const created = iso(now - 120 * DAY);
  return {
    items: [
      { id: 'med-suma', name: 'Sumatriptan', dose: '1 tablet · 50mg', strength: '50mg', quantity: 1, kind: 'acute', class: 'triptan', form: 'Tablet', unitLabel: 'tablet', createdAt: created },
      { id: 'med-para', name: 'Paracetamol', dose: '2 tablets · 500mg', strength: '500mg', quantity: 2, kind: 'acute', class: 'simple', form: 'Tablet', unitLabel: 'tablet', createdAt: created },
      { id: 'med-ibu', name: 'Ibuprofen', dose: '1 tablet · 400mg', strength: '400mg', quantity: 1, kind: 'acute', class: 'simple', form: 'Tablet', unitLabel: 'tablet', createdAt: created },
    ],
    guides: {},
    deleted: [],
    updatedAt: iso(now - 120 * DAY),
  };
}

/** `withOngoing` false gives the attack-free Today. */
export function attacks(now, { withOngoing = true } = {}) {
  const list = [plateau(now), tooShort(now), endedInSleep(now), ...history(now)];
  return withOngoing ? [ongoing(now), ...list] : list;
}

export { plateau };
