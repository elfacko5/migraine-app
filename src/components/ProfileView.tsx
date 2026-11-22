import { useCallback, useEffect, useRef, useState } from 'react';
import type { FontChoice, TextScale, Theme } from '../hooks/useSettings';
import type { useAuth } from '../hooks/useAuth';
import type { SyncStatus } from '../types';
import { formatSince, formatDatetime, formatTime } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';
import { exportData, readBackupFile, applyBackup, type ParsedBackup } from '../utils/backup';
import { ConfirmDialog } from './ConfirmDialog';
import { ProfileSubPage } from './ProfileSubPage';
import { Button, List, ListRow, Switch, TextField } from 'code-ds';
import { OptionTile } from './settingsUi';
import { pendingReminders, notificationPermission, type PendingReminder } from '../utils/notifications';
import { TabletIcon, EyeIcon, CloudIcon, DataIcon, ChecklistIcon, BellIcon } from './drawnIcons';
import { NotificationSettings } from './NotificationSettings';
import type { NotificationConfig } from '../types';

const SCALES: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const SCALE_LABELS: Record<TextScale, string> = { xs: 'XS', sm: 'SM', md: 'MD', lg: 'LG', xl: 'XL' };
// Fixed px values used only in this picker as a visual size-comparison reference.
const SCALE_PX: Record<TextScale, number> = { xs: 13, sm: 14, md: 16, lg: 19, xl: 22 };
const SCALE_NAME: Record<TextScale, string> = { xs: 'XS', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'XL' };

export type ProfileSection = 'medications' | 'guides' | 'hit6' | 'display' | 'reminders' | 'account' | 'data';

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
        <List key={gi}>
          {group.filter((m) => m.id !== 'account' || accountEnabled).map((item) => (
            <ListRow
              key={item.id}
              leading={<item.Icon />}
              // Text, not a coloured dot: a dot on a settings row reads as an
              // alert, and this is a suggestion about a questionnaire.
              value={item.id === 'hit6' && hit6Due ? 'Due' : undefined}
              onClick={() => onOpen(item.id)}
            >
              {item.label}
            </ListRow>
          ))}
        </List>
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

// "Display & attack mode", the v4 page — a list that drills into Font, Text
// size and "What it changes", matching docs/redesign-v4/screens/18-display.
// Brightness is gone: the redesign drops the manual dim (attack mode keeps its
// own floor via BrightnessOverlay), so `brightness`/`onBrightness` stay in the
// props the caller passes but are no longer rendered here. The auto-setting
// still only turns attack mode on, never off (A10, June 2026-11-22). Font,
// Text size and What-it-changes are nested views swapped inside this one sheet
// — the My medications → Monthly guides pattern — so their back chevron
// returns to the list rather than closing the sheet.
export function DisplayPanel({
  textScale, onTextScale, theme, onTheme, attackMode, onAttackMode,
  font, onFont, attackModeAuto, onAttackModeAuto, systemText, onSystemText, onClose,
}: DisplayProps) {
  const [view, setView] = useState<'list' | 'font' | 'textsize' | 'changes'>('list');

  if (view === 'font') return <FontPage font={font} onFont={onFont} onBack={() => setView('list')} />;
  if (view === 'textsize')
    return <TextSizePage textScale={textScale} onTextScale={onTextScale} systemText={systemText} onSystemText={onSystemText} onBack={() => setView('list')} />;
  if (view === 'changes') return <AttackChangesPage onBack={() => setView('list')} />;

  return (
    <ProfileSubPage title="Display & attack mode" onClose={onClose}>
      <div className="space-y-8">
        {/* Attack mode — also one tap from the Today hero; it lives here too so
            it's discoverable when nothing hurts yet. "What it changes" is its
            own screen now, so the long explanation leaves the list. */}
        <section className="space-y-3">
          <SectionLabel>Attack mode</SectionLabel>
          <List>
            <ListRow bare>
              <Switch checked={attackMode} onCheckedChange={onAttackMode}>Attack mode</Switch>
            </ListRow>
            <ListRow bare>
              <Switch checked={attackModeAuto} onCheckedChange={onAttackModeAuto}>
                When I log an attack
                <span className="block text-xs text-content-muted">Turns it on as soon as you log an attack that's still going.</span>
              </Switch>
            </ListRow>
            <ListRow
              onClick={() => setView('changes')}
              value={attackMode ? undefined : 'Everyday'}
              supporting={attackMode ? "Attack mode is on. You'll see these when you turn it off." : undefined}
            >
              What it changes
            </ListRow>
          </List>
        </section>

        {/* Manual theme choice, no prefers-color-scheme (2026-09-25). Each tile
            previews the theme it selects; attack mode overrides both while on. */}
        <section className="space-y-3">
          <SectionLabel>Theme</SectionLabel>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
            <OptionTile selected={theme === 'light'} onSelect={() => onTheme('light')} style={THEME_SWATCH.light}>Light</OptionTile>
            <OptionTile selected={theme === 'dark'} onSelect={() => onTheme('dark')} style={THEME_SWATCH.dark}>Dark</OptionTile>
          </div>
        </section>

        {/* Font and Text size each open their own screen, where the full
            previews have room — the list just states the current value. */}
        <List>
          <ListRow onClick={() => setView('font')} value={font === 'lexend' ? 'Lexend' : 'Atkinson'}>Font</ListRow>
          <ListRow onClick={() => setView('textsize')} value={systemText ? 'iPhone' : SCALE_NAME[textScale]}>Text size</ListRow>
        </List>
      </div>
    </ProfileSubPage>
  );
}

// A section label: 14px / 600 / letter-spaced / muted — the canonical v4
// settings label (decision 10). Display's old 16/500/primary labels convert.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold tracking-wide text-text-secondary">{children}</p>;
}

// Font screen — each option renders a sample in the face it selects, with room
// for Atkinson's "why you'd pick it" line the two-up tiles had no space for.
// A left-aligned radio card: OptionTile's ring/mark rules on a full-width row.
function FontPage({ font, onFont, onBack }: { font: FontChoice; onFont: (f: FontChoice) => void; onBack: () => void }) {
  return (
    <ProfileSubPage title="Font" onClose={onBack}>
      <div role="radiogroup" aria-label="Font" className="space-y-3">
        <FontOption name="Lexend" family="'Lexend', sans-serif" selected={font === 'lexend'} onSelect={() => onFont('lexend')} />
        <FontOption
          name="Atkinson Hyperlegible Next"
          family="'Atkinson Hyperlegible Next', sans-serif"
          selected={font === 'atkinson'}
          onSelect={() => onFont('atkinson')}
          hint="Try it if letters like I, l and 1 blur together."
        />
      </div>
    </ProfileSubPage>
  );
}

function FontOption({ name, family, selected, onSelect, hint }: {
  name: string; family: string; selected: boolean; onSelect: () => void; hint?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative block w-full rounded-card px-4 py-4 text-left ring-inset transition-colors ${
        selected ? 'bg-accent/10 ring-2 ring-accent' : 'bg-bg-raised ring-1 ring-border-control'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute right-3 top-3 h-3.5 w-3.5 rounded-full ring-inset ${selected ? 'ring-[5px] ring-accent' : 'ring-2 ring-current opacity-60'}`}
      />
      <span className={`block pr-6 text-text-primary ${selected ? 'font-semibold' : 'font-medium'}`}>{name}</span>
      <span className="mt-1.5 block text-base text-text-primary" style={{ fontFamily: family }}>
        Took 1 tablet at 09:15. Right temple.
      </span>
      {hint && <span className="mt-2 block text-xs text-text-secondary">{hint}</span>}
    </button>
  );
}

// Text size screen — the iPhone-size switch, then either the five-step picker
// or, when the phone is in charge, where to change it. Picker, labels and
// preview are unchanged from the old inline section.
function TextSizePage({ textScale, onTextScale, systemText, onSystemText, onBack }: {
  textScale: TextScale; onTextScale: (s: TextScale) => void; systemText: boolean; onSystemText: (on: boolean) => void; onBack: () => void;
}) {
  return (
    <ProfileSubPage title="Text size" onClose={onBack}>
      <div className="space-y-6">
        <List>
          <ListRow bare>
            <Switch checked={systemText} onCheckedChange={onSystemText}>
              Use iPhone text size
              <span className="block text-xs text-content-muted">Follows the size set in your iPhone's settings, from XS to XL.</span>
            </Switch>
          </ListRow>
        </List>

        {systemText ? (
          <p className="text-sm text-text-secondary">
            Lidd follows your iPhone's text size. To change it, open iPhone Settings, then Display &amp; Brightness, then Text Size.
          </p>
        ) : (
          <div className="space-y-3">
            <SectionLabel>Size</SectionLabel>
            <div className="flex overflow-hidden rounded-control border border-border-control">
              {SCALES.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onTextScale(s)}
                  aria-pressed={textScale === s}
                  className={`flex flex-1 flex-col items-center justify-center gap-1.5 py-3 transition-colors ${
                    textScale === s ? 'bg-accent/20 text-accent-light' : 'bg-bg-raised text-text-secondary hover:bg-bg-border'
                  } ${i > 0 ? 'border-l border-bg-border' : ''}`}
                >
                  {/* A at the absolute size that scale produces — intentional px exception */}
                  <span aria-hidden="true" style={{ fontSize: `${SCALE_PX[s]}px`, lineHeight: 1 }}>A</span>
                  <span style={{ fontSize: '0.625rem', letterSpacing: '0.05em' }} className="font-medium uppercase">{SCALE_LABELS[s]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              {textScale === 'md' ? 'Medium is the default. ' : ''}Every screen grows with it, reflowing rather than clipping — XL is 50% larger. Attack mode makes small text bigger.
            </p>
          </div>
        )}

        <DisplayPreviewCard />
      </div>
    </ProfileSubPage>
  );
}

// What attack mode changes — the explanation that used to sit under the toggle,
// now its own screen with the sample log it describes.
function AttackChangesPage({ onBack }: { onBack: () => void }) {
  return (
    <ProfileSubPage title="What it changes" onClose={onBack}>
      <div className="space-y-6">
        <section className="space-y-2">
          <SectionLabel>A log in attack mode</SectionLabel>
          <DisplayPreviewCard />
        </section>
        <List>
          <ListRow supporting="At least 35% darker">Dims the screen</ListRow>
          <ListRow>Warmer colours, softer contrast</ListRow>
          <ListRow>Bigger text, if yours is set small</ListRow>
          <ListRow>Nothing moves — animation stops</ListRow>
          <ListRow>Your logs stay exactly as they are</ListRow>
        </List>
      </div>
    </ProfileSubPage>
  );
}

// The sample attack card shown on the Text size and What-it-changes screens.
// Mirrors AttackCard by hand (the chips are symptoms, the line says
// "readings"), so a preview never shows a card the app no longer renders.
function DisplayPreviewCard() {
  return (
    <div className="rounded-inset border border-bg-border/60 bg-bg-raised/40 p-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text-primary">Mon, Jun 24</span>
            <span className="text-xs text-text-secondary">9:15 AM</span>
          </div>
          <p className="text-xs text-text-secondary">2h 30m · 3 readings</p>
          <p className="text-xs text-text-secondary">Right temple, Forehead</p>
          <p className="text-xs text-text-secondary">Impact: <span className="text-text-primary">a lot</span></p>
          <div className="flex flex-wrap gap-1 pt-0.5">
            <span className="rounded-full bg-bg-border/60 px-2 py-0.5 text-xs text-text-secondary">Nausea</span>
            <span className="rounded-full bg-bg-border/60 px-2 py-0.5 text-xs text-text-secondary">Light sensitivity</span>
          </div>
        </div>
        <div className="shrink-0">
          <span className="rounded-lg border border-severity-mid/30 bg-severity-mid/20 px-2 py-1 text-lg font-bold tabular-nums text-severity-mid">7</span>
        </div>
      </div>
    </div>
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
        <div className="space-y-4">
          {auth.session ? (
            <>
              <p className="text-sm text-text-primary">
                Signed in as <span className="font-medium">{auth.user?.email}</span>
              </p>
              <p className="text-xs text-text-secondary">Your attacks and lists sync automatically across devices.</p>
              <SyncIndicator status={syncStatus} lastSyncedAt={lastSyncedAt} />
              <Button variant="secondary" fullWidth onClick={() => auth.signOut()}>
                Sign out
              </Button>
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
          className="tap-44-y btn-secondary min-h-0 rounded-control-sm px-3 py-1.5 text-xs font-medium transition-colors active:opacity-60 disabled:opacity-40"
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
  const [exportErr, setExportErr] = useState(false);
  const exporting = useRef(false);

  // Export used to fail silently in the iOS app (a blob download does nothing in
  // a WKWebView). It now says so when it cannot save; a dismissed share sheet is
  // not a failure and shows nothing.
  async function onExport() {
    // A second tap while the share sheet is open would be rejected by the plugin
    // ("Can't share while sharing is in progress") and show a false failure.
    if (exporting.current) return;
    exporting.current = true;
    setExportErr(false);
    try {
      await exportData();
    } catch (e) {
      console.error('Export failed:', e);
      setExportErr(true);
    } finally {
      exporting.current = false;
    }
  }

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
              onClick={onExport}
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
          {/* Amber, not the alarm colour: the data is untouched, only the file was not made. */}
          {/* The live region stays in the page and only its text comes and goes: VoiceOver often skips a region that is added already holding text. */}
          <p role="status" className="text-xs text-severity-mid">{exportErr ? "The backup couldn't be saved. Your data is still on this device." : ''}</p>
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
      <div className="space-y-4">
        <p className="text-sm text-text-primary">Check your email for a sign-in link.</p>
        {/* Tapping the emailed link always opens Safari on iOS, never a
            standalone home-screen app — entering the 6-digit code from the
            same email works from inside the installed app instead. */}
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-xs text-text-secondary">
            On the home-screen app? Tapping the link opens Safari instead — enter the 6-digit code from the email here.
          </p>
          {/* Marked up as a one-time code so both password managers and iOS's
              own SMS/email autofill offer to fill it. */}
          <TextField
            label="6-digit sign-in code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onValueChange={setCode}
            error={error ?? undefined}
          />
          <Button type="submit" variant="secondary" fullWidth loading={verifying} loadingLabel="Verifying">
            Verify code
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="space-y-4">
      <TextField
        label="Email address"
        type="email"
        autoComplete="email"
        required
        value={email}
        onValueChange={setEmail}
        hint="Sign in to sync your attacks across devices. No password — we'll email you a link."
        error={error ?? undefined}
      />
      <Button type="submit" fullWidth loading={status === 'sending'} loadingLabel="Sending">
        Send sign-in link
      </Button>
    </form>
  );
}
