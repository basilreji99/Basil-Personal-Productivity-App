const BACKUP_FILENAME = 'basil-daily-backup.json';
const STORE_KEYS = [
  'productivity-tasks',
  'productivity-notes',
  'productivity-habits',
  'productivity-finance',
  'productivity-timer',
  'productivity-sprints',
  'basil-health',
  'basil-tags',
  'basil-calendar',
  'basil-hobbies',
  'basil-fitness',
  'basil-books',
  'basil-goals',
  'gym-store',
];

export interface DriveBackup {
  _syncedAt: number;
  [key: string]: unknown;
}

// ─── Dirty flag ───────────────────────────────────────────────────────────────
// Set whenever local user data changes. Tells syncNow() to push rather than pull.
// suppressDirtyMark is set true during Drive-data rehydration so the store
// subscription callbacks don't immediately re-dirty what we just downloaded.

let suppressDirtyMark = false;

export function setSuppressDirtyMark(v: boolean): void {
  suppressDirtyMark = v;
}

export function markLocalDirty(): void {
  if (!suppressDirtyMark) localStorage.setItem('basil-dirty', '1');
}

export function clearLocalDirty(): void {
  localStorage.removeItem('basil-dirty');
}

export function isLocalDirty(): boolean {
  return localStorage.getItem('basil-dirty') === '1';
}

// ─── Drive helpers ────────────────────────────────────────────────────────────

async function findFileId(token: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'${BACKUP_FILENAME}'&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files as { id: string }[])?.[0]?.id ?? null;
}

// Returns the _syncedAt timestamp that was written to Drive, or null on failure.
// Callers should use this value for setLocalSyncedAt() so they match exactly.
export async function uploadBackup(token: string): Promise<number | null> {
  try {
    const ts = Date.now();
    const backup: DriveBackup = { _syncedAt: ts };
    for (const key of STORE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) backup[key] = JSON.parse(raw);
    }

    const fileId = await findFileId(token);
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const method = fileId ? 'PATCH' : 'POST';

    const metadata = fileId
      ? { name: BACKUP_FILENAME }
      : { name: BACKUP_FILENAME, parents: ['appDataFolder'] };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(backup)], { type: 'application/json' }));

    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return res.ok ? ts : null;
  } catch {
    return null;
  }
}

export async function downloadBackup(token: string): Promise<DriveBackup | null> {
  try {
    const fileId = await findFileId(token);
    if (!fileId) return null;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function applyBackupToLocalStorage(backup: DriveBackup): void {
  for (const key of STORE_KEYS) {
    if (backup[key]) {
      localStorage.setItem(key, JSON.stringify(backup[key]));
    }
  }
}

export function getLocalSyncedAt(): number {
  const raw = localStorage.getItem('basil-synced-at');
  return raw ? parseInt(raw) : 0;
}

export function setLocalSyncedAt(ts: number): void {
  localStorage.setItem('basil-synced-at', String(ts));
}
