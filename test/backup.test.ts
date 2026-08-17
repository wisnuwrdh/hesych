import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDB,
  __resetDBForTests,
  dbPutItem,
  dbGetAll,
  dbClearItems,
} from "../lib/db";
import { deriveKey } from "../lib/crypto";
import { buildEncryptedRow, loadItems } from "../lib/vault";
import {
  exportMasterBackup,
  exportCustomBackup,
  importBackup,
} from "../lib/backup";
import { getSalt } from "../lib/verifier";
import { bufToB64 } from "../lib/crypto";

async function freshDB(): Promise<IDBDatabase> {
  __resetDBForTests();
  const db = await openDB();
  await dbClearItems(db).catch(() => {});
  return db;
}

describe("encrypted backup", () => {
  const salt = new Uint8Array(32).fill(11);
  const keyPromise = deriveKey("master-pw", salt);

  beforeEach(async () => {
    __resetDBForTests();
  });

  it("exports/imports a master-mode bundle on the same vault salt", async () => {
    const key = await keyPromise;
    const db = await freshDB();
    try {
      const row = await buildEncryptedRow(key, {
        title: "GitHub",
        username: "user",
        password: "s3cret!",
        notes: "n",
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
      await dbPutItem(db, row);

      const bundle = await exportMasterBackup(db);
      expect(bundle.pwMode).toBe("master");
      expect(bundle.salt).toBe(bufToB64(getSalt()));

      // fresh DB, restore
      await dbClearItems(db);
      const res = await importBackup(db, bundle, key, "replace");
      expect(res.count).toBe(1);
      const { items } = await loadItems(db, key);
      expect(items[0].title).toBe("GitHub");
    } finally {
      db.close();
    }
  });

  it("merges without overwriting existing ids", async () => {
    const key = await keyPromise;
    const db = await freshDB();
    try {
      const a = await buildEncryptedRow(key, {
        title: "A", username: "u", password: "p1", notes: "", category: "other",
        totpRaw: "", favorite: false, tags: [], custom_fields: [], keepPassword: false,
        resetBreach: false, breachStatus: undefined, breachCheckedAt: null,
      });
      await dbPutItem(db, a);
      const b = await buildEncryptedRow(key, {
        title: "B", username: "u", password: "p2", notes: "", category: "other",
        totpRaw: "", favorite: false, tags: [], custom_fields: [], keepPassword: false,
        resetBreach: false, breachStatus: undefined, breachCheckedAt: null,
      });
      await dbPutItem(db, b);

      const bundle = await exportMasterBackup(db);

      // both ids already exist → merge adds nothing
      const resMerge = await importBackup(db, bundle, key, "merge");
      expect(resMerge.count).toBe(0);
      const { items } = await loadItems(db, key);
      expect(items.map((i) => i.title).sort()).toEqual(["A", "B"]);
    } finally {
      db.close();
    }
  });

  it("custom-password round-trip restores on any vault salt", async () => {
    const key = await keyPromise;
    const db = await freshDB();
    try {
      const row = await buildEncryptedRow(key, {
        title: "CustomBackup", username: "u", password: "secret!", notes: "x",
        category: "finance", totpRaw: "JBSWY3DPEHPK3PXP", favorite: false,
        tags: ["t"], custom_fields: [{ name: "k", type: "text", value: "v" }],
        keepPassword: false,
        resetBreach: false,
        breachStatus: undefined,
        breachCheckedAt: null,
      });
      await dbPutItem(db, row);

      const bundle = await exportCustomBackup(db, key, "backup-pass");
      expect(bundle.pwMode).toBe("custom");
      expect(bundle.data).toBeTypeOf("string");

      await dbClearItems(db);
      const res = await importBackup(db, bundle, key, "replace", "backup-pass");
      expect(res.count).toBe(1);
      const { items } = await loadItems(db, key);
      expect(items[0].title).toBe("CustomBackup");
      expect(items[0].category).toBe("finance");
      expect(items[0].tags).toEqual(["t"]);
    } finally {
      db.close();
    }
  });

  it("custom-password import rejects a wrong password", async () => {
    const key = await keyPromise;
    const db = await freshDB();
    try {
      const row = await buildEncryptedRow(key, {
        title: "G", username: "u", password: "p", notes: "", category: "other",
        totpRaw: "", favorite: false, tags: [], custom_fields: [], keepPassword: false,
        resetBreach: false, breachStatus: undefined, breachCheckedAt: null,
      });
      await dbPutItem(db, row);
      const bundle = await exportCustomBackup(db, key, "right-pass");
      await expect(importBackup(db, bundle, key, "replace", "wrong-pass"))
        .rejects.toThrow("Wrong password");
    } finally {
      db.close();
    }
  });
});