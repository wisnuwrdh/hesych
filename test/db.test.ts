import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDB,
  __resetDBForTests,
  dbGetAll,
  dbGetItem,
  dbPutItem,
  dbDeleteItem,
  dbClearItems,
  histGetAll,
  histAdd,
  histDelete,
  histDeleteAllByItem,
  shareLogAdd,
  shareLogAll,
  shareLogDelete,
} from "../lib/db";
import type { EncryptedVaultRow } from "../lib/types";

async function openFresh(): Promise<IDBDatabase> {
  __resetDBForTests();
  const db = await openDB();
  await dbClearItems(db).catch(() => {});
  return db;
}

function row(over: Partial<EncryptedVaultRow> = {}): EncryptedVaultRow {
  return {
    title: "x",
    username: "u",
    password: "p",
    notes: "",
    color: 0,
    favorite: false,
    totp_secret: "",
    custom_fields: [],
    category: null,
    tags: null,
    breachStatus: null,
    breachCheckedAt: null,
    _metaV: 6,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    ...over,
  };
}

describe("vaultdb items", () => {
  let db: IDBDatabase;
  beforeEach(async () => {
    db = await openFresh();
  });
  afterEach(() => db.close());

  it("creates the three legacy-compatible stores", () => {
    expect(Array.from(db.objectStoreNames).sort()).toEqual([
      "items",
      "pw_history",
      "share_log",
    ]);
  });

  it("put → get → getAll → delete round-trip", async () => {
    const id = await dbPutItem(db, row({ title: "GitHub" }));
    expect(id).toBeGreaterThan(0);
    const got = await dbGetItem(db, id);
    expect(got?.title).toBe("GitHub");
    expect(await dbGetAll(db)).toHaveLength(1);
    await dbDeleteItem(db, id);
    expect(await dbGetAll(db)).toHaveLength(0);
  });

  it("auto-increment ids do not collide", async () => {
    const a = await dbPutItem(db, row());
    const b = await dbPutItem(db, row());
    expect(a).not.toBe(b);
  });
});

describe("password history", () => {
  let db: IDBDatabase;
  beforeEach(async () => {
    db = await openFresh();
  });
  afterEach(() => db.close());

  it("enforces the 10-entry cap removing oldest first", async () => {
    const itemId = await dbPutItem(db, row());
    for (let i = 0; i < 12; i++) await histAdd(db, itemId, `enc-${i}`);
    const all = await histGetAll(db, itemId);
    expect(all).toHaveLength(10);
    // Oldest (0,1) evicted; newest present.
    expect(all.map((h) => h.encPassword)).not.toContain("enc-0");
    expect(all.map((h) => h.encPassword)).toContain("enc-11");
  });

  it("is scoped per item and deletable", async () => {
    const item1 = await dbPutItem(db, row());
    const item2 = await dbPutItem(db, row());
    await histAdd(db, item1, "one");
    await histAdd(db, item2, "two");
    await histDelete(db, (await histGetAll(db, item1))[0].hid!);
    expect(await histGetAll(db, item1)).toHaveLength(0);
    expect(await histGetAll(db, item2)).toHaveLength(1);
    await histDeleteAllByItem(db, item2);
    expect(await histGetAll(db, item2)).toHaveLength(0);
  });
});

describe("share log", () => {
  let db: IDBDatabase;
  beforeEach(async () => {
    db = await openFresh();
  });
  afterEach(() => db.close());

  it("adds, lists and removes entries", async () => {
    expect(await shareLogAll(db)).toHaveLength(0);
    const slid = await shareLogAdd(db, {
      itemId: 1,
      itemTitle: "Alias",
      link: "https://hesych.com/s/x",
      createdAt: Date.now(),
      expTs: Date.now() + 3600000,
    });
    expect((await shareLogAll(db))[0].slid).toBe(slid);
    await shareLogDelete(db, slid);
    expect(await shareLogAll(db)).toHaveLength(0);
  });
});