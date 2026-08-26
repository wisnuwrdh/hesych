// Local auto-backup: writes an ENCRYPTED snapshot (same zero-knowledge
// format as master-mode export) into a folder chosen by the user via the
// File System Access API. Transport to other devices is then handled by
// whatever the user already uses (Syncthing, iCloud Drive, Dropbox
// desktop, USB) - Hesych itself stays 100% serverless.
//
// Chromium-only (showDirectoryPicker). Firefox/Safari gracefully hidden.

import { STORAGE_KEYS } from "./constants";
import { STORE_HANDLES } from "./constants";
import { openDB } from "./db";
import { exportMasterBackup } from "./backup";

const HANDLE_KEY = "local_backup_dir";
export const SNAPSHOT_FILENAME = "hesych-backup.json";
const REMINDER_MS = 14 * 24 * 60 * 60 * 1000;

type DirHandle = unknown;

interface PickerWindow {
  showDirectoryPicker?: (opts?: unknown) => Promise<DirHandle>;
}

export function fsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as PickerWindow).showDirectoryPicker === "function"
  );
}

export function isEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.localBackupOn) === "1";
  } catch {
    return false;
  }
}

export function setEnabled(on: boolean): void {
  localStorage.setItem(STORAGE_KEYS.localBackupOn, on ? "1" : "0");
  if (!on) localStorage.removeItem(STORAGE_KEYS.lastLocalBackup);
}

export function lastBackupAt(): number {
  return Number(localStorage.getItem(STORAGE_KEYS.lastLocalBackup) || 0);
}

/** True when items exist and (never backed up OR older than 14 days). */
export function reminderDue(itemCount: number): boolean {
  if (itemCount === 0 || !fsSupported()) return false;
  const last = lastBackupAt();
  return Date.now() - last > REMINDER_MS;
}

async function putHandle(handle: DirHandle): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, "readwrite");
    tx.objectStore(STORE_HANDLES).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("handle save failed"));
  });
}

async function getHandle(): Promise<DirHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, "readonly");
    const req = tx.objectStore(STORE_HANDLES).get(HANDLE_KEY);
    tx.oncomplete = () => resolve((req.result as DirHandle) ?? null);
    tx.onerror = () => reject(tx.error ?? new Error("handle load failed"));
  });
}

interface PermissionedHandle {
  queryPermission: (d: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
}

async function ensureWritePermission(handle: DirHandle, prompt: boolean): Promise<boolean> {
  const h = handle as unknown as PermissionedHandle;
  if (!h.queryPermission) return false;
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  if (!prompt || !h.requestPermission) return false;
  return (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

/** Ask the user for a backup folder; persists the handle and enables auto-backup. */
export async function pickBackupFolder(): Promise<{ ok: boolean; error?: string }> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker;
  if (!picker) return { ok: false, error: "unsupported" };
  let handle: DirHandle;
  try {
    handle = await picker({ id: "hesych-backup", mode: "readwrite" });
  } catch {
    return { ok: false, error: "canceled" };
  }
  await putHandle(handle);
  setEnabled(true);
  return { ok: true };
}

export async function disableLocalBackup(): Promise<void> {
  setEnabled(false);
}

/**
 * Writes the encrypted snapshot now. Throws on permission/IO failure so the
 * caller can surface a toast; silently no-ops when disabled.
 */
export async function writeSnapshot(): Promise<void> {
  if (!isEnabled()) return;
  const db = await openDB();
  const handle = await getHandle();
  if (!handle) return;
  if (!(await ensureWritePermission(handle, false))) {
    throw new Error("permission");
  }
  const bundle = await exportMasterBackup(db);
  const fh = await (
    handle as {
      getFileHandle: (n: string, o: { create: boolean }) => Promise<{
        createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }>;
      }>;
    }
  ).getFileHandle(SNAPSHOT_FILENAME, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(bundle, null, 2));
  await writable.close();
  localStorage.setItem(STORAGE_KEYS.lastLocalBackup, String(Date.now()));
}
