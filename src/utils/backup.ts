// Export / import all app data (everything lives under the `hd_` localStorage
// prefix: attacks, triggers, symptoms, reliefs, notification + UI settings).

const PREFIX = 'hd_';

export function exportData(): void {
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

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `migraine-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    return { ok: false, error: 'No migraine data found in this file.' };
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
