import { describe, it, expect } from "vitest";
import {
  bufToB64,
  b64ToBuf,
  deriveKey,
  encryptWith,
  decryptWith,
  buildVerifier,
  checkVerifierBytes,
  encryptMetaValue,
  decryptMetaValue,
  isEncMeta,
} from "../lib/crypto";

describe("crypto base", () => {
  it("round-trips string ↔ base64", () => {
    const buf = new TextEncoder().encode("héllo wörld ✓");
    expect(b64ToBuf(bufToB64(buf))).toEqual(new Uint8Array(buf));
  });

  it("derives a deterministic key for same password+salt", async () => {
    const salt = new Uint8Array(32).fill(7);
    const k1 = await deriveKey("p@ss", salt);
    const k2 = await deriveKey("p@ss", salt);
    const x1 = await encryptWith(k1, "abc");
    const x2 = await encryptWith(k2, "abc");
    // AES-GCM is randomized → distinct ciphertexts, both decryptable.
    expect(x1).not.toBe(x2);
    expect(await decryptWith(k2, x1)).toBe("abc");
  });

  it("rejects wrong key on decrypt", async () => {
    const saltA = new Uint8Array(32).fill(1);
    const saltB = new Uint8Array(32).fill(2);
    const kA = await deriveKey("pw", saltA);
    const kB = await deriveKey("pw", saltB);
    const ct = await encryptWith(kA, "secret");
    await expect(decryptWith(kB, ct)).rejects.toThrow();
  });
});

describe("crypto metadata", () => {
  it("encrypts then decrypts JSON metadata", async () => {
    const key = await deriveKey("pw", new Uint8Array(32).fill(9));
    const b64 = await encryptMetaValue(key, { tags: ["a", "b"], n: 3 });
    const back = await decryptMetaValue<{ tags: string[]; n: number }>(
      key,
      b64,
      { tags: [], n: 0 },
    );
    expect(back).toEqual({ tags: ["a", "b"], n: 3 });
  });

  it("keeps legacy plaintext metadata when decryptMetaValue fails", async () => {
    const key = await deriveKey("pw", new Uint8Array(32).fill(9));
    // Pre-v6 rows stored plaintext category/tags → legacy decryptMeta returns
    // the fallback (lazy migration rewrites on next save).
    const back = await decryptMetaValue<string>(key, "gaming", "other");
    expect(back).toBe("other");
    expect(decryptMetaValue<string>(key, null, "other")).resolves.toBe("other");

    const enc = await decryptMetaValue<number[]>(key, "", [1]);
    expect(enc).toEqual([1]);
  });

  it("detects encrypted-meta blobs vs legacy plaintext", async () => {
    const key = await deriveKey("pw", new Uint8Array(32).fill(9));
    const blob = await encryptMetaValue(key, "gaming");
    expect(isEncMeta(blob)).toBe(true);
    expect(isEncMeta("gaming")).toBe(false);
    expect(isEncMeta(null)).toBe(false);
    expect(isEncMeta("a".repeat(24))).toBe(true); // 24+ base64-ish chars
  });
});

describe("verifier", () => {
  it("accepts the correct magic and rejects a wrong key", async () => {
    const key = await deriveKey("pw", new Uint8Array(32).fill(1));
    const magic = "test-magic-1234";
    const v = await buildVerifier(key, magic);
    expect(v.length).toBeGreaterThan(24);
    expect(await checkVerifierBytes(key, magic, v)).toBe(true);
    const other = await deriveKey("other", new Uint8Array(32).fill(1));
    expect(await checkVerifierBytes(other, magic, v)).toBe(false);
    expect(await checkVerifierBytes(key, "wrong-magic", v)).toBe(false);
    expect(await checkVerifierBytes(key, magic, null)).toBe(false);
  });
});