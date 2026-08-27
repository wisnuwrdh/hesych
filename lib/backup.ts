// Encrypted backup export/import - byte-compatible with legacy doEncExport /
// processImportJson. Master mode stores raw rows (already encrypted with the
// vault master key). Custom mode wraps rows re-encrypted with a user password
// in an extra AES-GCM layer.

import {
  b64ToBuf,
  bufToB64,
  decryptWith,
  deriveKey,
  type VaultKey,
} from "./crypto";
import { dbClearItems, dbGetAll, dbPutItem } from "./db";
import { reencryptRowList } from "./master";
import type { EncryptedVaultRow } from "./types";
import { getSalt } from "./verifier";

export interface BackupBundle {
  type: "vault-encrypted-backup";
  pwMode: "master" | "custom";
  v: number;
  salt?: string;
  iv?: string;
  data: unknown;
  dekEnv?: string; // v4: JSON-stringified PwEnvelope for master portability
}

export function randomB64(bytes = 16): string {
  return bufToB64(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function exportMasterBackup(
  db: IDBDatabase,
): Promise<BackupBundle> {
  const rows = await dbGetAll(db);
  // Include DEK envelope for true portability (v4). If envelope missing (very old vault),
  // dekEnv stays undefined and import falls back to legacy salt check.
  let dekEnv: string | undefined;
  try {
    const { vaultKeysGet } = await import("./db");
    const rec = await vaultKeysGet();
    dekEnv = rec?.pw_env;
  } catch {
    // best-effort: master backup without DEK is device-local only
  }
  return {
    type: "vault-encrypted-backup",
    pwMode: "master",
    v: 4,
    salt: bufToB64(getSalt()),
    dekEnv,
    data: rows as unknown,
  };
}

export async function exportCustomBackup(
  db: IDBDatabase,
  masterKey: VaultKey,
  password: string,
): Promise<BackupBundle> {
  const rows = await dbGetAll(db);
  const backupSalt = randomB64(16);
  const backupKey = await deriveKey(password, b64ToBuf(backupSalt));
  const innerRows = await reencryptRowList(masterKey, backupKey, rows);
  const payload = JSON.stringify({ v: 3, salt: backupSalt, data: innerRows });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    backupKey,
    new TextEncoder().encode(payload),
  );
  return {
    type: "vault-encrypted-backup",
    pwMode: "custom",
    v: 1,
    salt: backupSalt,
    iv: bufToB64(iv),
    data: bufToB64(new Uint8Array(ct)),
  };
}

export interface ImportResult {
  count: number;
}

/** Validates a bundle; throws descriptive errors on incompatibility. */
async function resolveRows(
  bundle: BackupBundle,
  vaultKey: VaultKey,
  vaultSalt: string,
  password?: string,
): Promise<EncryptedVaultRow[]> {
  if (!bundle || bundle.type !== "vault-encrypted-backup") {
    throw new Error("Not a Hesych backup file");
  }
  if (!Array.isArray(bundle.data) && bundle.pwMode !== "custom") {
    throw new Error("Invalid backup format");
  }

  if (bundle.pwMode === "custom") {
    if (!password) throw new Error("This backup needs its password");
    const backupKey = await deriveKey(password, b64ToBuf(bundle.salt || ""));
    const iv = b64ToBuf(bundle.iv || "");
    const ct = b64ToBuf(bundle.data as string);
    let payload: string;
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        backupKey,
        ct,
      );
      payload = new TextDecoder().decode(plain);
    } catch {
      throw new Error("Wrong password for this backup");
    }
    const inner = JSON.parse(payload);
    if (!Array.isArray(inner.data)) throw new Error("Invalid backup format");
    const rows = inner.data as EncryptedVaultRow[];
    if (rows.length) {
      // defense-in-depth trial decrypt with the derived key
      await decryptWith(backupKey, rows[0].title);
    }
    return reencryptRowList(backupKey, vaultKey, rows);
  }

  const rows = Array.isArray(bundle.data) ? (bundle.data as EncryptedVaultRow[]) : [];
  // v4 includes dekEnv for portability check; v3 relies on legacy salt check
  if (bundle.dekEnv) {
    // Trial decrypt to verify DEK compatibility; if mismatch, fail fast with actionable error
    if (rows.length) {
      try {
        await decryptWith(vaultKey, rows[0].title);
      } catch {
        throw new Error(
          "Backup was created with a different vault encryption key. Use a custom-password backup for cross-device restore, or restore on the original device.",
        );
      }
    }
  } else if (bundle.v >= 3 && bundle.salt && bundle.salt !== vaultSalt) {
    throw new Error("Backup was created with a different master password");
  }
  return rows;
}

export async function importBackup(
  db: IDBDatabase,
  bundle: BackupBundle,
  vaultKey: VaultKey,
  mode: "replace" | "merge",
  password?: string,
): Promise<ImportResult> {
  const rows = await resolveRows(bundle, vaultKey, bufToB64(getSalt()), password);
  if (mode === "replace") {
    // Atomic: clear + bulk put in single transaction for rollback safety
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      const store = tx.objectStore("items");
      store.clear();
      for (const row of rows) store.put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("import transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("import transaction aborted"));
    });
    return { count: rows.length };
  }
  const existingIds = new Set((await dbGetAll(db)).map((r) => r.id));
  let count = 0;
  for (const row of rows) {
    if (row.id !== undefined && existingIds.has(row.id)) continue;
    const { id, ...rest } = row;
    void id; // merge always assigns fresh ids to avoid collisions
    await dbPutItem(db, rest);
    count++;
  }
  return { count };
}