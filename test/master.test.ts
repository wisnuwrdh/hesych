import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDB,
  __resetDBForTests,
  dbPutItem,
  dbClearItems,
  dbGetAll,
  histAdd,
  histGetAll,
} from "../lib/db";
import { deriveKey } from "../lib/crypto";
import { buildEncryptedRow, loadItems, decryptItemRow } from "../lib/vault";
import { reencryptVault, reencryptRowList } from "../lib/master";

async function freshDB(): Promise<IDBDatabase> {
  __resetDBForTests();
  return openDB();
}

describe("master password change (re-encrypt)", () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    db = await freshDB();
    await dbClearItems(db).catch(() => {});
  });
  afterEach(() => db.close());

  it("re-encrypts all fields so the old key can no longer decrypt", async () => {
    const salt = new Uint8Array(32).fill(7);
    const oldKey = await deriveKey("old-master", salt);
    const newKey = await deriveKey("new-master", salt);

    const row = await buildEncryptedRow(oldKey, {
      title: "GitHub",
      username: "user",
      password: "s3cret!",
      notes: "keep",
      category: "work",
      totpRaw: "JBSWY3DPEHPK3PXP",
      favorite: false,
      tags: ["tip"],
      custom_fields: [{ name: "PIN", type: "password", value: "4821" }],
      keepPassword: false,
      resetBreach: false,
      breachStatus: undefined,
      breachCheckedAt: null,
    });
    await dbPutItem(db, row);

    await reencryptVault(db, oldKey, newKey);

    const rows = await dbGetAll(db);
    expect(rows).toHaveLength(1);
    await expect(decryptItemRow(oldKey, rows[0])).rejects.toThrow();
    const out = await decryptItemRow(newKey, rows[0]);
    expect(out.title).toBe("GitHub");
    expect(out.category).toBe("work");
  });

  it("keeps ids and reloads into VaultItems with the new key", async () => {
    const salt = new Uint8Array(32).fill(7);
    const oldKey = await deriveKey("old-master", salt);
    const newKey = await deriveKey("new-master", salt);

    const row = await buildEncryptedRow(oldKey, {
      title: "GitHub",
      username: "user",
      password: "s3cret!",
      notes: "",
      category: "work",
      totpRaw: "",
      favorite: true,
      tags: [],
      custom_fields: [],
      keepPassword: false,
      resetBreach: false,
      breachStatus: undefined,
      breachCheckedAt: null,
    });
    const id = await dbPutItem(db, { ...row, favorite: true });
    await histAdd(db, id, row.password);

    await reencryptVault(db, oldKey, newKey);

    const { items } = await loadItems(db, newKey);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(id);
    expect(items[0].title).toBe("GitHub");
    expect(items[0].favorite).toBe(true);

    const hist = await histGetAll(db, id);
    expect(hist).toHaveLength(1);
  });

  it("reencryptRowList preserves row metadata", async () => {
    const salt = new Uint8Array(32).fill(9);
    const a = await deriveKey("a", salt);
    const b = await deriveKey("b", salt);
    const row = await buildEncryptedRow(a, {
      title: "Mail",
      username: "m",
      password: "pw",
      notes: "",
      category: "email",
      totpRaw: "",
      favorite: false,
      tags: ["x"],
      custom_fields: [],
      keepPassword: false,
      resetBreach: false,
      breachStatus: undefined,
      breachCheckedAt: null,
    });
    const out = await reencryptRowList(a, b, [row]);
    expect(out[0].id).toBe(row.id);
    expect(out[0]._metaV).toBe(row._metaV);
    expect(out[0].favorite).toBe(false);
  });
});