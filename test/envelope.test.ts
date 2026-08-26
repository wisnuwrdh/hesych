import { describe, expect, it } from "vitest";
import {
  createPasswordEnvelope,
  generateRawDek,
  importDek,
  unwrapWithPassword,
} from "../lib/envelope";
import { encryptWith, decryptWith } from "../lib/crypto";

describe("envelope", () => {
  it("menghasilkan DEK 32 byte", () => {
    const raw = generateRawDek();
    expect(raw).toBeInstanceOf(Uint8Array);
    expect(raw.length).toBe(32);
  });

  it("roundtrip: buka pw_wrap mengembalikan raw DEK persis", async () => {
    const raw = generateRawDek();
    const env = await createPasswordEnvelope("correct horse battery", raw);
    const out = await unwrapWithPassword(env, "correct horse battery");
    expect(new Uint8Array(out)).toEqual(raw);
  });

  it("password salah ditolak oleh auth tag GCM", async () => {
    const env = await createPasswordEnvelope("pw-benar", generateRawDek());
    await expect(unwrapWithPassword(env, "pw-salah")).rejects.toThrow();
  });

  it("salt unik per envelope", async () => {
    const raw = generateRawDek();
    const a = await createPasswordEnvelope("pw", raw);
    const b = await createPasswordEnvelope("pw", raw);
    expect(a.salt).not.toBe(b.salt);
  });

  it("DEK hasil import mengenkripsi/dekripsi seperti kunci biasa", async () => {
    const key = await importDek(generateRawDek());
    const ct = await encryptWith(key, "rahasia vault");
    expect(await decryptWith(key, ct)).toBe("rahasia vault");
  });

  it("raw DEK yang sama menghasilkan kunci ekuivalen (kompatibel item lama)", async () => {
    const raw = generateRawDek();
    const k1 = await importDek(raw);
    const k2 = await importDek(raw.slice());
    const ct = await encryptWith(k1, "data");
    expect(await decryptWith(k2, ct)).toBe("data");
  });
});
