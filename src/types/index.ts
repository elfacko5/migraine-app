export interface Snapshot {
  time: string;
  areas: Record<string, number>;      // { 'Eye right': 6, 'Temple left': 3 }
  symptoms: string[];
  reliefs: string[];
  // `dose` stays free text and keeps its display role ("50mg", "2 tablets").
  // `amount` is the number of *units* taken at this intake, added alongside it
  // rather than replacing it: every historical dose still renders, and nothing
  // is back-filled, because you can't know now whether an old "1 tablet" meant
  // one unit or two. See src/utils/medGuardrails.ts for how a legacy dose is
  // read when `amount` is absent.
  medication: { name: string; dose: string; amount?: number } | null;
  note: string | null;
  source: 'manual' | 'notification_yes' | 'notification_no_change';
}

export interface NotificationConfig {
  enabled: boolean;
  mode: 'adaptive' | 'fixed';
  fixedIntervalMinutes: number;
}

export interface Attack {
  id: number;           // timestamp
  snapshots: Snapshot[];
  end: string | null;
  triggers: string[];
  notificationConfig: NotificationConfig;
  updatedAt?: string;    // ISO timestamp of the last local write; used to resolve sync conflicts
  wokeWithMigraine?: boolean; // set at logging time — the attack was already present on waking, not noticed while awake
  // How much the attack stopped you doing things, asked once when it ends.
  // 0 none · 1 some · 2 a lot · 3 couldn't function. Undefined means it was
  // never answered — never assume 0, which would read as "no impact".
  impact?: 0 | 1 | 2 | 3;
}

// The user's own medication library (Profile → My medications). Acute meds
// are taken to treat an attack and feed the logging wizard's chips;
// preventives are taken daily — including on attack days — and deliberately
// stay out of the wizard, so a daily dose is never recorded as a treatment
// for the attack it happens to coincide with.
// The class an acute drug belongs to, which is the only thing that decides
// which ICHD-3 medication-overuse reference point applies to it. Both numbers
// have always existed in stats.ts, but nothing knew a drug's class, so 10 was
// applied to everything and simple analgesics were flagged five days early.
export type MedClass = 'triptan' | 'combination' | 'simple' | 'other';

export interface Medication {
  id: string;
  name: string;
  /**
   * The display string — "50mg", "2 tablets · 50mg". **Derived** from the
   * three fields below when a medication is saved through the editor, and
   * kept as the one thing every reader uses (the wizard's chips, the library
   * rows, and the copy written into `Snapshot.medication`). It is still
   * free text on records that predate the structured fields, which is why
   * nothing may assume those exist.
   */
  dose: string;

  // ---- The prescribed single dose ---------------------------------------
  //
  // Optional in the type, required by the editor: they were added after the
  // library already held medications, so an older record has none of them and
  // still has to render. Off the prescription, or off the label when it's
  // something bought over the counter.
  /** As printed — "50mg", "500mg/65mg". */
  strength?: string;
  /** Units in one prescribed dose. */
  quantity?: number;

  kind: 'acute' | 'preventive';
  createdAt: string;

  // ---- Acute only: the prescription's own limits -------------------------
  //
  // **These come from the user, transcribed off a prescription or leaflet —
  // the app never infers one.** All optional: a medication with none set
  // behaves exactly as it did before any of this existed. The app counts
  // against them and repeats the number back; it never blocks a dose and
  // never phrases a warning as an instruction.
  class?: MedClass;
  /** Units in one intake. */
  maxPerIntake?: number;
  /** Units per *rolling* 24 hours — how a leaflet states it, and what catches
   *  the late-night-plus-early-morning run a calendar day silently allows. */
  maxPerDay?: number;
  /** Hours to leave between intakes. */
  minHoursBetween?: number;
  /** Days a month off the label — Treo prints "højst 10 dage om måneden".
   *  Beats the class-derived ICHD number when set. */
  maxDaysPerMonth?: number;

  /** What one unit is called — 'tablet' | 'spray' | 'capsule' … Defaults to
   *  'tablet' when unset. Not limited to acute: it labels the quantity of a
   *  single dose, which every medication has. */
  unitLabel?: string;

  // ---- Preventive only ---------------------------------------------------
  /** Local date (YYYY-MM-DD) the preventive was started. It's what makes the
   *  ≥50%-reduction question answerable: monthly migraine days before this
   *  date against after. Adherence — "the drug didn't work" vs "I didn't take
   *  it" — is a separate and later question, and isn't needed for this. */
  startedOn?: string;
}

export type Tab = 'log' | 'history' | 'stats' | 'profile';

// Reported by useAttacks/useUserPrefs so Settings can show a combined
// "synced just now" / "sync failed" indicator instead of failing silently.
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/**
 * One completed HIT-6. Answers are the *scored* values (6/8/10/11/13), in
 * question order, so a stored entry can be re-read without depending on the
 * option table never changing.
 */
export interface Hit6Entry {
  id: string;
  /** ISO timestamp of when it was answered. */
  takenAt: string;
  answers: number[];
  /** 36-78. Stored rather than derived so a historical entry can't be
   *  retro-scored by a later change to the instrument. */
  score: number;
}
