import { useRef, useState } from 'react';
import type { TextScale } from '../hooks/useSettings';
import type { useAuth } from '../hooks/useAuth';
import { exportData, readBackupFile, applyBackup, type ParsedBackup } from '../utils/backup';
import { ConfirmDialog } from './ConfirmDialog';

const SCALES: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const SCALE_LABELS: Record<TextScale, string> = { xs: 'XS', sm: 'SM', md: 'MD', lg: 'LG', xl: 'XL' };
// Fixed px values used only in this picker as a visual size-comparison reference.
const SCALE_PX: Record<TextScale, number> = { xs: 13, sm: 14, md: 16, lg: 19, xl: 22 };

interface Props {
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  brightness: number;
  onBrightness: (v: number) => void;
  auth: ReturnType<typeof useAuth>;
}

export function SettingsView({ textScale, onTextScale, brightness, onBrightness, auth }: Props) {
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
    <div className="space-y-8">

      {/* Text size */}
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">Text size</p>

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
                  ? 'bg-accent text-bg-base'
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
              <p className="text-xs text-text-secondary">2h 30m · 3 snapshots</p>
              <p className="text-xs text-text-secondary">Right temple, Forehead</p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                <span className="text-xs bg-bg-border/60 text-text-secondary rounded-full px-2 py-0.5">Stress</span>
                <span className="text-xs bg-bg-border/60 text-text-secondary rounded-full px-2 py-0.5">Poor sleep</span>
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
          Changes apply instantly across the app. Use the A+ button (bottom‑right) for quick cycling at medium and above.
        </p>
      </section>

      {/* Screen brightness */}
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">Screen brightness</p>

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
      </section>

      {/* Account & sync — only rendered when Supabase is actually configured */}
      {auth.enabled && (
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">Account &amp; sync</p>
          <div className="rounded-xl border border-bg-border bg-bg-raised/40 p-4 space-y-3">
            {auth.session ? (
              <>
                <p className="text-sm text-text-primary">
                  Signed in as <span className="font-medium">{auth.user?.email}</span>
                </p>
                <p className="text-xs text-text-secondary">Your attacks and lists sync automatically across devices.</p>
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
        </section>
      )}

      {/* Data */}
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">Data</p>

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
      </section>

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

    </div>
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
        className="btn-primary w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
      {error && <p className="text-xs text-severity-high">{error}</p>}
    </form>
  );
}
