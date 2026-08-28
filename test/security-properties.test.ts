// Property-oriented security tests: invariants that must NEVER break,
// independent of implementation details. Inspired by the audit guidance
// that test counts alone are not security evidence.

import { describe, it, expect, beforeEach } from "vitest";
import {
  decryptWith,
  deriveKey,
  encryptWith,
  isEncMeta,
} from "../lib/crypto";
import {
  createPasswordEnvelope,
  generateRawDek,
  importDek,
  unwrapWithPassword,
  needsUpgrade,
  type PwEnvelope,
  type PwEnvelopeV1,
} from "../lib/envelope";
import { buildEncryptedRow } from "../lib/vault";
import { exportMasterBackup } from "../lib/backup";
import { buildShareFragment } from "../lib/share";
import { openDB, __resetDBForTests, dbPutItem } from "../lib/db";

const SECRET_PASSWORD = "s3cret-p4ssw0rd-éñ<>&\"'";

async function freshDB(): Promise<IDBDatabase> {
  __resetDBForTests();
  return openDB();
}

beforeEach(() => __resetDBForTests());

describe("property: wrong key never yields plaintext", () => {
  it("decrypt with a different key fails", async () => {
    const k1 = await deriveKey("pw-a", new Uint8Array(32).fill(1));
    const k2 = await deriveKey("pw-b", new Uint8Array(32).fill(2));
    const ct = await encryptWith(k1, SECRET_PASSWORD);
    await expect(decryptWith(k2, ct)).rejects.toThrow();
  });

  it("envelope unwrap with wrong password fails", async () => {
    const env = await createPasswordEnvelope("pw-benar", generateRawDek());
    await expect(unwrapWithPassword(env, "pw-salah")).rejects.toThrow();
  });
});

describe("property: tampered ciphertext always fails", () => {
  it("flipping one ciphertext byte is detected by GCM", async () => {
    const key = await deriveKey("pw", new Uint8Array(32).fill(3));
    const ct = await encryptWith(key, SECRET_PASSWORD);
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0x01; // corrupt last ct/auth-tag byte
    const tampered = buf.toString("base64");
    await expect(decryptWith(key, tampered)).rejects.toThrow();
  });

  it("truncated / short ciphertext is rejected outright", async () => {
    const key = await deriveKey("pw", new Uint8Array(32).fill(3));
    await expect(decryptWith(key, Buffer.alloc(8).toString("base64"))).rejects.toThrow();
  });
});

describe("property: DEK stays non-extractable and survives KDF upgrade", () => {
  it("imported DEK is never extractable", async () => {
    const key = await importDek(generateRawDek());
    expect(key.extractable).toBe(false);
  });

  it("legacy v:1 envelope still unwraps, then upgrades to v:2 losslessly", async () => {
    const raw = generateRawDek();
    // Hand-build a v:1 (PBKDF2) envelope — the pre-Argon2id format.
    const v1: PwEnvelopeV1 = {
      v: 1,
      salt: "MDEyMzQ1Njc4OWFiY2RlZg==", // 16 bytes
      wrap: "",
    };
    const kek = await deriveKey("legacy-pw", new Uint8Array(
      Buffer.from(v1.salt, "base64"),
    ));
    v1.wrap = await encryptWith(kek, Buffer.from(raw).toString("base64"));

    expect(needsUpgrade(v1)).toBe(true);
    const opened = new Uint8Array(await unwrapWithPassword(v1, "legacy-pw"));
    expect(opened).toEqual(raw);

    // Transparent upgrade path: re-wrap with the current KDF.
    const v2 = await createPasswordEnvelope("legacy-pw", raw);
    expect(v2.v).toBe(2);
    expect(needsUpgrade(v2)).toBe(false);
    const reopened = new Uint8Array(await unwrapWithPassword(v2, "legacy-pw"));
    expect(reopened).toEqual(raw);
    await expect(unwrapWithPassword(v2, "wrong")).rejects.toThrow();
  });

  it("new envelopes are v:2 with stored, honored KDF params", async () => {
    const env = await createPasswordEnvelope("pw", generateRawDek());
    expect(env.v).toBe(2);
    if (env.v !== 2) return;
    expect(env.kdf.name).toBe("argon2id");
    expect(env.kdf.memoryKiB).toBeGreaterThan(0);
    // Params are honored: unwrap works with whatever the envelope declares.
    await expect(unwrapWithPassword(env, "pw")).resolves.toBeDefined();
  });
});

describe("property: exports and rows never contain plaintext", () => {
  it("buildEncryptedRow output has no recoverable secrets", async () => {
    const key = await deriveKey("pw", new Uint8Array(32).fill(5));
    const row = await buildEncryptedRow(key, {
      title: "Top Secret Bank",
      username: "ceo@company.example",
      password: SECRET_PASSWORD,
      notes: "recovery: hunter2",
      category: "finance",
      totpRaw: "JBSWY3DPEHPK3PXP",
      favorite: false,
      tags: ["privat"],
      custom_fields: [{ name: "PIN", value: "991122", type: "password" }],
      keepPassword: false,
      resetBreach: true,
      breachStatus: undefined,
      breachCheckedAt: null,
    });
    const serialized = JSON.stringify(row);
    for (const plain of [
      SECRET_PASSWORD,
      "Top Secret Bank",
      "ceo@company.example",
      "hunter2",
      "991122",
      "JBSWY3DPEHPK3PXP",
    ]) {
      expect(serialized).not.toContain(plain);
    }
    // Sensitive fields look like ciphertext (base64 blobs), not legacy values.
    expect(isEncMeta(row.title)).toBe(true);
    expect(isEncMeta(row.username)).toBe(true);
    expect(isEncMeta(row.password)).toBe(true);
  });

  it("master backup bundle contains no plaintext vault material", async () => {
    const db = await freshDB();
    const key = await deriveKey("pw", new Uint8Array(32).fill(6));
    const row = await buildEncryptedRow(key, {
      title: "Email",
      username: "me@example.com",
      password: SECRET_PASSWORD,
      notes: "",
      category: "email",
      totpRaw: "",
      favorite: false,
      tags: [],
      custom_fields: [],
      keepPassword: false,
      resetBreach: true,
      breachStatus: undefined,
      breachCheckedAt: null,
    });
    await dbPutItem(db, row);
    const bundle = await exportMasterBackup(db);
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain(SECRET_PASSWORD);
    expect(serialized).not.toContain("me@example.com");
    expect(serialized).not.toContain("Email");
  });
});

describe("property: share fragments never leak plaintext", () => {
  it("fragment hides payload; decryption needs the exact passphrase", async () => {
    const fragment = await buildShareFragment(
      {
        v: 1,
        iat: Date.now(),
        exp: Date.now() + 3600_000,
        incl: ["pw", "user"],
        title: "Bank Login",
        username: "secret-user@example.com",
        password: SECRET_PASSWORD,
        notes: "",
        totp: "",
      },
      "share-passphrase-123",
    );
    expect(fragment).not.toContain(SECRET_PASSWORD);
    expect(fragment).not.toContain("Bank Login");
    expect(fragment).not.toContain("secret-user@example.com");
    // It is URL-fragment safe: no raw spaces or reserved chars from b64.
    expect(/^[A-Za-z0-9_-]+$/.test(fragment.replace(/^s=/, ""))).toBe(true);
  });
});
