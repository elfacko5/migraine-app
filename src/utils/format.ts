const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
// Same date without the weekday, for places where several sit in a row and
// the weekday is three characters of noise per label — chart axes, mainly.
const dateShortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const datetimeFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
});

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateShort = (iso: string) => dateShortFmt.format(new Date(iso));
export const formatDatetime = (iso: string) => datetimeFmt.format(new Date(iso));

export function formatDuration(startIso: string, endIso: string | null): string {
  const ms = (endIso ? new Date(endIso) : new Date()).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return '0m';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatElapsed(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0 && m === 0) return 'just now';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Time elapsed since `iso`, expressed in the two largest units (d/h/m).
export function formatSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

// The same elapsed time as formatSince, but spelled out — "14 days" rather
// than "14d". The compact form is for dense rows; the Today card gives this
// number a whole line to itself, where an abbreviation reads as cramped.
// Only the largest unit, since that card is a glance, not a stopwatch.
export function formatSinceLong(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  // **Capitalised, unlike `formatElapsed`'s**, and the difference is where
  // each one lands rather than an inconsistency: this is only ever a headline
  // standing on its own (`AttackFreeCard`, and the widget's attack-free
  // state), where `formatElapsed` renders mid-sentence as "Started just now".
  if (ms < 60_000) return 'Just now';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (days > 0) return unit(days, 'day');
  if (hours > 0) return unit(hours, 'hour');
  return unit(mins, 'minute');
}

export function isoToLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

// The time-of-day greeting on Today's attack-free hero.
//
// The clock is read inside the util rather than by the caller, the same rule
// the medication guardrails follow: `Date.now()` during a component's render
// is a lint error here, and the per-site disables exist so a real one stays
// visible. The caller pairs this with `useNowTick`, so it crosses noon and
// 18:00 without a reload.
//
// Boundaries are the ordinary ones and deliberately not clever — no "good
// night", which reads as a send-off to someone who has just opened the app.
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
