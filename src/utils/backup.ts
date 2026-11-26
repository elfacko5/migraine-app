// Export / import all app data (everything lives under the `hd_` localStorage
// prefix: attacks, triggers, symptoms, reliefs, notification + UI settings).

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const PREFIX = 'hd_';

/** The backup format this build writes and reads. A file stamped higher came
 *  from a newer Lidd and is refused rather than half-read: its keys may hold
 *  shapes this build would misread and then save over. */
const BACKUP_VERSION = 1;

/** Did the share sheet get dismissed rather than fail? The iOS plugin rejects
 *  with exactly "Share canceled" when the sheet is closed or the Save to Files
 *  picker is backed out of (`SharePlugin.swift`, 8.0.3), and its other two
 *  rejections ("Error sharing item", "Can't share while sharing is in progress")
 *  contain no "cancel". Matched on "cancel", case-insensitively. */
const isShareCancel = (e: unknown) => /cancel/i.test(e instanceof Error ? e.message : String(e));

/**
 * Saves every `hd_` key as one JSON file.
 *
 * **Native (iOS):** the file is written to the cache directory and handed to the
 * share sheet, where "Save to Files" keeps it. The web build's trick — a blob
 * URL clicked on an `<a download>` — does nothing in a WKWebView, silently,
 * which is why Export used to do nothing in the app. **Web:** unchanged.
 *
 * Resolves when the file is saved or handed over; a dismissed share sheet is
 * not an error. The file write is deliberately outside the `try`: only an error
 * from `Share.share` itself is examined for "cancelled", so a failed write
 * rejects straight to the caller and can never be swallowed as one. The caller
 * shows a line — a failure must never be silent again.
 */
export async function exportData(): Promise<void> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      const v = localStorage.getItem(key);
      if (v !== null) data[key] = v;
    }
  }

  const payload = {
    app: 'migraine-tracker',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = `lidd-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: 'Lidd backup', url: uri });
    } catch (e) {
      if (isShareCancel(e)) return;
      throw e;
    }
    return;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ParsedBackup {
  data: Record<string, string>;
  attacks: number; // attack count, for the confirm message
}

/** Why a file was refused. The Data page words each one (2026-11-26); the
 *  reasons stay codes here so the copy lives with the screen.
 *  - `not-backup`: not JSON, not an object, or no `hd_` keys in it.
 *  - `newer`: a Lidd backup stamped with a format this build doesn't know. */
export type BackupProblem = 'not-backup' | 'newer';

type ReadResult = { ok: true; backup: ParsedBackup } | { ok: false; problem: BackupProblem };

export async function readBackupFile(file: File): Promise<ReadResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, problem: 'not-backup' };
  }

  // Accept our wrapper ({ data: {...} }) or a bare { hd_*: value } object.
  const obj = parsed as Record<string, unknown> | null;
  // Only Lidd's own wrapper can be "newer": any other JSON with a version
  // field (a package.json, say) is simply not a backup.
  if (obj && typeof obj === 'object' && obj.app === 'migraine-tracker'
      && typeof obj.version === 'number' && obj.version > BACKUP_VERSION) {
    return { ok: false, problem: 'newer' };
  }
  const rawCandidate =
    obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>)
      : obj;

  if (!rawCandidate || typeof rawCandidate !== 'object') {
    return { ok: false, problem: 'not-backup' };
  }

  const entries = Object.entries(rawCandidate).filter(([k]) => k.startsWith(PREFIX));
  if (entries.length === 0) {
    return { ok: false, problem: 'not-backup' };
  }

  const data: Record<string, string> = {};
  for (const [k, v] of entries) data[k] = typeof v === 'string' ? v : JSON.stringify(v);

  let attacks = 0;
  try {
    const arr = JSON.parse(data['hd_attacks'] ?? '[]');
    if (Array.isArray(arr)) attacks = arr.length;
  } catch {
    /* ignore */
  }

  return { ok: true, backup: { data, attacks } };
}

export function applyBackup(data: Record<string, string>): void {
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
  }
}

/** Set by `runPendingDelete` for `App` to show the "deleted" message on the
 *  fresh page. sessionStorage, not `hd_`: it must survive the reload but
 *  never the delete itself or an export. */
export const DELETED_FLAG = 'lidd_deleted_all';

/** Set by Data → Delete all data just before it reloads; acted on at boot. */
const PENDING_DELETE_FLAG = 'lidd_delete_pending';

/**
 * **Delete all data, this phone only** (2026-11-25, Sunny: "phone only for
 * now" — the diff doc's D3, deleting the account's rows too, is not built).
 *
 * Asks for the delete; it happens on the next page load. The caller signs out
 * (this device) *before* calling this — signed in, the next sync would pull
 * everything straight back.
 *
 * **Why on the next load, not now** (review of d5f4b07): every hook holds its
 * list in React state, and a sync pull already in flight resolves into
 * `commit(remote)`, writing `hd_attacks` back after any in-page delete.
 * Reloading first ends every such request with the old page; the delete runs
 * at boot, before React renders, with nothing else alive to race it.
 */
export function requestDeleteAndReload(
  cancelReminder: (attackId: number) => void,
  clearDelivered: () => Promise<void>,
): void {
  try {
    sessionStorage.setItem(PENDING_DELETE_FLAG, '1');
  } catch {
    // No sessionStorage: delete in place instead, with the same cleanup —
    // the race above is rare, and doing nothing would be worse.
    deleteNow(cancelReminder, clearDelivered);
  }
  window.location.reload();
}

/**
 * Runs at boot (`main.tsx`) before the app renders. If a delete was asked
 * for: clears any `sb-` session that slipped back in, cancels each attack's
 * reminder, removes every `hd_` key (the set Export writes), clears delivered
 * reminders, and leaves the flag for the message.
 */
export function runPendingDelete(
  cancelReminder: (attackId: number) => void,
  clearDelivered: () => Promise<void>,
): void {
  try {
    if (!sessionStorage.getItem(PENDING_DELETE_FLAG)) return;
    sessionStorage.removeItem(PENDING_DELETE_FLAG);
  } catch {
    return;
  }
  deleteNow(cancelReminder, clearDelivered);
}

/** The delete itself: any `sb-` session, each attack's reminder, every `hd_`
 *  key, delivered reminders — then the flag for the message. */
function deleteNow(
  cancelReminder: (attackId: number) => void,
  clearDelivered: () => Promise<void>,
): void {
  for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k);
  try {
    const attacks = JSON.parse(localStorage.getItem('hd_attacks') ?? '[]') as { id?: unknown }[];
    for (const a of attacks) if (typeof a?.id === 'number') cancelReminder(a.id);
  } catch {
    /* unreadable list: nothing to cancel */
  }
  deleteHdKeys();
  void clearDelivered();
  try { sessionStorage.setItem(DELETED_FLAG, '1'); } catch { /* no message */ }
}

function deleteHdKeys(): void {
  for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
}
