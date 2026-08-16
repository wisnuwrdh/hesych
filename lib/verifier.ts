// localStorage-backed salt + verifier helpers (client-only).

import { STORAGE_KEYS } from "./constants";
import {
  b64ToBuf,
  bufToB64,
  buildVerifier,
  checkVerifierBytes,
  deriveKey,
  type Bytes,
} from "./crypto";

export function getSalt(): Bytes {
  let s = localStorage.getItem(STORAGE_KEYS.vaultSalt);
  if (!s) {
    const arr = crypto.getRandomValues(new Uint8Array(32));
    s = bufToB64(arr);
    localStorage.setItem(STORAGE_KEYS.vaultSalt, s);
  }
  return b64ToBuf(s);
}

export function getVerifierMagic(): string {
  let m = localStorage.getItem(STORAGE_KEYS.vaultVerifierMagic);
  if (!m) {
    m = bufToB64(crypto.getRandomValues(new Uint8Array(16)));
    localStorage.setItem(STORAGE_KEYS.vaultVerifierMagic, m);
  }
  return m;
}

export function isFirstTime(): boolean {
  return !localStorage.getItem(STORAGE_KEYS.vaultVerifier);
}

export function getVerifierB64(): string | null {
  return localStorage.getItem(STORAGE_KEYS.vaultVerifier);
}

/** (Re)writes the verifier for the given derived key (used on setup + master-pw change). */
export async function writeVerifierForKey(
  key: CryptoKey,
): Promise<string> {
  const magic = getVerifierMagic();
  const verifierB64 = await buildVerifier(key, magic);
  localStorage.setItem(STORAGE_KEYS.vaultVerifier, verifierB64);
  return verifierB64;
}

export async function setVerifier(
  password: string,
  salt: Bytes,
): Promise<void> {
  const key = await deriveKey(password, salt);
  await writeVerifierForKey(key);
}

export async function checkVerifier(
  password: string,
  salt: Bytes,
): Promise<boolean> {
  const verifierB64 = getVerifierB64();
  if (!verifierB64) return false;
  try {
    const key = await deriveKey(password, salt);
    if (await checkVerifierBytes(key, getVerifierMagic(), verifierB64)) {
      return true;
    }
    // Legacy vaults used the constant magic "VAULT_OK" — accept and migrate.
    if (await checkVerifierBytes(key, "VAULT_OK", verifierB64)) {
      writeVerifierForKey(key).catch(() => {});
      return true;
    }
    return false;
  } catch {
    return false;
  }
}