import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDB,
  __resetDBForTests,
  dbPutItem,
  dbClearItems,
  dbGetAll,
} from "../lib/db";
import { deriveKey } from "../lib/crypto";
import { buildEncryptedRow, decryptItemRow } from "../lib/vault";
import {
  sha1Hex,
  parseRangeResponse,
  checkBreach,
  saveBreachResult,
  checkAllItems,
} from "../lib/breach";

function mockFetch(body: string, ok = true): typeof fetch {
  return (async () =>
    new Response(body, { status: ok ? 200 : 500 })) as unknown as typeof fetch;
}

async function freshDB(): Promise<IDBDatabase> {
  __resetDBForTests();
  const db = await openDB();
  await dbClearItems(db).catch(() => {});
  return db;
}

describe("HIBP breach check", () => {
  const salt = new Uint8Array(32).fill(13);
  const keyPromise = deriveKey("master-pw", salt);

  it("sha1Hex uppercases and pads correctly", async () => {
    // sha1("password") — well-known value
    expect(await sha1Hex("password")).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("parseRangeResponse finds the suffix and handles missing suffixes", () => {
    const body = "003D68EB55068C33ACE09247EE4C639306B:3\r\nD1B3770A5B9C0D1F1B5B1C3A9F2E5C8A6B7D4E1:4\r\n";
    expect(parseRangeResponse(body, "003d68eb55068c33ace09247ee4c639306b")).toBe(3);
    expect(parseRangeResponse(body, "DEADBEEF")).toBe(0);
    expect(parseRangeResponse("", "AAAA")).toBe(0);
  });

  it("checkBreach counts occurrences for the password's hash", async () => {
    const hash = await sha1Hex("correct horse battery staple");
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const body = `${suffix}:7\n${suffix.slice(1)}:1\nABCDEF0123456789:2\n`;
    const count = await checkBreach("correct horse battery staple", mockFetch(body));
    expect(count).toBe(7);
  });

  it("checkBreach returns 0 for a password absent from the range", async () => {
    const hash = await sha1Hex("never-breached-xyz");
    const suffix = hash.slice(5);
    const body = `${suffix.slice(1)}:1\n`;
    const count = await checkBreach("never-breached-xyz", mockFetch(body));
    expect(count).toBe(0);
  });

  it("checkBreach throws on a non-OK response", async () => {
    await expect(
      checkBreach("pw", mockFetch("", false)),
    ).rejects.toThrow("HIBP HTTP 500");
  });

  it("saveBreachResult persists encrypted meta that decryptItemRow reads back", async () => {
    const key = await keyPromise;
    const db = await freshDB();
    try {
      const row = await buildEncryptedRow(key, {
        title: "T", username: "u", password: "p", notes: "",
        category: "other", totpRaw: "", favorite: false, tags: [],
        custom_fields: [], keepPassword: false,
        resetBreach: false, breachStatus: undefined, breachCheckedAt: null,
      });
      const id = await dbPutItem(db, row);

      await saveBreachResult(db, key, id, 2, 12345);

      const rows = await dbGetAll(db);
      expect(rows).toHaveLength(1);
      const item = await decryptItemRow(key, rows[0]);
      expect(item.breachStatus).toBe(2);
      expect(item.breachCheckedAt).toBe(12345);
    } finally {
      db.close();
    }
  });

  it("checkAllItems checks each item and reports a summary", async () => {
    const key = await keyPromise;
    const db = await freshDB();
    try {
      const safe = await buildEncryptedRow(key, {
        title: "Safe", username: "u", password: "safepw", notes: "",
        category: "other", totpRaw: "", favorite: false, tags: [],
        custom_fields: [], keepPassword: false,
        resetBreach: false, breachStatus: undefined, breachCheckedAt: null,
      });
      const pwHash = await sha1Hex("safepw");
      const safeBody = `${pwHash.slice(5)}:0\n`;
      const breached = await buildEncryptedRow(key, {
        title: "Leaked", username: "u", password: "leakedpw", notes: "",
        category: "other", totpRaw: "", favorite: false, tags: [],
        custom_fields: [], keepPassword: false,
        resetBreach: false, breachStatus: undefined, breachCheckedAt: null,
      });
      const lkHash = await sha1Hex("leakedpw");
      const lkBody = `${lkHash.slice(5)}:9\n`;

      const fetcher = async (
        url: string,
        init?: RequestInit,
      ): Promise<Response> => {
        void init;
        const body = url.endsWith(pwHash.slice(0, 5)) ? safeBody : lkBody;
        return new Response(body, { status: 200 });
      };

      const safeId = await dbPutItem(db, safe);
      const leakedId = await dbPutItem(db, breached);
      const rows = await dbGetAll(db);
      const safeItem = await decryptItemRow(key, rows.find((r) => r.id === safeId)!);
      const leakedItem = await decryptItemRow(key, rows.find((r) => r.id === leakedId)!);

      const summary = await checkAllItems(
        db,
        key,
        [safeItem, leakedItem],
        fetcher as typeof fetch,
      );

      expect(summary).toEqual({ checked: 2, breached: 1, safe: 1, failed: 0 });

      const finalRows = await dbGetAll(db);
      const leaked = finalRows.find((r) => r.id === leakedId)!;
      const safeOut = await decryptItemRow(key, finalRows.find((r) => r.id === safeId)!);
      expect((await decryptItemRow(key, leaked)).breachStatus).toBe(2);
      expect(safeOut.breachStatus).toBe(1);
      expect(safeOut.breachCheckedAt).toBeTypeOf("number");
    } finally {
      db.close();
    }
  });
});
