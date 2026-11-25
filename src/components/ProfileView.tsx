import { useCallback, useEffect, useRef, useState } from 'react';
import type { FontChoice, TextScale, Theme } from '../hooks/useSettings';
import type { useAuth } from '../hooks/useAuth';
import type { Attack, SyncStatus } from '../types';
import { formatSince, formatDatetime, formatTime } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';
import { AttackCard } from './AttackCard';
import { exportData, readBackupFile, applyBackup, type ParsedBackup } from '../utils/backup';
import { ConfirmDialog } from './ConfirmDialog';
import { ProfileSubPage } from './ProfileSubPage';
import { SegmentedControl } from './SegmentedControl';
import { Button, TextField } from 'code-ds';
import { SectionLabel, SettingsList, SettingsRow, Switch } from './settingsUi';
import { pendingReminders, notificationPermission, type PendingReminder } from '../utils/notifications';
import { TabletIcon, EyeIcon, CloudIcon, DataIcon, ChecklistIcon, BellIcon } from './drawnIcons';
import { NotificationSettings } from './NotificationSettings';
import appIcon from '../assets/app-icon.png';
import type { NotificationConfig } from '../types';

const SCALES: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const SCALE_SPOKEN: Record<TextScale, string> = { xs: 'Extra small', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Extra large' };
// The A on each step, from the v4 board.
const STEP_A_PX: Record<TextScale, number> = { xs: 13, sm: 17, md: 21, lg: 26, xl: 32 };
// Each step's root size — must match `[data-scale]` in index.css.
const SCALE_ROOT_PX: Record<TextScale, number> = { xs: 14, sm: 15, md: 16, lg: 22, xl: 24 };
const SCALE_NAME: Record<TextScale, string> = { xs: 'XS', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'XL' };

export type ProfileSection = 'medications' | 'guides' | 'hit6' | 'display' | 'reminders' | 'account' | 'data' | 'about';

interface MenuProps {
  onOpen: (section: ProfileSection) => void;
  accountEnabled: boolean;
  /** Shows a quiet marker on the Headache impact row when it's worth
   *  answering again. This is the *only* place HIT-6 asks for attention —
   *  deliberately not a card on Today and not a notification. */
  hit6Due?: boolean;
  /** The two background states worth seeing without tapping in: whether
   *  reminders will fire, and whether the diary is syncing. */
  remindersOn: boolean;
  signedIn: boolean;
}

type MenuItem = { id: ProfileSection; Icon: (p: { className?: string }) => React.ReactElement; label: string };

// Lidd's version, bumped by hand to match MARKETING_VERSION in Xcode. The
// build is `__APP_BUILD__` (vite.config.ts) — a real count, never a made-up N.
const APP_VERSION = '1.0';
const VERSION_LINE = __APP_BUILD__ ? `Version ${APP_VERSION} · build ${__APP_BUILD__}` : `Version ${APP_VERSION}`;

// About's mark is a Lucide info glyph — a generic UI affordance, inlined to the
// same contract as the drawn icons (24×24, currentColor). A function
// declaration so MENU_GROUPS below can name it before this line.
function AboutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

// Drawn marks rather than emoji, for the reason the attack-mode pill gave up
// its own: an emoji is full-colour and can't inherit `currentColor`, so a row
// of them made a settings list the most saturated thing on a screen the
// palette works to keep quiet. These take the row's own colour and size.
//
// **Two labelled groups, v4 (docs/redesign-v4/screens/14-settings).** "Your
// diary" is what you record and when you're reminded; "The app" is how it
// behaves and the account. Rows are one line: a label, and a trailing state
// only where there is one to see (2026-11-25, Sunny — the v4 sub-text was
// mostly a description of the page behind the row; see docs/decisions.md,
// "Settings rows lose their sub-text"). Headache impact and Account & sync are kept though the v4 board omits
// them — the board is incomplete there, and dropping either would lose a
// shipped feature. About is new. The prototype's doctor-report / states-preview
// rows stay out (a report is its own feature; the others are prototype tools).
const MENU_GROUPS: { label: string; items: MenuItem[] }[] = [
  {
    label: 'Your diary',
    items: [
      { id: 'medications', Icon: TabletIcon, label: 'My medications' },
      { id: 'hit6', Icon: ChecklistIcon, label: 'Headache impact' },
      { id: 'reminders', Icon: BellIcon, label: 'Reminders' },
    ],
  },
  {
    label: 'The app',
    items: [
      { id: 'display', Icon: EyeIcon, label: 'Display & attack mode' },
      { id: 'data', Icon: DataIcon, label: 'Data' },
      { id: 'account', Icon: CloudIcon, label: 'Account & sync' },
      { id: 'about', Icon: AboutIcon, label: 'About' },
    ],
  },
];

// Every row opens its own sub-page. The "Due" marker on Headache impact stays
// text, not a dot — a dot reads as an alert, and this is a suggestion about a
// questionnaire. No email on the Account row: it's the sub-page's to show, and
// this screen gets screenshotted.
export function ProfileView({ onOpen, accountEnabled, hit6Due = false, remindersOn, signedIn }: MenuProps) {
  const trailingFor = (id: ProfileSection): string | undefined => {
    switch (id) {
      case 'reminders': return remindersOn ? 'On' : 'Off';
      case 'hit6': return hit6Due ? 'Due' : undefined;
      case 'account': return signedIn ? 'On' : 'Off';
      default: return undefined;
    }
  };
  return (
    <div className="space-y-6">
      {MENU_GROUPS.map((group) => (
        <section key={group.label} className="space-y-2">
          <SectionLabel>{group.label}</SectionLabel>
          <SettingsList>
            {group.items
              .filter((m) => m.id !== 'account' || accountEnabled)
              .map((item) => (
                <SettingsRow key={item.id} leading={<item.Icon />} trailing={trailingFor(item.id)} onClick={() => onOpen(item.id)}>
                  {item.label}
                </SettingsRow>
              ))}
          </SettingsList>
        </section>
      ))}
    </div>
  );
}

// Where feedback is sent. A placeholder — set a real inbox before any public
// release (June, 2026-11-23: mailto, and deliberately not her personal address).
const FEEDBACK_EMAIL = 'feedback@lidd.app';

// About — version, what Lidd is and isn't, a Send feedback row, and where it's
// made. The v4 board's Privacy policy / Terms of use rows are held for now
// (legal content that doesn't exist yet).
export function AboutPanel({ onClose, email }: { onClose: () => void; email: string | null }) {
  const [view, setView] = useState<'about' | 'feedback'>('about');
  if (view === 'feedback') return <FeedbackPage email={email} onBack={() => setView('about')} />;
  return (
    <ProfileSubPage title="About Lidd" onClose={onClose}>
      <div className="space-y-6">
        {/* v4 AboutDark: icon, name and version centred as one block. The
            board's icon is an empty placeholder square; this is the shipped
            app icon (AppIcon-512@2x.png, scaled to 3x of 56px). 22.5% is the
            iOS icon mask's corner ratio, so it reads as the home-screen icon. */}
        <div className="flex flex-col items-center gap-2.5 pt-2 pb-1 text-center">
          <img src={appIcon} alt="" width={56} height={56} className="size-14 rounded-[22.5%]" />
          <p className="text-lg font-semibold text-text-primary">Lidd</p>
          <p className="text-sm text-text-secondary">{VERSION_LINE}</p>
        </div>
        <p className="text-sm leading-relaxed text-text-primary">
          Lidd is a diary for you and your doctor. It records attacks, medication and how they affect you — it doesn't diagnose, score severity or give medical advice. If you're in doubt about a symptom, talk to a doctor or pharmacist.
        </p>
        <SettingsList>
          <SettingsRow onClick={() => setView('feedback')}>Send feedback</SettingsRow>
        </SettingsList>
        <p className="text-center text-sm text-text-secondary">Made in Copenhagen.</p>
      </div>
    </ProfileSubPage>
  );
}

// Feedback opens the user's own mail app (mailto) rather than posting to a
// server: no backend, no new privacy surface, and the user sends it themselves
// — the app only drafts. A nested view in the About sheet; back returns to it.
function FeedbackPage({ email, onBack }: { email: string | null; onBack: () => void }) {
  const [msg, setMsg] = useState('');
  const [includeEmail, setIncludeEmail] = useState(false);
  const [contact, setContact] = useState(email ?? '');
  const [handedOff, setHandedOff] = useState(false);
  const send = () => {
    const body = includeEmail && contact.trim() ? `${msg}\n\n— Reply to: ${contact.trim()}` : msg;
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Lidd feedback')}&body=${encodeURIComponent(body)}`;
    setHandedOff(true);
  };
  if (handedOff) return <FeedbackHandedOff onDone={onBack} />;
  return (
    <ProfileSubPage
      title="Send feedback"
      onClose={onBack}
      footer={
        <button type="button" className="btn-primary btn-inline w-full" disabled={!msg.trim()} onClick={send}>
          Send
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold leading-snug text-text-primary">What's not working, or what would make Lidd better?</h2>
          <p className="mt-1.5 text-sm text-text-secondary">We read every message. This isn't for urgent medical questions — talk to a doctor or pharmacist for those.</p>
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={6}
          placeholder="Tell us what happened, or what you'd like to see…"
          aria-label="Your feedback"
          className="min-h-[11.25rem] w-full resize-none rounded-field border border-bg-border bg-bg-surface p-card text-text-primary placeholder:text-text-secondary"
        />
        <SettingsList>
          <SettingsRow bare>
            <Switch checked={includeEmail} onCheckedChange={setIncludeEmail}>
              <span className="block">Include my email so we can follow up</span>
              {/* The board names the address under the label. Signed in, it's
                  known; otherwise the field below asks for one. */}
              {includeEmail && email && <span className="block text-sm text-text-secondary">{email}</span>}
            </Switch>
          </SettingsRow>
        </SettingsList>
        {includeEmail && !email && (
          <input
            type="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="you@example.com"
            aria-label="Your email"
            className="w-full rounded-field border border-border-control bg-bg-raised px-control-x py-control-y text-text-primary placeholder:text-text-secondary"
          />
        )}
      </div>
    </ProfileSubPage>
  );
}

// v4 FeedbackSentDark's layout — check, headline, one line, Done — with the
// words changed. The board says "Thanks, sent.", but Send only hands a draft
// to the mail app (mailto); Lidd never learns whether it went, so claiming it
// did would be untrue. The headline thanks, the line says where it is now.
function FeedbackHandedOff({ onDone }: { onDone: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base">
      <div
        className="flex flex-1 flex-col items-center gap-3.5 px-gutter text-center"
        style={{ paddingTop: 'calc(4.25rem + env(safe-area-inset-top))' }}
      >
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-selected-fill ring-1 ring-inset ring-accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-[1.875rem] text-accent">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="text-[1.625rem] font-semibold leading-tight text-text-strong outline-none">Thanks.</h2>
        <p className="max-w-[17.5rem] text-sm text-text-secondary">Your message is ready in your mail app. Send it from there.</p>
      </div>
      <div className="px-gutter pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={onDone} className="btn-primary btn-inline w-full">Done</button>
      </div>
    </div>
  );
}

interface DisplayProps {
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
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
// own floor via BrightnessOverlay, which still reads `hd_brightness` — only the
// slider that set it is removed). The auto-setting
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
      <div className="space-y-6">
        {/* Attack mode — also one tap from the Today hero; it lives here too so
            it's discoverable when nothing hurts yet. "What it changes" is its
            own screen, so the long explanation stays off the list. */}
        <section className="space-y-2">
          <SectionLabel>Attack mode</SectionLabel>
          <SettingsList>
            <SettingsRow bare>
              <Switch checked={attackMode} onCheckedChange={onAttackMode}>
                <span className="font-semibold">Attack mode</span>
              </Switch>
            </SettingsRow>
            {/* The board's caption is "Turns off again once the attack ends";
                the code only ever turns it on (A10, June 2026-11-22, that
                half is backlogged), so the caption says what it really does. */}
            <SettingsRow bare>
              <Switch checked={attackModeAuto} onCheckedChange={onAttackModeAuto}>
                When I log an attack
                <span className="block text-xs text-content-muted">Turns it on as soon as you log an attack that's still going.</span>
              </Switch>
            </SettingsRow>
            <SettingsRow onClick={() => setView('changes')}>What it changes</SettingsRow>
          </SettingsList>
        </section>

        {/* The everyday look: theme, font and text size in one group, each
            stating its value on the row (v4 board 18a). While attack mode is
            on it overrides all three, and the caption says so rather than
            leaving the choices looking broken. Manual theme only, no
            prefers-color-scheme (2026-09-25). */}
        <section className="space-y-2">
          <SectionLabel>Everyday</SectionLabel>
          {attackMode && (
            <p className="mx-1 text-sm text-text-secondary">Attack mode is on. You'll see these when you turn it off.</p>
          )}
          <SettingsList>
            <SettingsRow bare>
              <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 py-1 text-sm">
                <span className="text-text-primary">Theme</span>
                <SegmentedControl
                  label="Theme"
                  recessed
                  value={theme}
                  onChange={onTheme}
                  options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
                />
              </div>
            </SettingsRow>
            <SettingsRow onClick={() => setView('font')} trailing={font === 'lexend' ? 'Lexend' : 'Atkinson'} trailingTone="primary">Font</SettingsRow>
            <SettingsRow onClick={() => setView('textsize')} trailing={systemText ? 'iPhone' : SCALE_NAME[textScale]} trailingTone="primary">Text size</SettingsRow>
          </SettingsList>
        </section>
      </div>
    </ProfileSubPage>
  );
}

// Font screen — v4 board DisplayFontDark: two tiles, each naming the face
// above a sample set in it, the chosen one tinted with an accent outline and
// a check; Atkinson's "why you'd pick it" line sits under both.
function FontPage({ font, onFont, onBack }: { font: FontChoice; onFont: (f: FontChoice) => void; onBack: () => void }) {
  return (
    <ProfileSubPage title="Font" onClose={onBack}>
      <div className="space-y-3.5">
        <div role="radiogroup" aria-label="Font" className="space-y-3.5">
          <FontOption name="Lexend" family="'Lexend', sans-serif" selected={font === 'lexend'} onSelect={() => onFont('lexend')} />
          <FontOption
            name="Atkinson Hyperlegible Next"
            family="'Atkinson Hyperlegible Next', sans-serif"
            selected={font === 'atkinson'}
            onSelect={() => onFont('atkinson')}
          />
        </div>
        <p className="text-xs text-text-secondary">Try it if letters like I, l and 1 blur together.</p>
      </div>
    </ProfileSubPage>
  );
}

function FontOption({ name, family, selected, onSelect }: {
  name: string; family: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative flex min-h-[5.25rem] w-full flex-col justify-center gap-1.5 rounded-control px-3.5 py-3 text-left ring-inset transition-colors ${
        selected ? 'bg-selected-fill pr-11 ring-1 ring-accent' : 'bg-bg-raised'
      }`}
    >
      {/* The face's name stays in Lexend, the app's own voice; only the
          sample is set in the face it selects. */}
      <span className="text-xs font-semibold text-text-secondary" style={{ fontFamily: "'Lexend', sans-serif" }}>{name}</span>
      <span className="text-sm text-text-primary" style={{ fontFamily: family }}>Took 1 tablet at 09:15. Right temple.</span>
      {selected && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-accent" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}

// Text size screen — v4 boards DisplayTextSizeDark / ...IphoneDark. The
// iPhone switch; then either five steps, each an A drawn at a size that
// grows with it, the chosen one tinted with an accent outline and named
// below; or, when the phone is in charge, what it's set to and where to
// change it. The sample Logs card sits under either and follows the setting.
function TextSizePage({ textScale, onTextScale, systemText, onSystemText, onBack }: {
  textScale: TextScale; onTextScale: (s: TextScale) => void; systemText: boolean; onSystemText: (on: boolean) => void; onBack: () => void;
}) {
  // useSettings re-measures the iPhone's size when the app comes back to the
  // front, but only by writing a CSS variable — nothing React sees. Render
  // again on the same events (a tick later, so its measurement has landed),
  // or the row keeps naming the size from before a trip to iPhone Settings.
  const [, setReturned] = useState(0);
  useEffect(() => {
    if (!systemText) return;
    const again = () => { if (document.visibilityState === 'visible') setTimeout(() => setReturned((n) => n + 1), 0); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('focus', again);
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again); };
  }, [systemText]);
  const phoneSize = systemText ? measuredPhoneSize() : null;
  return (
    <ProfileSubPage title="Text size" onClose={onBack}>
      <div className="space-y-[1.125rem]">
        <SettingsList>
          <SettingsRow bare>
            <Switch checked={systemText} onCheckedChange={onSystemText}>
              Use iPhone text size
              <span className="block text-xs text-content-muted">Follows your iPhone settings</span>
            </Switch>
          </SettingsRow>
          {phoneSize && (
            <SettingsRow trailing={SCALE_NAME[phoneSize]} trailingTone="primary">Your iPhone is set to</SettingsRow>
          )}
        </SettingsList>

        {systemText ? (
          <p className="text-xs text-text-secondary">To change it, go to iPhone Settings, then Display &amp; Brightness, then Text Size.</p>
        ) : (
          <div className="space-y-2">
            <SectionLabel>Size</SectionLabel>
            <div role="group" aria-label="Text size" className="flex gap-2">
              {SCALES.map((s) => {
                const on = textScale === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onTextScale(s)}
                    aria-pressed={on}
                    aria-label={SCALE_SPOKEN[s]}
                    className={`flex min-h-[3.25rem] flex-1 items-center justify-center rounded-segment ring-inset transition-colors ${
                      on ? 'bg-selected-fill ring-1 ring-accent' : 'bg-bg-raised'
                    }`}
                  >
                    {/* px on purpose: each A shows its step's size, not the current one. */}
                    <span
                      aria-hidden="true"
                      className={on ? 'font-semibold text-accent' : 'text-text-primary'}
                      style={{ fontSize: `${STEP_A_PX[s]}px`, lineHeight: 1 }}
                    >A</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-text-secondary">{SCALE_NAME[textScale]}{textScale === 'md' ? ' · the default' : ''}</p>
          </div>
        )}

        <DisplayPreviewCard />
        {!systemText && (
          <p className="text-xs text-text-secondary">Every screen grows with it. Attack mode makes small text bigger.</p>
        )}
      </div>
    </ProfileSubPage>
  );
}

// The step nearest the iPhone's own size, from the --system-text that
// useSettings measures (14–24px, the same range as the steps). Null where
// it couldn't be measured — outside Apple's WebKit — so the row is left
// out rather than claiming "Medium".
function measuredPhoneSize(): TextScale | null {
  // useSettings writes a 16px fallback when it can't measure; this is its
  // own test for whether it could.
  if (typeof CSS === 'undefined' || !CSS.supports('font', '-apple-system-body')) return null;
  const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--system-text'));
  if (!Number.isFinite(px)) return null;
  return SCALES.reduce((best, s) => (Math.abs(SCALE_ROOT_PX[s] - px) < Math.abs(SCALE_ROOT_PX[best] - px) ? s : best), 'md');
}

// What attack mode changes — v4 board DisplayAttackChangesDark: the sample
// log drawn in attack mode's palette, then four checked lines and a
// closing reassurance in place of a fifth row.
function AttackChangesPage({ onBack }: { onBack: () => void }) {
  return (
    <ProfileSubPage title="What it changes" onClose={onBack}>
      <div className="space-y-5">
        <section className="space-y-2">
          <SectionLabel>A log in attack mode</SectionLabel>
          <DisplayPreviewCard attack />
        </section>
        <ul className="space-y-3.5">
          <ChangeLine sub="At least 35% darker">Dims the screen</ChangeLine>
          <ChangeLine>Warmer colours, softer contrast</ChangeLine>
          <ChangeLine>Bigger text, if yours is set small</ChangeLine>
          <ChangeLine>Nothing moves</ChangeLine>
        </ul>
        <p className="text-xs font-semibold text-text-primary">Your logs stay exactly as they are.</p>
      </div>
    </ProfileSubPage>
  );
}

function ChangeLine({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-text-primary">
      {/* Lucide `check`, 18px in accent — the board's mark. */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-[1.125rem] shrink-0 text-accent" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span>
        {children}
        {sub && <span className="mt-0.5 block text-xs text-text-secondary">{sub}</span>}
      </span>
    </li>
  );
}

// The sample log on the Text size and What-it-changes screens: the real
// Logs card (AttackCard) drawn from a made-up attack, so the preview can
// never show a card the app no longer renders. Not pressable, and hidden
// from screen readers — it's a picture of a row, not a row.
const SAMPLE_START = new Date(2024, 5, 24, 9, 15);
const sampleAt = (min: number) => new Date(SAMPLE_START.getTime() + min * 60_000).toISOString();
const SAMPLE_ATTACK: Attack = {
  id: SAMPLE_START.getTime(),
  snapshots: [
    { time: sampleAt(0), areas: { 'Temple right': 5, Forehead: 4 }, symptoms: ['Nausea', 'Light sensitivity'], reliefs: [], medication: { name: 'Sumatriptan', dose: '50 mg' }, note: null, source: 'manual' },
    { time: sampleAt(60), areas: { 'Temple right': 7, Forehead: 5 }, symptoms: [], reliefs: [], medication: null, note: null, source: 'manual' },
    { time: sampleAt(150), areas: { 'Temple right': 3 }, symptoms: [], reliefs: [], medication: null, note: null, source: 'manual' },
  ],
  end: sampleAt(150),
  triggers: [],
  notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 },
};

// `attack`: the card as attack mode draws it — its palette (`.attack-preview`
// in index.css), its 20px text floor (zoom by the ratio to this screen's own
// size, so a page already at 20px or more draws it as is), and the dim
// laid over the top at BrightnessOverlay's floor.
function DisplayPreviewCard({ attack = false }: { attack?: boolean }) {
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const zoom = attack ? Math.max(1, 20 / rootPx) : 1;
  const attackModeOn = document.documentElement.dataset.theme === 'attack';
  return (
    // In attack colours the card sits on a patch of attack mode's own page
    // (bg-base inside .attack-preview): on this everyday page its surface
    // was within a shade of the background and read as no card at all.
    <div aria-hidden="true" inert className={`relative ${attack ? 'attack-preview rounded-card bg-bg-base p-3' : ''}`} style={zoom > 1 ? { zoom } : undefined}>
      <AttackCard attack={SAMPLE_ATTACK} onClick={() => {}} />
      {/* The dim, at BrightnessOverlay's floor — left off when attack mode
          is really on, since its own dim already covers the whole screen. */}
      {attack && !attackModeOn && <div className="pointer-events-none absolute inset-0 rounded-card bg-bg-base/35" />}
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
        <p className="text-xs uppercase tracking-wider font-semibold text-text-secondary label-caps">Reminders</p>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="tap-44-y btn-secondary min-h-0 rounded-control-sm px-3 py-1.5 text-xs font-medium transition-colors active:opacity-60"
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
      {/* space-y-5: the board's 22px between blocks (lead, switch, Timing). */}
      <div className="space-y-5">
        <p className="text-sm text-text-secondary">
          While an attack is open, a reminder asks how it's going, so the diary has a reading every so often. Applies to attacks from now on.
        </p>
        <NotificationSettings value={value} onChange={onChange} />
      </div>
    </ProfileSubPage>
  );
}

export function DataPanel({ auth, onClose, attackCount, checkInCount, medCount }: {
  auth: ReturnType<typeof useAuth>;
  onClose: () => void;
  /** Counts shown on the export-confirm screen before a file is written. */
  attackCount: number;
  checkInCount: number;
  medCount: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [exportErr, setExportErr] = useState(false);
  // Export now opens a confirm screen first (the v4 DataExport board): it names
  // what the file holds and that it isn't encrypted before anything is written.
  const [view, setView] = useState<'data' | 'export'>('data');
  const exporting = useRef(false);

  // The write itself (share sheet on native, download on web). Returns whether
  // it saved, so the confirm screen can step back only on success. It used to
  // fail silently in the iOS app (a blob download does nothing in a WKWebView);
  // it now says so when it can't save, and a dismissed share sheet is not a
  // failure and shows nothing.
  async function doExport(): Promise<boolean> {
    // A second tap while the share sheet is open would be rejected by the plugin
    // ("Can't share while sharing is in progress") and show a false failure.
    if (exporting.current) return false;
    exporting.current = true;
    setExportErr(false);
    try {
      await exportData();
      return true;
    } catch (e) {
      console.error('Export failed:', e);
      setExportErr(true);
      return false;
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

  // The export-confirm screen: what the file holds, and that it isn't
  // encrypted, before it's written. A nested view swapped in this one sheet —
  // its back chevron and Cancel return to the Data list, not out of the sheet.
  if (view === 'export') {
    const backToData = () => { setView('data'); setExportErr(false); };
    return (
      <ProfileSubPage
        title="Export"
        onClose={backToData}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn-secondary btn-inline w-full" onClick={backToData}>Cancel</button>
            <button
              type="button"
              className="btn-primary btn-inline w-full"
              onClick={async () => { if (await doExport()) setView('data'); }}
            >
              Save file
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-text-secondary">One file with your attacks, check-ins, medicines and settings.</p>
          <SettingsList>
            <SettingsRow value={String(attackCount)}>Attacks</SettingsRow>
            <SettingsRow value={String(checkInCount)}>Check-ins</SettingsRow>
            <SettingsRow value={String(medCount)}>Medicines</SettingsRow>
          </SettingsList>
          <p className="text-xs text-text-secondary">The file is not encrypted. Keep it somewhere private.</p>
          {/* Amber, not the alarm colour: the data is untouched, only the file was not made. */}
          <p role="status" className="text-xs text-severity-mid">{exportErr ? "The backup couldn't be saved. Your data is still on this device." : ''}</p>
        </div>
      </ProfileSubPage>
    );
  }

  return (
    <ProfileSubPage title="Data" onClose={onClose}>

        <div className="rounded-card border border-bg-border bg-bg-raised/40 p-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setView('export')}
              className="btn-secondary py-2.5 text-sm font-medium transition-colors"
            >
              Export backup
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary py-2.5 text-sm font-medium transition-colors"
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
