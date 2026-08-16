import { describe, it, expect, beforeEach } from "vitest";
import {
  isFirstTime,
  setVerifier,
  checkVerifier,
  getSalt,
  getVerifierMagic,
} from "../lib/verifier";
import { deriveKey, buildVerifier } from "../lib/crypto";
import { STORAGE_KEYS } from "../lib/constants";

beforeEach(() => localStorage.clear());

describe("salt / verifier", () => {
  it("reports first-time when no verifier exists", () => {
    expect(isFirstTime()).toBe(true);
  });

  it("salt is stable once created", () => {
    const s1 = b64strOf(getSalt());
    const s2 = b64strOf(getSalt());
    expect(s1).toBe(s2);
  });

  it("accepts correct password and rejects wrong one", async () => {
    await setVerifier("correct horse", getSalt());
    expect(isFirstTime()).toBe(false);
    expect(await checkVerifier("correct horse", getSalt())).toBe(true);
    expect(await checkVerifier("wrong", getSalt())).toBe(false);
  });

  it("migrates legacy constant-magic verifiers on success", async () => {
    // Legacy vaults (pre-random-magic) used the constant "VAULT_OK".
    localStorage.removeItem(STORAGE_KEYS.vaultVerifierMagic);
    const salt = getSalt();
    const key = await deriveKey("legacy", salt);
    const legacyVer = await buildVerifier(key, "VAULT_OK");
    localStorage.setItem(STORAGE_KEYS.vaultVerifier, legacyVer);

    expect(await checkVerifier("legacy", salt)).toBe(true);
    // Successful check rewrites the verifier with the new random magic.
    expect(getVerifierMagic()).not.toBe("VAULT_OK");
    expect(await checkVerifier("legacy", salt)).toBe(true);
    expect(await checkVerifier("wrong", salt)).toBe(false);
  });
});

function b64strOf(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}