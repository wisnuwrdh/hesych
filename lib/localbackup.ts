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

export function opfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator.storage as unknown as { getDirectory?: unknown }).getDirectory === "function"
  );
}

export function isSupported(): boolean {
  return fsSupported() || opfsSupported();
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

/** True when items exist and (never backed up OR older than 14 days). Respects per-session dismiss. */
export function reminderDue(itemCount: number): boolean {
  if (itemCount === 0 || !isSupported()) return false;
  try {
    if (sessionStorage.getItem("lb_reminder_dismissed") === "1") return false;
  } catch {}
  const last = lastBackupAt();
  return Date.now() - last > REMINDER_MS;
}

export function dismissReminder(): void {
  try {
    sessionStorage.setItem("lb_reminder_dismissed", "1");
  } catch {}
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
  if (fsSupported()) {
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
  if (opfsSupported()) {
    // On Android / Firefox / Safari: OPFS does not need a folder picker.
    // Auto-backup will write to the private origin storage.
    setEnabled(true);
    return { ok: true };
  }
  return { ok: false, error: "unsupported" };
}

export async function downloadOpfsBackup(): Promise<void> {
  if (!opfsSupported()) throw new Error("unsupported");
  const root = await (navigator.storage as unknown as { getDirectory: () => Promise<DirHandle> }).getDirectory();
  const fh = await (root as unknown as { getFileHandle: (n: string) => Promise<{ getFile: () => Promise<File> }> }).getFileHandle(SNAPSHOT_FILENAME);
  const file = await fh.getFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = SNAPSHOT_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function disableLocalBackup(): Promise<void> {
  setEnabled(false);
}

let writeQueue: Promise<void> = Promise.resolve();

/**
 * Writes the encrypted snapshot now. Throws on permission/IO failure so the
 * caller can surface a toast; silently no-ops when disabled.
 * Supports both folder handle (desktop Chromium) and OPFS (Android/Firefox/Safari).
 */
export async function writeSnapshot(): Promise<void> {
  if (!isEnabled()) return;
  // Queue writes to avoid concurrent createWritable collisions
  const task = writeQueue.then(async () => {
    const db = await openDB();
    const bundle = await exportMasterBackup(db);
    const content = JSON.stringify(bundle, null, 2);

    // Tier 1: File System Access folder (Chromium desktop)
    if (fsSupported()) {
      const handle = await getHandle();
      if (handle) {
        if (!(await ensureWritePermission(handle, false))) {
          throw new Error("permission");
        }
        const dir = handle as {
          getFileHandle: (n: string, o: { create: boolean }) => Promise<{
            createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }>;
          }>;
        };
        const tmpName = SNAPSHOT_FILENAME + ".tmp";
        const tmpHandle = await dir.getFileHandle(tmpName, { create: true });
        const tmpWritable = await tmpHandle.createWritable();
        try {
          await tmpWritable.write(content);
          await tmpWritable.close();
        } catch (e) {
          try { await tmpWritable.close(); } catch {}
          throw e;
        }
        const fh = await dir.getFileHandle(SNAPSHOT_FILENAME, { create: true });
        const writable = await fh.createWritable();
        try {
          await writable.write(content);
          await writable.close();
        } catch (e) {
          try { await writable.close(); } catch {}
          throw e;
        }
        try {
          await (dir as unknown as { removeEntry: (n: string) => Promise<void> }).removeEntry(tmpName);
        } catch {}
        localStorage.setItem(STORAGE_KEYS.lastLocalBackup, String(Date.now()));
        try { sessionStorage.removeItem("lb_reminder_dismissed"); } catch {}
        return;
      }
      // No handle yet but fsSupported — fall through to OPFS if available
      if (!opfsSupported()) throw new Error("missing_handle");
    }

    // Tier 2: OPFS (Android Chrome, Firefox 111+, Safari 16.4+)
    if (opfsSupported()) {
      const root = await (navigator.storage as unknown as { getDirectory: () => Promise<DirHandle> }).getDirectory();
      const fh = await (root as unknown as {
        getFileHandle: (n: string, o: { create: boolean }) => Promise<{
          createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }>;
        }>;
      }).getFileHandle(SNAPSHOT_FILENAME, { create: true });
      const writable = await fh.createWritable();
      try {
        await writable.write(content);
        await writable.close();
      } catch (e) {
        try { await writable.close(); } catch {}
        throw e;
      }
      localStorage.setItem(STORAGE_KEYS.lastLocalBackup, String(Date.now()));
      try { sessionStorage.removeItem("lb_reminder_dismissed"); } catch {}
      return;
    }

    throw new Error("unsupported");
  });
  writeQueue = task.catch(() => {});
  return task;
}
