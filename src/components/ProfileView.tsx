import { useRef, useState } from 'react';
import type { TextScale } from '../hooks/useSettings';
import type { useAuth } from '../hooks/useAuth';
import type { SyncStatus } from '../types';
import { formatSince } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';
import { exportData, readBackupFile, applyBackup, type ParsedBackup } from '../utils/backup';
import { ConfirmDialog } from './ConfirmDialog';
import { ProfileSubPage } from './ProfileSubPage';

const SCALES: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const SCALE_LABELS: Record<TextScale, string> = { xs: 'XS', sm: 'SM', md: 'MD', lg: 'LG', xl: 'XL' };
// Fixed px values used only in this picker as a visual size-comparison reference.
const SCALE_PX: Record<TextScale, number> = { xs: 13, sm: 14, md: 16, lg: 19, xl: 22 };

export type ProfileSection = 'medications' | 'accessibility' | 'account' | 'data';

interface MenuProps {
  onOpen: (section: ProfileSection) => void;
  accountEnabled: boolean;
}

const MENU: { id: ProfileSection; icon: string; label: string; hint: string }[] = [
  { id: 'medications',   icon: '💊', label: 'My medications', hint: 'Acute and preventive' },
  { id: 'accessibility', icon: '👁', label: 'Accessibility',  hint: 'Text size and screen brightness' },
  { id: 'account',       icon: '☁️', label: 'Account & sync', hint: 'Sign in to sync across devices' },
  { id: 'data',          icon: '💾', label: 'Data',           hint: 'Export or import a backup' },
];

// Every group is its own sub-page. An earlier version kept these flat and
// gave only medications a row, which left one row sitting above three loose
// sections and read as an accident rather than a choice — the page needs to
// be one thing or the other.
export function ProfileView({ onOpen, accountEnabled }: MenuProps) {
  return (
    <div className="space-y-2">
      {MENU.filter((m) => m.id !== 'account' || accountEnabled).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item.id)}
          className="flex w-full items-center gap-3 rounded-xl border border-bg-border bg-bg-raised/40 px-4 py-4 text-left transition-colors hover:bg-bg-raised"
        >
          <span aria-hidden="true" className="text-lg">{item.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-text-primary">{item.label}</span>
            <span className="block text-xs text-text-secondary">{item.hint}</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

interface AccessibilityProps {
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  brightness: number;
  onBrightness: (v: number) => void;
  attackMode: boolean;
  onAttackMode: (on: boolean) => void;
  onClose: () => void;
}

export function AccessibilityPanel({ textScale, onTextScale, brightness, onBrightness, attackMode, onAttackMode, onClose }: AccessibilityProps) {
  return (
    <ProfileSubPage title="Accessibility" onClose={onClose}>
      <div className="space-y-8">

      {/* Attack mode — also one tap from the floating pill on every screen;
          it lives here too so it's discoverable when nothing hurts yet. */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Attack mode</p>
        <button
          type="button"
          role="switch"
          aria-checked={attackMode}
          onClick={() => onAttackMode(!attackMode)}
          className="flex w-full items-center gap-3 rounded-xl border border-bg-border bg-bg-raised/40 px-4 py-3 text-left transition-colors hover:bg-bg-raised"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
          </svg>
          <span className="min-w-0 flex-1 text-sm text-text-primary">
            {attackMode ? 'On' : 'Off'}
          </span>
          <span
            aria-hidden="true"
            className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${attackMode ? 'bg-accent' : 'bg-bg-border'}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-text-primary transition-transform ${attackMode ? 'translate-x-5' : ''}`}
            />
          </span>
        </button>
        <p className="text-xs text-text-secondary">
          Dims the screen, warms and lowers the contrast, enlarges body text and stops all animation.
          Everything you logged stays exactly as it is.
        </p>
      </div>
      {/* Accessibility — text size and brightness were two sibling sections;
          they're one group now, since both answer "make this easier to look
          at" and neither means much on its own. */}

      <div className="space-y-4">
        <p className="text-sm font-medium text-text-primary">Text size</p>

        {/* Five-segment picker */}
        <div className="flex rounded-xl overflow-hidden border border-bg-border">
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

        {/* Live preview card — inherits root font size so it updates instantly */}
        <div className="rounded-xl border border-bg-border/60 bg-bg-raised/40 p-4">
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

        <p className="text-xs text-text-secondary">
          Changes apply instantly across the app, and every screen reflows rather than clipping — XL is twice the default size.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium text-text-primary">Screen brightness</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-primary">Overlay</span>
            <span className="text-sm font-medium text-text-secondary tabular-nums">
              {Math.round(brightness * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={Math.round(brightness * 100)}
            onChange={(e) => onBrightness(Number(e.target.value) / 100)}
            className="w-full"
          />
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
          <div className="rounded-xl border border-bg-border bg-bg-raised/40 p-4 space-y-3">
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
                  className="btn-secondary w-full rounded-lg py-2.5 text-sm font-medium transition-colors"
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

        <div className="rounded-xl border border-bg-border bg-bg-raised/40 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={exportData}
              className="btn-secondary rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Export backup
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Import backup
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
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
      <p className="flex items-center gap-1.5 text-xs text-severity-high">
        <span className="h-1.5 w-1.5 rounded-full bg-severity-high shrink-0" />
        Sync failed — will retry automatically
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
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg bg-bg-surface border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-subtle"
          />
          <button
            type="submit"
            disabled={verifying}
            className="btn-secondary w-full rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
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
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg bg-bg-surface border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-subtle"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="btn-primary w-full rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
      {error && <p className="text-xs text-severity-high">{error}</p>}
    </form>
  );
}
