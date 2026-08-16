import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDB,
  __resetDBForTests,
  dbPutItem,
  dbClearItems,
  dbGetAll,
} from "../lib/db";
import { deriveKey, encryptWith, decryptWith, isEncMeta } from "../lib/crypto";
import {
  loadItems,
  migrateMetadata,
  buildEncryptedRow,
  decryptItemRow,
} from "../lib/vault";
import type { EncryptedVaultRow } from "../lib/types";

async function freshDB(): Promise<IDBDatabase> {
  __resetDBForTests();
  const db = await openDB();
  await dbClearItems(db).catch(() => {});
  return db;
}

function legacyV5Row(): EncryptedVaultRow {
  // Pre-v6 row: metadata fields are PLAINTEXT and _metaV is absent.
  return {
    title: "placeholder",
    username: "placeholder",
    password: "placeholder",
    notes: "",
    color: 2,
    favorite: true,
    totp_secret: "",
    custom_fields: [],
    category: "social",
    tags: ["work", "id"],
    breachStatus: 1,
    breachCheckedAt: 1723776000000,
    _metaV: 0,
    updatedAt: 1723776000000,
    createdAt: 1723776000000,
  };
}

describe("vault load/migrate/save (legacy compatibility)", () => {
  let db: IDBDatabase;
  const keyPromise = deriveKey("master-pw", new Uint8Array(32).fill(3));

  beforeEach(async () => {
    db = await freshDB();
  });
  afterEach(() => db.close());

  it("round-trips a v6 row through buildEncryptedRow → loadItems", async () => {
    const key = await keyPromise;
    const row = await buildEncryptedRow(
      key,
      {
        title: "GitHub",
        username: "dev@example.com",
        password: "s3cret",
        notes: "notes here",
        category: "work",
        totpRaw: "JBSWY3DPEHPK3PXP",
        favorite: false,
        tags: ["prod"],
        custom_fields: [{ name: "PIN", value: "1234", type: "password" }],
        keepPassword: false,
        resetBreach: true,
        breachStatus: undefined,
        breachCheckedAt: null,
      },
    );
    const id = await dbPutItem(db, row);

    const { items, needMigrate, failedCount } = await loadItems(db, key);
    expect(failedCount).toBe(0);
    expect(needMigrate).toHaveLength(0);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.id).toBe(id);
    expect(item.title).toBe("GitHub");
    expect(item.category).toBe("work");
    expect(item.tags).toEqual(["prod"]);
    // password stays ciphertext until requested
    expect(await decryptWith(key, item.password)).toBe("s3cret");
    expect(await decryptWith(key, item.totp_secret)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("loads legacy v5 rows and queues metadata migration", async () => {
    const key = await keyPromise;
    const legacy = legacyV5Row();
    legacy.title = await encryptWith(key, "Old Account");
    legacy.username = await encryptWith(key, "legacy@x.com");
    legacy.password = await encryptWith(key, "old-pw");
    const id = await dbPutItem(db, legacy);

    const { items, needMigrate } = await loadItems(db, key);
    expect(needMigrate).toContain(id);
    const item = items[0];
    expect(item.title).toBe("Old Account");
    expect(item.category).toBe("social"); // read plaintext directly
    expect(item.tags).toEqual(["work", "id"]);
    expect(item.breachStatus).toBe(1);

    await migrateMetadata(db, key, needMigrate);
    const rows = await dbGetAll(db);
    const migrated = rows[0];
    expect(migrated._metaV).toBe(6);
    expect(isEncMeta(migrated.category!)).toBe(true);
    expect(isEncMeta(migrated.tags!)).toBe(true);
  });

  it("keeps the ciphertext password on edit when keepPassword is set", async () => {
    const key = await keyPromise;
    const orig = await buildEncryptedRow(
      key,
      {
        title: "A", username: "u", password: "pw-1", notes: "", category: "other",
        totpRaw: "", favorite: false, tags: [], custom_fields: [],
        keepPassword: false, resetBreach: true, breachStatus: undefined, breachCheckedAt: null,
      },
    );
    const id = await dbPutItem(db, orig);
    const loaded = (await loadItems(db, key)).items[0];

    const updated = await buildEncryptedRow(
      key,
      {
        id,
        title: "A2", username: "u2", password: "pw-2", notes: "", category: "other",
        totpRaw: "", favorite: true, tags: [], custom_fields: [],
        keepPassword: true, resetBreach: false, breachStatus: 1, breachCheckedAt: 1,
      },
      loaded,
    );
    await dbPutItem(db, updated);

    const item2 = (await loadItems(db, key)).items[0];
    expect(await decryptWith(key, item2.password)).toBe("pw-1");
    expect(item2.title).toBe("A2");
    expect(item2.favorite).toBe(true);
  });

  it("decryptItemRow throws on wrong key", async () => {
    const key = await keyPromise;
    const row = await buildEncryptedRow(
      key,
      {
        title: "X", username: "u", password: "p", notes: "", category: "other",
        totpRaw: "", favorite: false, tags: [], custom_fields: [],
        keepPassword: false, resetBreach: true, breachStatus: undefined, breachCheckedAt: null,
      },
    );
    const wrong = await deriveKey("wrong", new Uint8Array(32).fill(3));
    await expect(decryptItemRow(wrong, row)).rejects.toThrow();
  });

  it("tolerates rows that fail to decrypt inside loadItems", async () => {
    const key = await keyPromise;
    const good = await buildEncryptedRow(
      key,
      {
        title: "Good", username: "u", password: "p", notes: "", category: "other",
        totpRaw: "", favorite: false, tags: [], custom_fields: [],
        keepPassword: false, resetBreach: true, breachStatus: undefined, breachCheckedAt: null,
      },
    );
    await dbPutItem(db, good);
    const bad = legacyV5Row();
    bad.title = "not-encrypted"; // will fail decrypt
    await dbPutItem(db, bad);

    const { items, failedCount } = await loadItems(db, key);
    expect(failedCount).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Good");
  });
});