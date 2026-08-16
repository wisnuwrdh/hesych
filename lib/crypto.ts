// Modern WebCrypto primitives, byte-compatible with the legacy Hesych vault:
//   - PBKDF2(SHA-256, 600_000)  →  AES-256-GCM
//   - ciphertext wire format: base64( iv(12) || ct )
//   - metadata fields: AES-GCM of JSON.stringify(value); null stays null
//
// All functions are key-parameterized and storage-agnostic so they are pure,
// testable, and safe against global-key races (see applyCloudVault in legacy).

import { AES_IV_LEN, PBKDF2_HASH, PBKDF2_ITERATIONS } from "./constants";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type VaultKey = CryptoKey;

// BufferSource-safe byte array (ArrayBuffer-backed, satisfies WebCrypto DB).
export type Bytes = Uint8Array<ArrayBuffer>;

export function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBuf(b64: string): Bytes {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

export async function deriveKey(
  password: string,
  salt: Bytes,
): Promise<VaultKey> {
  const km = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWith(key: VaultKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_LEN));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(text),
  );
  const buf = new Uint8Array(AES_IV_LEN + ct.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ct), AES_IV_LEN);
  return bufToB64(buf);
}

export async function decryptWith(key: VaultKey, b64: string): Promise<string> {
  const buf = b64ToBuf(b64);
  if (buf.byteLength <= AES_IV_LEN) throw new Error("invalid ciphertext");
  const iv = buf.slice(0, AES_IV_LEN);
  const ct = buf.slice(AES_IV_LEN);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return textDecoder.decode(pt);
}

// ===== Metadata helpers (category / tags / breachStatus / breachCheckedAt) =====

export async function encryptMetaValue(
  key: VaultKey,
  value: unknown,
): Promise<string | null> {
  if (value === null || value === undefined) return null;
  return encryptWith(key, JSON.stringify(value));
}

export async function decryptMetaValue<T>(
  key: VaultKey,
  b64: string | null | undefined,
  fallback: T,
): Promise<T> {
  if (b64 === null || b64 === undefined || b64 === "") return fallback;
  try {
    const pt = await decryptWith(key, b64);
    return JSON.parse(pt) as T;
  } catch {
    // Legacy plaintext (pre-v6), corrupt blob, or wrong key → fallback.
    // Lazy migration rewrites the row on next save.
    return fallback;
  }
}

/**
 * Heuristic: does this value look like an encrypted-meta blob (base64
 * ciphertext) rather than a legacy plaintext value? Mirrors the legacy check.
 */
export function isEncMeta(v: unknown): boolean {
  if (typeof v !== "string") return false;
  if (v.length < 24) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(v);
}

// ===== Verifier (password check without decrypting the vault) =====

export async function buildVerifier(
  key: VaultKey,
  magic: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_LEN));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(magic),
  );
  const buf = new Uint8Array(AES_IV_LEN + ct.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ct), AES_IV_LEN);
  return bufToB64(buf);
}

export async function checkVerifierBytes(
  key: VaultKey,
  magic: string,
  verifierB64: string | null,
): Promise<boolean> {
  if (!verifierB64) return false;
  try {
    const buf = b64ToBuf(verifierB64);
    if (buf.byteLength <= AES_IV_LEN) return false;
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buf.slice(0, AES_IV_LEN) },
      key,
      buf.slice(AES_IV_LEN),
    );
    return textDecoder.decode(pt) === magic;
  } catch {
    return false;
  }
}