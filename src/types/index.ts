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
  //
  // `medId` is the library entry's id, written on **new doses only** (0a of the
  // medication flows). It exists because two library entries can share a name
  // ("Add another version"), and a dose that carries only a name cannot say
  // which one it was. Nothing is back-filled: an older dose has no `medId` and
  // is matched by name through `resolveDose` (src/utils/medResolve.ts).
  medication: { name: string; dose: string; amount?: number; medId?: string } | null;
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
  // `triggers` also carries the reserved `NOTHING_UNUSUAL` sentinel (below)
  // when "the two days before" was explicitly answered "nothing unusual" —
  // every reader that tallies or displays triggers must filter it out first.
  triggers: string[];
  notificationConfig: NotificationConfig;
  updatedAt?: string;    // ISO timestamp of the last local write; used to resolve sync conflicts
  wokeWithMigraine?: boolean; // set at logging time — the attack was already present on waking, not noticed while awake
  // How much the attack stopped you doing things, asked once when it ends.
  // 0 none · 1 some · 2 a lot · 3 couldn't function. Undefined means it was
  // never answered — never assume 0, which would read as "no impact".
  impact?: 0 | 1 | 2 | 3;
  // Pick-any pain quality (ICHD-3 criterion B), from PAIN_QUALITY_OPTIONS.
  // Stable metadata — editable after the fact via updateAttackDetails, same
  // as triggers/wokeWithMigraine.
  painQuality?: string[];
  // True once the end time is known to be approximate — "gone when you woke
  // up," no time added. `end` still holds a real timestamp so the attack
  // reads as ended everywhere (FabMenu, Today, Detail footer); this flag is
  // what excludes it from duration/avgAttackLength, the same way an ongoing
  // attack is excluded. A reader must check this before treating `end` as a
  // trustworthy duration endpoint — never fabricate confidence in a guess.
  endUnknown?: boolean;
  // Set after Logs/Detail flagged the attack as under five minutes
  // (under 5 min) and the user confirmed it did happen. Metadata-only, like
  // impact/triggers — never touches snapshots.
  confirmedReal?: boolean;
}

/** Pick-any pain-quality chips (ICHD-3 criterion B gap). Stored verbatim in
 *  `Attack.painQuality`, so this list is the one lookup table for it. */
export const PAIN_QUALITY_OPTIONS = ['Throbbing', 'Pressing', 'Stabbing', 'Dull'];

/** Reserved value inside `Attack.triggers` meaning "the two days before was
 *  explicitly answered — nothing unusual", distinct from an unanswered empty
 *  array. No migration: triggers is per-attack metadata on one jsonb row, not
 *  a merged list, so a sentinel string costs nothing extra to sync. Every
 *  tally/display over `triggers` must filter this out first. */
export const NOTHING_UNUSUAL = '__nothing_unusual__';

// The user's own medication library (Profile → My medications). Acute meds
// are taken to treat an attack and feed the logging wizard's chips;
// preventives are taken daily — including on attack days — and deliberately
// stay out of the wizard, so a daily dose is never recorded as a treatment
// for the attack it happens to coincide with.
// The class an acute drug belongs to, which is the only thing that decides
// which ICHD-3 medication-overuse reference point applies to it. Both numbers
// have always existed in stats.ts, but nothing knew a drug's class, so 10 was
// applied to everything and simple analgesics were flagged five days early.
// 'gepant' (v3, 2026-10-26) has no medication-overuse threshold: it is counted
// in no class bar and drawn no overuse warning unless the user entered their
// own monthly limit. 'other' predates the v3 editor, which offers "Not sure"
// (no class) instead; both are treated as untyped.
export type MedClass = 'triptan' | 'combination' | 'simple' | 'gepant' | 'other';

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

  /** The form it is taken in: one of the standard forms ('Tablet', 'Melt',
   *  'Capsule', 'Effervescent', 'Nasal spray', 'Injection', 'Suppository',
   *  'Liquid') or the medicine's own text. Absent on records that predate it;
   *  `formOf` (src/utils/medResolve.ts) derives it from `unitLabel` at read
   *  time, and it is written on the next save of that medicine. */
  form?: string;
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

/** A name that was deleted from the library (June, 2026-11-17: "Sync it"). It
 *  keeps the name out of the wizard's chips, the voice-parse list and the
 *  overuse warnings; it never removes a dose from a diary or from Insights. */
export interface DeletedMedName { name: string; deletedAt: string }

/** What a medication flow hands back: everything but the fields the hook owns. */
export type MedicationDraft = Omit<Medication, 'id' | 'createdAt'>;

/** Days a month per type, set by the user. A missing key means "use the
 *  guideline number" (pre-filled, June 2026-11-17). No gepant key: there is no
 *  guideline for one. Nothing reads this yet (0a); `guideFor` arrives in 0b. */
export type MedGuides = Partial<Record<'triptan' | 'combination' | 'simple' | 'any', number>>;

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
