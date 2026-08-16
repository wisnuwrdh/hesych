// Vault item loading/migration/saving — byte-compatible with legacy app.js.

import { ROW_META_V } from "./constants";
import {
  decryptWith,
  decryptMetaValue,
  encryptMetaValue,
  encryptWith,
  type VaultKey,
} from "./crypto";
import {
  dbGetAll,
  dbGetItem,
  dbPutItem,
  dbDeleteItem,
  histDeleteAllByItem,
} from "./db";
import type {
  Category,
  CustomField,
  EncryptedVaultRow,
  VaultItem,
} from "./types";

const CATEGORIES: readonly Category[] = [
  "social",
  "finance",
  "email",
  "work",
  "shopping",
  "gaming",
  "other",
];

function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

/** Decrypts one row into an in-memory item. Throws on decryption failure. */
export async function decryptItemRow(
  key: VaultKey,
  row: EncryptedVaultRow,
): Promise<VaultItem> {
  const title = await decryptWith(key, row.title);
  const username = await decryptWith(key, row.username);
  const password = row.password; // kept as ciphertext — decrypted on demand
  const notes = row.notes ? await decryptWith(key, row.notes) : "";
  const isV6 = row._metaV === ROW_META_V;

  let category: Category | null;
  let tags: string[];
  let breachStatus: number | undefined;
  let breachCheckedAt: number | null;
  if (isV6) {
    category = await decryptMetaValue<Category>(
      key,
      row.category as string | null,
      "other",
    );
    tags = await decryptMetaValue<string[]>(
      key,
      row.tags as string | null,
      [],
    );
    breachStatus = await decryptMetaValue<number | undefined>(
      key,
      row.breachStatus as string | null,
      undefined,
    );
    breachCheckedAt = await decryptMetaValue<number | null>(
      key,
      row.breachCheckedAt as string | null,
      null,
    );
  } else {
    category = isCategory(row.category) ? row.category : "other";
    tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
    breachStatus =
      typeof row.breachStatus === "number" ? row.breachStatus : undefined;
    breachCheckedAt = (row.breachCheckedAt as number | null) || null;
  }
  if (!isCategory(category)) category = "other";
  if (!Array.isArray(tags)) tags = [];

  return {
    id: row.id!,
    title,
    username,
    password,
    notes,
    color: row.color || 0,
    category,
    favorite: row.favorite || false,
    breachStatus: typeof breachStatus === "number" ? breachStatus : undefined,
    breachCheckedAt: breachCheckedAt || null,
    totp_secret: row.totp_secret || "",
    updatedAt: row.updatedAt || null,
    createdAt: row.createdAt || null,
    custom_fields: row.custom_fields || [],
    tags,
  };
}

export interface LoadResult {
  items: VaultItem[];
  /** Row ids that are pre-v6 and should be rewritten with encrypted metadata. */
  needMigrate: number[];
  failedCount: number;
}

/** Mirrors legacy loadItems(): decrypts all rows, tracks failed + to-migrate. */
export async function loadItems(
  db: IDBDatabase,
  key: VaultKey,
): Promise<LoadResult> {
  const rows = await dbGetAll(db);
  const items: VaultItem[] = [];
  const needMigrate: number[] = [];
  let failedCount = 0;

  const settled = await Promise.all(
    rows.map(async (row) => {
      try {
        const isV6 = row._metaV === ROW_META_V;
        const item = await decryptItemRow(key, row);
        if (!isV6) needMigrate.push(row.id!);
        return { ok: true as const, item };
      } catch (e) {
        console.warn("Failed to decrypt item", row.id, e);
        return { ok: false as const, id: row.id };
      }
    }),
  );

  for (const r of settled) {
    if (r.ok) items.push(r.item);
    else failedCount++;
  }
  return { items, needMigrate, failedCount };
}

/** Lazy metadata migration for pre-v6 rows (idempotent, abort-safe). */
export async function migrateMetadata(
  db: IDBDatabase,
  key: VaultKey,
  ids: number[],
): Promise<void> {
  for (const id of ids) {
    const row = await dbGetItem(db, id);
    if (!row || row._metaV === ROW_META_V) continue;
    try {
      const category = isCategory(row.category) ? row.category : "other";
      const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
      const breachStatus =
        typeof row.breachStatus === "number" ? row.breachStatus : undefined;
      const breachCheckedAt = row.breachCheckedAt || null;
      row.category = await encryptMetaValue(key, category);
      row.tags = await encryptMetaValue(key, tags);
      row.breachStatus = await encryptMetaValue(key, breachStatus);
      row.breachCheckedAt = await encryptMetaValue(key, breachCheckedAt);
      row._metaV = ROW_META_V;
      await dbPutItem(db, row);
    } catch (e) {
      console.warn("Metadata migration failed for item", id, e);
    }
  }
}

export interface ItemInput {
  id?: number;
  title: string;
  username: string;
  password: string;
  notes: string;
  category: Category;
  totpRaw: string;
  favorite: boolean;
  color?: number;
  tags: string[];
  custom_fields: CustomField[];
  keepPassword: boolean;
  resetBreach: boolean;
  breachStatus: number | null | undefined;
  breachCheckedAt: number | null;
}

/** Mirrors legacy saveItem(): builds a fully-encrypted v6 row. */
export async function buildEncryptedRow(
  key: VaultKey,
  input: ItemInput,
  existing?: VaultItem,
): Promise<EncryptedVaultRow> {
  const now = Date.now();
  const password = input.keepPassword && existing
    ? existing.password
    : await encryptWith(key, input.password);

  // Custom fields — encrypt each value.
  const encCF: CustomField[] = [];
  for (const f of input.custom_fields) {
    if (!f.name.trim()) continue;
    encCF.push({
      name: f.name.trim(),
      value: f.value ? await encryptWith(key, f.value) : "",
      type: f.type || "text",
    });
  }

  if (input.id !== undefined && existing) {
    const resetBreach = input.resetBreach;
    return {
      id: input.id,
      title: await encryptWith(key, input.title),
      username: await encryptWith(key, input.username),
      password,
      notes: input.notes ? await encryptWith(key, input.notes) : "",
      color: input.color ?? existing.color,
      category: await encryptMetaValue(key, input.category),
      favorite: input.favorite,
      breachStatus: await encryptMetaValue(
        key,
        resetBreach ? null : input.breachStatus !== undefined ? input.breachStatus : null,
      ),
      breachCheckedAt: await encryptMetaValue(
        key,
        resetBreach ? null : input.breachCheckedAt || null,
      ),
      totp_secret: input.totpRaw ? await encryptWith(key, input.totpRaw) : "",
      updatedAt: now,
      createdAt: existing.createdAt || now,
      custom_fields: encCF,
      tags: await encryptMetaValue(key, input.tags),
      _metaV: ROW_META_V,
    };
  }

  // New item.
  return {
    title: await encryptWith(key, input.title),
    username: await encryptWith(key, input.username),
    password: await encryptWith(key, input.password),
    notes: input.notes ? await encryptWith(key, input.notes) : "",
    color: input.color ?? Math.floor(Math.random() * 8),
    category: await encryptMetaValue(key, input.category),
    favorite: false,
    totp_secret: input.totpRaw ? await encryptWith(key, input.totpRaw) : "",
    updatedAt: now,
    createdAt: now,
    custom_fields: encCF,
    tags: await encryptMetaValue(key, input.tags),
    breachStatus: await encryptMetaValue(key, null),
    breachCheckedAt: await encryptMetaValue(key, null),
    _metaV: ROW_META_V,
  };
}

export type { EncryptedVaultRow };

// Re-export db ops used by the UI so the storage name stays canonical.
export async function vaultDeleteItem(
  db: IDBDatabase,
  id: number,
): Promise<void> {
  await histDeleteAllByItem(db, id);
  await dbDeleteItem(db, id);
}

/** Flips only the favorite flag on a row (plaintext, no re-encryption). */
export async function vaultSetFavorite(
  db: IDBDatabase,
  id: number,
  favorite: boolean,
): Promise<void> {
  const row = await dbGetItem(db, id);
  if (!row) throw new Error("item not found");
  row.favorite = favorite;
  await dbPutItem(db, row);
}