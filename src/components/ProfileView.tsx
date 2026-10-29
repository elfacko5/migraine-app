import { useCallback, useEffect, useRef, useState } from 'react';
import type { FontChoice, TextScale, Theme } from '../hooks/useSettings';
import type { useAuth } from '../hooks/useAuth';
import type { SyncStatus } from '../types';
import { formatSince, formatDatetime, formatTime } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';
import { exportData, readBackupFile, applyBackup, type ParsedBackup } from '../utils/backup';
import { ConfirmDialog } from './ConfirmDialog';
import { ProfileSubPage } from './ProfileSubPage';
import { Chevron, OptionTile, SettingsGroup as Group, SwitchRow } from './settingsUi';
import { pendingReminders, notificationPermission, type PendingReminder } from '../utils/notifications';
import { TabletIcon, EyeIcon, CloudIcon, DataIcon, ChecklistIcon, BellIcon } from './drawnIcons';
import { NotificationSettings } from './NotificationSettings';
import type { NotificationConfig } from '../types';

const SCALES: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const SCALE_LABELS: Record<TextScale, string> = { xs: 'XS', sm: 'SM', md: 'MD', lg: 'LG', xl: 'XL' };
// Fixed px values used only in this picker as a visual size-comparison reference.
const SCALE_PX: Record<TextScale, number> = { xs: 13, sm: 14, md: 16, lg: 19, xl: 22 };

export type ProfileSection = 'medications' | 'hit6' | 'display' | 'reminders' | 'account' | 'data';

interface MenuProps {
  onOpen: (section: ProfileSection) => void;
  accountEnabled: boolean;
  /** Shows a quiet marker on the Headache impact row when it's worth
   *  answering again. This is the *only* place HIT-6 asks for attention —
   *  deliberately not a card on Today and not a notification. */
  hit6Due?: boolean;
}

type MenuItem = { id: ProfileSection; Icon: (p: { className?: string }) => React.ReactElement; label: string };

// Drawn marks rather than emoji, for the reason the attack-mode pill gave up
// its own: an emoji is full-colour and can't inherit `currentColor`, so four
// of them made a settings list the most saturated thing on a screen the
// palette works to keep quiet. These take the row's own colour and size.
//
// **Two groups, in the v3 grouped-list look** (2026-10-26): what you keep in
// the app (medications, the impact questionnaire), then how the app behaves
// (display, account, data). The v3 prototype's own rows — a doctor report, a
// states preview, "restart prototype" — are not here: the last two are
// prototype tools, and the report is a feature of its own.
const MENU_GROUPS: MenuItem[][] = [
  [
    { id: 'medications', Icon: TabletIcon, label: 'My medications' },
    { id: 'hit6', Icon: ChecklistIcon, label: 'Headache impact' },
  ],
  [
    { id: 'display', Icon: EyeIcon, label: 'Display & attack mode' },
    { id: 'reminders', Icon: BellIcon, label: 'Reminders' },
    { id: 'account', Icon: CloudIcon, label: 'Account & sync' },
    { id: 'data', Icon: DataIcon, label: 'Data' },
  ],
];

// Every group is its own sub-page. An earlier version kept these flat and
// gave only medications a row, which left one row sitting above three loose
// sections and read as an accident rather than a choice — the page needs to
// be one thing or the other.
export function ProfileView({ onOpen, accountEnabled, hit6Due = false }: MenuProps) {
  return (
    <div className="space-y-4">
      {MENU_GROUPS.map((group, gi) => (
        <Group key={gi}>
          {group.filter((m) => m.id !== 'account' || accountEnabled).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-bg-raised"
            >
              <item.Icon className="h-5 w-5 shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 text-sm text-text-primary">{item.label}</span>
              {/* Text, not a coloured dot: a dot on a settings row reads as an
                  alert, and this is a suggestion about a questionnaire. */}
              {item.id === 'hit6' && hit6Due && (
                <span className="shrink-0 text-xs text-text-secondary">Due</span>
              )}
              <Chevron />
            </button>
          ))}
        </Group>
      ))}
    </div>
  );
}

// Each tile previews the theme it selects, so it can't take its colours from
// the tokens — those resolve to whichever theme is showing *now*. These are
// the two palettes' own page and text values (docs/palette.md) and have to
// change with them.
const THEME_SWATCH: Record<Theme, React.CSSProperties> = {
  light: { background: '#f5f2ec', color: '#3a3733' },
  dark: { background: '#1b1a18', color: '#cdc7bb' },
};

interface DisplayProps {
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  brightness: number;
  onBrightness: (v: number) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  attackMode: boolean;
  onAttackMode: (on: boolean) => void;
  font: FontChoice;
  onFont: (f: FontChoice) => void;
  attackModeAuto: boolean;
  onAttackModeAuto: (on: boolean) => void;
  systemText: boolean;
  onSystemText: (on: boolean) => void;
  onClose: () => void;
}

// "Display & attack mode", the v3 page (2026-10-26) — it was "Accessibility".
// Theme and font are radio tiles you can see the result in; the attack mode
// controls and the text-size source are one group of switches; the five-step
// text size and the brightness overlay keep their own sections below.
export function DisplayPanel({
  textScale, onTextScale, brightness, onBrightness, theme, onTheme, attackMode, onAttackMode,
  font, onFont, attackModeAuto, onAttackModeAuto, systemText, onSystemText, onClose,
}: DisplayProps) {
  return (
    <ProfileSubPage title="Display & attack mode" onClose={onClose}>
      <div className="space-y-8">

      {/* Manual only, no prefers-color-scheme detection (2026-09-25, Sunny's
          call): an explicit choice, not one the OS makes. Attack mode still
          overrides whichever is picked here while it's on. */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Theme</p>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
          <OptionTile selected={theme === 'light'} onSelect={() => onTheme('light')} style={THEME_SWATCH.light}>Light</OptionTile>
          <OptionTile selected={theme === 'dark'} onSelect={() => onTheme('dark')} style={THEME_SWATCH.dark}>Dark</OptionTile>
        </div>
      </div>

      {/* Each tile is set in the face it selects, which is the whole preview.
          Lexend stays the default; Atkinson is the dossier's opt-in for
          maximum character distinction. */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Font</p>
        <div role="radiogroup" aria-label="Font" className="grid grid-cols-2 gap-3">
          <OptionTile
            selected={font === 'lexend'}
            onSelect={() => onFont('lexend')}
            className={`text-text-primary ${font === 'lexend' ? 'bg-accent/20' : 'bg-bg-raised'}`}
            style={{ fontFamily: "'Lexend', sans-serif" }}
          >
            <span aria-hidden="true" className="text-[1.875rem] leading-none">Aa</span>
            Lexend
          </OptionTile>
          <OptionTile
            selected={font === 'atkinson'}
            onSelect={() => onFont('atkinson')}
            className={`text-text-primary ${font === 'atkinson' ? 'bg-accent/20' : 'bg-bg-raised'}`}
            style={{ fontFamily: "'Atkinson Hyperlegible Next', sans-serif" }}
          >
            <span aria-hidden="true" className="text-[1.875rem] leading-none">Aa</span>
            Atkinson
          </OptionTile>
        </div>
      </div>

      {/* Attack mode — also one tap from the hero on Today and the floating
          pill on the other tabs; it lives here too so it's discoverable when
          nothing hurts yet. */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Attack mode</p>
        <Group raised>
          <SwitchRow label="Attack mode" on={attackMode} onChange={onAttackMode} />
          <SwitchRow
            label="Attack mode when I start an attack"
            hint="Turns it on as soon as you log an attack that's still going."
            on={attackModeAuto}
            onChange={onAttackModeAuto}
          />
        </Group>
        <p className="text-xs text-text-secondary">
          Dims the screen, warms and lowers the contrast, enlarges body text and stops all animation.
          Everything you logged stays exactly as it is.
        </p>
      </div>

      {/* Accessibility — text size and brightness were two sibling sections;
          they're one group now, since both answer "make this easier to look
          at" and neither means much on its own. */}

      <div className="space-y-4">
        {/* "Default text size" (2026-09-23, Sunny's call) — it was "Text
            size", which read as though it set the size everywhere, when what
            it actually sets is the *floor* attack mode still enlarges from.
            "Default" is the accurate word — see attack mode's own 20px body
            floor in CLAUDE.md, which this picker doesn't override. */}
        <p className="text-sm font-medium text-text-primary">Default text size</p>
        <Group raised>
          <SwitchRow
            label="Use iPhone text size"
            hint="Follows the size set in your iPhone's settings, from XS to XL."
            on={systemText}
            onChange={onSystemText}
          />
        </Group>
        <div className="space-y-4 rounded-group bg-bg-surface py-4">
          {/* Moved above the picker (2026-09-23, Sunny's call) — it used to
              sit under the preview card, after the thing it explains had
              already been used. One line, so unlike the long Insights
              captions this doesn't cost the fold; it just has to be read
              before the control, the same reasoning `InsightSection`'s note
              originally shipped with. */}
          <p className="text-xs text-text-secondary">
            Changes apply instantly across the app, and every screen reflows rather than clipping — XL is 50% larger than the default.
          </p>

          {/* Five-segment picker — set aside while the iPhone's size is in
              charge, rather than left looking live and doing nothing. The
              choice is kept, so turning the switch off restores it. */}
          {systemText ? (
            <p className="text-xs text-text-secondary">Following your iPhone's text size.</p>
          ) : (
          <div className="flex rounded-control overflow-hidden border border-border-control">
            {SCALES.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => onTextScale(s)}
                aria-pressed={textScale === s}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1.5 transition-colors ${
                  textScale === s
                    ? 'bg-accent/20 text-accent-light'
                    : 'bg-bg-raised text-text-secondary hover:bg-bg-border'
                } ${i > 0 ? 'border-l border-bg-border' : ''}`}
              >
                {/* A shown at the absolute size that scale produces — intentional px exception */}
                <span aria-hidden="true" style={{ fontSize: `${SCALE_PX[s]}px`, lineHeight: 1 }}>A</span>
                <span style={{ fontSize: '0.625rem', letterSpacing: '0.05em' }} className="font-medium uppercase">
                  {SCALE_LABELS[s]}
                </span>
              </button>
            ))}
          </div>
          )}

          {/* Live preview card — inherits root font size so it updates instantly */}
          <div className="rounded-inset border border-bg-border/60 bg-bg-raised/40 p-card">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary">Mon, Jun 24</span>
                  <span className="text-xs text-text-secondary">9:15 AM</span>
                </div>
                <p className="text-xs text-text-secondary">2h 30m · 3 readings</p>
                <p className="text-xs text-text-secondary">Right temple, Forehead</p>
                {/* Mirrors AttackCard by hand, so it has to track it: the chips
                    are symptoms, not triggers, and the line above says
                    "readings". A preview that shows a card the app no longer
                    renders is worse than no preview — it's the one place a user
                    is invited to study the layout closely. */}
                <p className="text-xs text-text-secondary">
                  Impact: <span className="text-text-primary">a lot</span>
                </p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <span className="text-xs bg-bg-border/60 text-text-secondary rounded-full px-2 py-0.5">Nausea</span>
                  <span className="text-xs bg-bg-border/60 text-text-secondary rounded-full px-2 py-0.5">Light sensitivity</span>
                </div>
              </div>
              <div className="shrink-0">
                <span className="rounded-lg border border-severity-mid/30 bg-severity-mid/20 px-2 py-1 text-lg font-bold tabular-nums text-severity-mid">
                  7
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium text-text-primary">Screen brightness</p>

        <div className="space-y-3 rounded-group bg-bg-surface py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-primary">Overlay</span>
            <span className="text-sm font-medium text-text-secondary tabular-nums">
              {Math.round(brightness * 100)}%
            </span>
          </div>
          <input
            type="range"
            // A slider with no name reads as "slider, 20%" — the percentage
            // without the thing it is a percentage of.
            aria-label="Screen dimming"
            min={0}
            max={80}
            step={5}
            value={Math.round(brightness * 100)}
            onChange={(e) => onBrightness(Number(e.target.value) / 100)}
            className="w-full"
          />
          {/* **A live swatch, not just the slider's own %.** (2026-09-23,
              Sunny's call — she saw no immediate feedback while dragging.)
              The real dim lives on `BrightnessOverlay`, `absolute` on the app
              root at z-35, which this sub-page's own `Sheet` paints straight
              over — so the actual effect is invisible from inside the very
              panel that controls it. Rather than touch that layering (the
              viewport architecture's z-order is deliberately fragile — see
              docs/viewport-architecture.md), this mirrors its exact recipe,
              `rgba(20,20,15,brightness)`, on a small swatch that lives inside
              the panel and updates on every drag. */}
          <div className="relative overflow-hidden rounded-inset border border-bg-border/60 bg-bg-raised/40 p-card">
            <p className="text-sm font-medium text-text-primary">Preview</p>
            <p className="text-xs text-text-secondary">How the dim looks during an attack.</p>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: `rgba(20,20,15,${brightness})` }}
            />
          </div>
          <p className="text-xs text-text-secondary">
            Dims the screen during attacks without changing your phone's system brightness
          </p>
        </div>
      </div>
      </div>
    </ProfileSubPage>
  );
}

interface AccountProps {
  auth: ReturnType<typeof useAuth>;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  onClose: () => void;
}

export function AccountPanel({ auth, syncStatus, lastSyncedAt, onClose }: AccountProps) {
  // Keeps the relative "synced Xm ago" string fresh — on a timer while this
  // is open, and on return to the foreground, when the timer has been asleep.
  useNowTick(30_000);
  return (
    <ProfileSubPage title="Account & sync" onClose={onClose}>
      {auth.enabled && (
          <div className="rounded-inset border border-bg-border bg-bg-raised/40 p-card space-y-3">
            {auth.session ? (
              <>
                <p className="text-sm text-text-primary">
                  Signed in as <span className="font-medium">{auth.user?.email}</span>
                </p>
                <p className="text-xs text-text-secondary">Your attacks and lists sync automatically across devices.</p>
                <SyncIndicator status={syncStatus} lastSyncedAt={lastSyncedAt} />
                <button
                  type="button"
                  onClick={() => auth.signOut()}
                  className="btn-secondary w-full rounded-control-sm py-2.5 text-sm font-medium transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <SignInForm auth={auth} />
            )}
          </div>
      )}
    </ProfileSubPage>
  );
}

// **What the OS is actually holding.** Reminder failures here have been
// invisible three times running — a missing bundled sound, a stale web
// bundle, and a schedule nobody could confirm was ever made all present the
// same way: nothing arrives. The app could say what it intended and never
// what iOS had queued, so every diagnosis began by guessing. This reads it
// back. Native only; on the web the timers live in the service worker, which
// offers no equivalent.
function ReminderDiagnostics() {
  const [perm, setPerm] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReminder[] | null | undefined>(undefined);
  // **A read that changes nothing still has to look like it happened.** The
  // control was a text link with only a `hover:` style, which on a touch
  // screen is no feedback at all — and when the queue is unchanged the list
  // doesn't move either, so a working refresh and a dead button were
  // indistinguishable. The timestamp always changes; the button now has a
  // pressed state.
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setPerm(await notificationPermission());
      setPending(await pendingReminders());
      setCheckedAt(new Date().toISOString());
    } finally {
      setBusy(false);
    }
  }, []);

  // Reads the OS's own state on mount — a subscription to an external system,
  // not state derived from props.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  // And again on every return to the app, because the interesting moment is
  // exactly when someone comes back from answering a notification.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  return (
    <section className="space-y-2 border-t border-bg-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">Reminders</p>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="btn-secondary min-h-0 rounded-control-sm px-3 py-1.5 text-xs font-medium transition-colors active:opacity-60 disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      <p className="text-xs text-text-secondary">
        Permission: <span className="text-text-primary">{perm ?? '…'}</span>
        {checkedAt && <> · checked {formatTime(checkedAt)}</>}
      </p>
      {pending === null ? (
        <p className="text-xs text-text-secondary">
          Scheduled reminders can only be read on the installed app, not in a browser.
        </p>
      ) : pending === undefined ? (
        <p className="text-xs text-text-secondary">Checking…</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-text-secondary">Nothing scheduled.</p>
      ) : (
        <ul className="space-y-1">
          {pending.map((n) => (
            <li key={n.id} className="text-xs text-text-primary">
              {n.at ? formatDatetime(n.at) : 'no time reported'}{' '}
              <span className="text-text-secondary">· id {n.id}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Settings → Reminders (2026-10-28). The check-in reminder default, moved here
 * from the last step of the logging wizard — the same `NotificationSettings`
 * control writing the same `hd_notification_default`, so this is a relocation
 * and not new state. Every new attack takes whatever this is when it is
 * logged; there is no per-attack override any more (Sunny never used one).
 */
export function RemindersPanel({ value, onChange, onClose }: {
  value: NotificationConfig;
  onChange: (next: NotificationConfig) => void;
  onClose: () => void;
}) {
  return (
    <ProfileSubPage title="Reminders" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          While an attack is ongoing, a reminder asks how it is. This applies to each attack you log from now on.
        </p>
        <NotificationSettings value={value} onChange={onChange} />
      </div>
    </ProfileSubPage>
  );
}

export function DataPanel({ auth, onClose }: { auth: ReturnType<typeof useAuth>; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setImportErr(null);
    const res = await readBackupFile(file);
    if (res.ok) setPending(res.backup);
    else setImportErr(res.error);
  }

  return (
    <ProfileSubPage title="Data" onClose={onClose}>

        <div className="rounded-inset border border-bg-border bg-bg-raised/40 p-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={exportData}
              className="btn-secondary rounded-control-sm py-2.5 text-sm font-medium transition-colors"
            >
              Export backup
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary rounded-control-sm py-2.5 text-sm font-medium transition-colors"
            >
              Import backup
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            aria-label="Backup file to import"
            accept="application/json,.json"
            className="hidden"
            onChange={onFile}
          />
          <p className="text-xs text-text-secondary">
            Save your attacks, triggers and settings to a file — or restore them on another device.
            {' '}{auth.session
              ? "You're signed in, so this data also syncs automatically."
              : 'Everything stays on this device; nothing is uploaded unless you sign in above.'}
          </p>
          {importErr && <p className="text-xs text-severity-high">{importErr}</p>}
        </div>

        <ReminderDiagnostics />

      <ConfirmDialog
        open={!!pending}
        danger
        title="Import this backup?"
        message={
          pending
            ? `This replaces the data on this device with the backup (${pending.attacks} attack${pending.attacks === 1 ? '' : 's'}). Export a backup first if you want to keep what's here.`
            : ''
        }
        confirmLabel="Import & reload"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            applyBackup(pending.data);
            window.location.reload();
          }
        }}
      />
    </ProfileSubPage>
  );
}

function SyncIndicator({ status, lastSyncedAt }: { status: SyncStatus; lastSyncedAt: string | null }) {
  if (status === 'error') {
    return (
      // Amber, not the alarm colour, and it says what is actually true: the
      // writes are already safe on this device and syncing retries itself.
      // §9.3 — calm and never alarmist — and §9.4's error guidance, which is
      // to say what happened and what happens next without blame.
      <p className="flex items-center gap-1.5 text-xs text-severity-mid">
        <span className="h-1.5 w-1.5 rounded-full bg-severity-mid shrink-0" />
        Couldn't sync just now — saved on this device, still trying
      </p>
    );
  }
  if (status === 'syncing') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-light shrink-0 animate-pulse" />
        Syncing…
      </p>
    );
  }
  if (status === 'synced' && lastSyncedAt) {
    const since = formatSince(lastSyncedAt);
    return (
      <p className="flex items-center gap-1.5 text-xs text-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-severity-low shrink-0" />
        Synced {since === 'just now' ? since : `${since} ago`}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-text-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-text-secondary/50 shrink-0" />
      Waiting to sync…
    </p>
  );
}

function SignInForm({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      await auth.signInWithEmail(email);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      await auth.verifyEmailCode(email, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  }

  if (status === 'sent') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-primary">Check your email for a sign-in link.</p>
        {/* Tapping the emailed link always opens Safari on iOS, never a
            standalone home-screen app — entering the 6-digit code from the
            same email works from inside the installed app instead. */}
        <form onSubmit={verifyCode} className="space-y-2">
          <p className="text-xs text-text-secondary">
            On the home-screen app? Tapping the link opens Safari instead — enter the 6-digit code from the email here.
          </p>
          <input
            type="text"
            inputMode="numeric"
            // Named, and marked up as a one-time code so both password
            // managers and iOS's own SMS/email autofill offer to fill it.
            aria-label="6-digit sign-in code"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-field bg-bg-surface border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-subtle"
          />
          <button
            type="submit"
            disabled={verifying}
            className="btn-secondary w-full rounded-control-sm py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {verifying ? 'Verifying…' : 'Verify code'}
          </button>
        </form>
        {error && <p className="text-xs text-severity-high">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="space-y-3">
      <p className="text-xs text-text-secondary">
        Sign in to sync your attacks across devices. No password — we'll email you a link.
      </p>
      <input
        type="email"
        aria-label="Email address"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-field bg-bg-surface border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-subtle"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="btn-primary w-full rounded-control-sm py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
      {error && <p className="text-xs text-severity-high">{error}</p>}
    </form>
  );
}
