// Master-password change: re-encrypts every vault object with a fresh key,
// byte-compatible with legacy doChangePw() (H8 fix: including TOTP secrets,
// custom fields, password history and share-log entries).

import { ROW_META_V } from "./constants";
import {
  decryptMetaValue,
  decryptWith,
  encryptMetaValue,
  encryptWith,
  type VaultKey,
} from "./crypto";
import {
  dbGetAll,
  dbPutItem,
  histAdd,
  histClear,
  histGetAllItems,
  shareLogAdd,
  shareLogAll,
  shareLogClear,
} from "./db";
import type { CustomField, EncryptedVaultRow } from "./types";

/** Re-encrypts a list of rows from oldKey to newKey (all fields + metadata). */
export async function reencryptRowList(
  oldKey: VaultKey,
  newKey: VaultKey,
  rows: EncryptedVaultRow[],
): Promise<EncryptedVaultRow[]> {
  const out: EncryptedVaultRow[] = [];
  for (const row of rows) {
    const isV6 = row._metaV === ROW_META_V;

    const title = await decryptWith(oldKey, row.title);
    const username = await decryptWith(oldKey, row.username);
    const notes = row.notes ? await decryptWith(oldKey, row.notes) : "";
    const password = row.password ? await decryptWith(oldKey, row.password) : "";
    const totp = row.totp_secret ? await decryptWith(oldKey, row.totp_secret) : "";

    let category = (row.category as unknown) ?? "other";
    let tags: string[] = [];
    let breachStatus: unknown = null;
    let breachCheckedAt: number | null = null;
    if (isV6) {
      category = await decryptMetaValue<string>(
        oldKey,
        row.category as string | null,
        "other",
      );
      tags = await decryptMetaValue<string[]>(
        oldKey,
        row.tags as string | null,
        [],
      );
      breachStatus = await decryptMetaValue<number | undefined>(
        oldKey,
        row.breachStatus as string | null,
        undefined,
      );
      breachCheckedAt = await decryptMetaValue<number | null>(
        oldKey,
        row.breachCheckedAt as string | null,
        null,
      );
    } else {
      category = row.category ?? "other";
      tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
      breachStatus = typeof row.breachStatus === "number" ? row.breachStatus : null;
      breachCheckedAt = row.breachCheckedAt != null ? (row.breachCheckedAt as number) : null;
    }

    const encCF: CustomField[] = [];
    for (const f of row.custom_fields || []) {
      if (!f.name) continue;
      const value = f.value ? await decryptWith(oldKey, f.value) : "";
      encCF.push({
        name: f.name,
        value: value ? await encryptWith(newKey, value) : "",
        type: f.type || "text",
      });
    }

    out.push({
      id: row.id,
      title: await encryptWith(newKey, title),
      username: await encryptWith(newKey, username),
      password: await encryptWith(newKey, password),
      notes: notes ? await encryptWith(newKey, notes) : "",
      color: row.color || 0,
      favorite: row.favorite || false,
      totp_secret: totp ? await encryptWith(newKey, totp) : "",
      custom_fields: encCF,
      category: await encryptMetaValue(newKey, category),
      tags: await encryptMetaValue(newKey, tags),
      breachStatus: await encryptMetaValue(newKey, breachStatus),
      breachCheckedAt: await encryptMetaValue(newKey, breachCheckedAt),
      _metaV: ROW_META_V,
      updatedAt: row.updatedAt ?? null,
      createdAt: row.createdAt ?? null,
    });
  }
  return out;
}

/** Re-encrypts all items + history + share log. Returns number of items. */
export async function reencryptVault(
  db: IDBDatabase,
  oldKey: VaultKey,
  newKey: VaultKey,
): Promise<number> {
  const rows = await dbGetAll(db);
  const newRows = await reencryptRowList(oldKey, newKey, rows);
  for (const row of newRows) await dbPutItem(db, row);

  // Re-encrypt password history.
  const history = await histGetAllItems(db);
  await histClear(db);
  for (const h of history) {
    const pw = h.encPassword ? await decryptWith(oldKey, h.encPassword) : "";
    if (pw) await histAdd(db, h.itemId, await encryptWith(newKey, pw));
  }

  // Re-encrypt share log.
  const share = await shareLogAll(db);
  await shareLogClear(db);
  for (const s of share) {
    let itemTitle = "";
    let link = "";
    try {
      itemTitle = s.itemTitle ? await decryptWith(oldKey, s.itemTitle) : "";
      link = s.link ? await decryptWith(oldKey, s.link) : "";
    } catch {
      // leave encrypted fields empty rather than dropping the row
    }
    await shareLogAdd(db, {
      itemTitle: itemTitle ? await encryptWith(newKey, itemTitle) : "",
      link: link ? await encryptWith(newKey, link) : "",
      createdAt: s.createdAt,
      expTs: s.expTs,
      itemId: s.itemId,
    });
  }

  return rows.length;
}