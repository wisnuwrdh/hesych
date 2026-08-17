import { describe, it, expect } from "vitest";
import { deriveKey } from "../lib/crypto";
import { buildEncryptedRow, decryptItemRow } from "../lib/vault";
import { openDB, __resetDBForTests, dbPutItem, dbClearItems, dbGetAll } from "../lib/db";
import { saveBreachResult } from "../lib/breach";
import { scanVaultHealth, levelForScore } from "../lib/health";

async function makeItem(
  key: Awaited<ReturnType<typeof deriveKey>>,
  db: IDBDatabase,
  title: string,
  password: string,
  opts: { breachStatus?: number; updatedAt?: number } = {},
): Promise<number> {
  const row = await buildEncryptedRow(key, {
    title, username: "u", password, notes: "",
    category: "other", totpRaw: "", favorite: false, tags: [],
    custom_fields: [], keepPassword: false,
    resetBreach: false, breachStatus: undefined, breachCheckedAt: null,
  });
  row.updatedAt = opts.updatedAt ?? Date.now();
  const id = await dbPutItem(db, row);
  if (opts.breachStatus !== undefined) {
    await saveBreachResult(db, key, id, opts.breachStatus, Date.now());
  }
  return id;
}

describe("vault health scan", () => {
  const salt = new Uint8Array(32).fill(17);
  const keyPromise = deriveKey("master-pw", salt);

  it("scores a healthy vault near 100", async () => {
    const key = await keyPromise;
    __resetDBForTests();
    const db = await openDB();
    try {
      await dbClearItems(db).catch(() => {});
      const id = await makeItem(key, db, "A", "Str0ng!Passw0rd-2026", {
        breachStatus: 1,
        updatedAt: Date.now(),
      });
      const items = await dbGetAll(db);
      const item = await decryptItemRow(key, items.find((r) => r.id === id)!);
      const report = await scanVaultHealth([item], key);
      expect(report.score).toBeGreaterThanOrEqual(85);
      expect(report.level).toBe("great");
      expect(report.breached).toBe(0);
      expect(report.weak).toBe(0);
      expect(report.oldCount).toBe(0);
      expect(report.dupExtra).toBe(0);
    } finally {
      db.close();
    }
  });

  it("penalizes breached, weak, old and reused passwords", async () => {
    const key = await keyPromise;
    __resetDBForTests();
    const db = await openDB();
    try {
      await dbClearItems(db).catch(() => {});
      const ids = [
        await makeItem(key, db, "Leaked", "secret1", { breachStatus: 2 }),
        await makeItem(key, db, "Weak", "abc", { breachStatus: 1 }),
        await makeItem(key, db, "Old", "Old-pass-9988", {
          breachStatus: 1,
          updatedAt: Date.now() - 400 * 24 * 3600 * 1000,
        }),
        await makeItem(key, db, "Dup1", "Same-Pass-123"),
        await makeItem(key, db, "Dup2", "Same-Pass-123"),
      ];
      const rows = await dbGetAll(db);
      const items = await Promise.all(
        ids.map((id) => decryptItemRow(key, rows.find((r) => r.id === id)!)),
      );
      const report = await scanVaultHealth(items, key);
      expect(report.breached).toBe(1);
      expect(report.weak).toBeGreaterThanOrEqual(1);
      expect(report.oldCount).toBe(1);
      expect(report.dupGroups).toHaveLength(1);
      expect(report.dupGroups[0].count).toBe(2);
      expect(report.dupExtra).toBe(1);
      expect(report.score).toBeLessThan(85);
      expect(report.score).toBeGreaterThanOrEqual(0);
    } finally {
      db.close();
    }
  });

  it("scores an empty vault as great", async () => {
    const report = await scanVaultHealth([], await keyPromise);
    expect(report.score).toBe(100);
    expect(report.level).toBe("great");
  });

  it("reports strength per item via the callback", async () => {
    const key = await keyPromise;
    __resetDBForTests();
    const db = await openDB();
    try {
      await dbClearItems(db).catch(() => {});
      const id = await makeItem(key, db, "Weak", "abc");
      const rows = await dbGetAll(db);
      const item = await decryptItemRow(key, rows.find((r) => r.id === id)!);
      const seen = new Map<number, number>();
      await scanVaultHealth([item], key, (i, s) => seen.set(i, s));
      expect(seen.get(id)).toBe(1);
    } finally {
      db.close();
    }
  });

  it("levelForScore maps thresholds", () => {
    expect(levelForScore(100)).toBe("great");
    expect(levelForScore(85)).toBe("great");
    expect(levelForScore(84)).toBe("good");
    expect(levelForScore(70)).toBe("good");
    expect(levelForScore(69)).toBe("fair");
    expect(levelForScore(50)).toBe("fair");
    expect(levelForScore(49)).toBe("poor");
  });
});