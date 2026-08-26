// Typed IndexedDB wrapper for the legacy-compatible VaultDB (v6).
// Client-only: requires globalThis.indexedDB (browser or fake-indexeddb).

import {
  DB_NAME,
  DB_VER,
  HIST_MAX,
  STORE_HANDLES,
  STORE_HISTORY,
  STORE_VAULT_KEYS,
  STORE_ITEMS,
  STORE_SHARE_LOG,
} from "./constants";
import type {
  EncryptedVaultRow,
  PasswordHistoryEntry,
  ShareLogEntry,
} from "./types";

let _dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB is not available"));
      return;
    }
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const d = (e.target as IDBOpenDBRequest).result;
      if (!d.objectStoreNames.contains(STORE_ITEMS)) {
        d.createObjectStore(STORE_ITEMS, { keyPath: "id", autoIncrement: true });
      }
      if (!d.objectStoreNames.contains(STORE_HISTORY)) {
        const hs = d.createObjectStore(STORE_HISTORY, {
          keyPath: "hid",
          autoIncrement: true,
        });
        hs.createIndex("itemId", "itemId", { unique: false });
      }
      if (!d.objectStoreNames.contains(STORE_SHARE_LOG)) {
        const sl = d.createObjectStore(STORE_SHARE_LOG, {
          keyPath: "slid",
          autoIncrement: true,
        });
        sl.createIndex("itemId", "itemId", { unique: false });
      }
      if (!d.objectStoreNames.contains(STORE_HANDLES)) {
        d.createObjectStore(STORE_HANDLES);
      }
      if (!d.objectStoreNames.contains(STORE_VAULT_KEYS)) {
        d.createObjectStore(STORE_VAULT_KEYS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("openDB failed"));
  });
  return _dbPromise;
}

/** Reset the cached DB handle. Call after closing the DB (e.g. on vault reset). */
export function resetDBCache(): void {
  _dbPromise = null;
}

/** @deprecated use resetDBCache - kept for test compatibility */
export function __resetDBForTests(): void {
  _dbPromise = null;
}

function withStore<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest | IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
    req.onerror = () => reject(req.error ?? new Error("request failed"));
  });
}

// ===== items =====

export async function dbGetAll(db: IDBDatabase): Promise<EncryptedVaultRow[]> {
  return withStore<EncryptedVaultRow[]>(db, STORE_ITEMS, "readonly", (s) =>
    s.getAll(),
  );
}

export async function dbGetItem(
  db: IDBDatabase,
  id: number,
): Promise<EncryptedVaultRow | undefined> {
  return withStore<EncryptedVaultRow>(db, STORE_ITEMS, "readonly", (s) =>
    s.get(id) as IDBRequest<EncryptedVaultRow>,
  );
}

export async function dbPutItem(
  db: IDBDatabase,
  row: EncryptedVaultRow,
): Promise<number> {
  const key = await withStore<number>(db, STORE_ITEMS, "readwrite", (s) =>
    s.put(row),
  );
  return key;
}

export async function dbDeleteItem(
  db: IDBDatabase,
  id: number,
): Promise<void> {
  await withStore<void>(db, STORE_ITEMS, "readwrite", (s) => s.delete(id));
}

export async function dbClearItems(db: IDBDatabase): Promise<void> {
  await withStore<void>(db, STORE_ITEMS, "readwrite", (s) => s.clear());
}

// ===== password history =====

export async function histGetAll(
  db: IDBDatabase,
  itemId: number,
): Promise<PasswordHistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, "readonly");
    const idx = tx.objectStore(STORE_HISTORY).index("itemId");
    const req = idx.getAll(itemId);
    req.onsuccess = () =>
      resolve((req.result as PasswordHistoryEntry[]).sort((a, b) => a.hid! - b.hid!));
    req.onerror = () => reject(req.error);
  });
}

export async function histGetAllItems(
  db: IDBDatabase,
): Promise<PasswordHistoryEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, "readonly");
    const req = tx.objectStore(STORE_HISTORY).getAll();
    req.onsuccess = () => resolve(req.result as PasswordHistoryEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function histAdd(
  db: IDBDatabase,
  itemId: number,
  encPassword: string,
): Promise<number> {
  const existing = await histGetAll(db, itemId);
  if (existing.length >= HIST_MAX) {
    const oldest = existing[0];
    await withStore<void>(db, STORE_HISTORY, "readwrite", (s) =>
      s.delete(oldest.hid!),
    );
  }
  return withStore<number>(db, STORE_HISTORY, "readwrite", (s) =>
    s.add({ itemId, encPassword, changedAt: Date.now() }),
  );
}

export async function histDelete(db: IDBDatabase, hid: number): Promise<void> {
  await withStore<void>(db, STORE_HISTORY, "readwrite", (s) => s.delete(hid));
}

export async function histDeleteAllByItem(
  db: IDBDatabase,
  itemId: number,
): Promise<void> {
  const entries = await histGetAll(db, itemId);
  for (const e of entries) await histDelete(db, e.hid!);
}

export async function histClear(db: IDBDatabase): Promise<void> {
  await withStore<void>(db, STORE_HISTORY, "readwrite", (s) => s.clear());
}

// ===== share log =====

export async function shareLogAdd(
  db: IDBDatabase,
  entry: Omit<ShareLogEntry, "slid">,
): Promise<number> {
  return withStore<number>(db, STORE_SHARE_LOG, "readwrite", (s) =>
    s.add(entry),
  );
}

export async function shareLogAll(
  db: IDBDatabase,
): Promise<ShareLogEntry[]> {
  return withStore<ShareLogEntry[]>(db, STORE_SHARE_LOG, "readonly", (s) =>
    s.getAll(),
  );
}

export async function shareLogDelete(
  db: IDBDatabase,
  slid: number,
): Promise<void> {
  await withStore<void>(db, STORE_SHARE_LOG, "readwrite", (s) => s.delete(slid));
}

export async function shareLogClear(db: IDBDatabase): Promise<void> {
  await withStore<void>(db, STORE_SHARE_LOG, "readwrite", (s) => s.clear());
}

// ── vault_keys (envelope DEK) ──────────────────────────────────────────────
export interface VaultKeyRecord {
  id: "dek";
  pw_env: string; // JSON dari PwEnvelope {v,salt,wrap}
  created_at: number;
}

export async function vaultKeysPut(rec: VaultKeyRecord): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VAULT_KEYS, "readwrite");
    tx.objectStore(STORE_VAULT_KEYS).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("vault_keys put failed"));
  });
}

export async function vaultKeysGet(): Promise<VaultKeyRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VAULT_KEYS, "readonly");
    const req = tx.objectStore(STORE_VAULT_KEYS).get("dek");
    tx.oncomplete = () => resolve((req.result as VaultKeyRecord) ?? null);
    tx.onerror = () => reject(tx.error ?? new Error("vault_keys get failed"));
  });
}

export async function vaultKeysClear(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VAULT_KEYS, "readwrite");
    tx.objectStore(STORE_VAULT_KEYS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("vault_keys clear failed"));
  });
}
