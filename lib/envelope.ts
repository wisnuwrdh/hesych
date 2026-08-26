// Envelope encryption core - DEK (Data Encryption Key) model.
//
//   DEK (32B acak)  → mengenkripsi seluruh item vault
//   PW_WRAP         = AES-GCM( PBKDF2-SHA256(pw, salt, 600k) , DEK )
//
// Password salah = kegagalan auth tag GCM saat unwrap (tanpa verifier
// terpisah). Zero-knowledge: seluruh bungusan tersimpan lokal (IndexedDB).

import {
  b64ToBuf,
  bufToB64,
  deriveKey,
  decryptWith,
  encryptWith,
  type Bytes,
} from "./crypto";

export interface PwEnvelope {
  v: 1;
  salt: string; // b64
  wrap: string; // b64(iv || ct) dari bufToB64(rawDEK)
}

/** Raw bytes acak untuk DEK baru. */
export function generateRawDek(): Bytes {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** Buat envelope password dari raw DEK. Salt baru dibuat di sini. */
export async function createPasswordEnvelope(
  password: string,
  rawDek: Bytes,
): Promise<PwEnvelope> {
  const saltBuf = crypto.getRandomValues(new Uint8Array(16));
  const salt = bufToB64(saltBuf);
  const kek = await deriveKey(password, b64ToBuf(salt));
  const wrap = await encryptWith(kek, bufToB64(rawDek));
  return { v: 1, salt, wrap };
}

/**
 * Buka PW_WRAP menggunakan password.
 * Melempar Error (OPERATION/decrypt gagal) bila password salah.
 */
export async function unwrapWithPassword(
  env: PwEnvelope,
  password: string,
): Promise<Bytes> {
  const kek = await deriveKey(password, b64ToBuf(env.salt));
  const b64 = await decryptWith(kek, env.wrap);
  return b64ToBuf(b64);
}

/** Import raw DEK menjadi CryptoKey operasional (non-extractable). */
export async function importDek(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
