// Export / import all app data (everything lives under the `hd_` localStorage
// prefix: attacks, triggers, symptoms, reliefs, notification + UI settings).

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const PREFIX = 'hd_';

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
    version: 1,
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

type ReadResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string };

export async function readBackupFile(file: File): Promise<ReadResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  // Accept our wrapper ({ data: {...} }) or a bare { hd_*: value } object.
  const obj = parsed as Record<string, unknown> | null;
  const rawCandidate =
    obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>)
      : obj;

  if (!rawCandidate || typeof rawCandidate !== 'object') {
    return { ok: false, error: 'Unrecognised backup file.' };
  }

  const entries = Object.entries(rawCandidate).filter(([k]) => k.startsWith(PREFIX));
  if (entries.length === 0) {
    return { ok: false, error: 'No Lidd data found in this file.' };
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
