// Envelope encryption core - DEK (Data Encryption Key) model.
//
//   DEK (32B acak)  → mengenkripsi seluruh item vault
//   PW_WRAP         = AES-GCM( KDF(password, salt) , DEK )
//
//   v:1  KDF = PBKDF2-SHA256, 600k iterasi (vault lama, tetap didukung)
//   v:2  KDF = Argon2id — parameter tersimpan di dalam envelope sehingga
//        bisa disetel ulang tanpa format change di masa depan.
//
// Password salah = kegagalan auth tag GCM saat unwrap (tanpa verifier
// terpisah). Zero-knowledge: seluruh bungusan tersimpan lokal (IndexedDB).

import { argon2id } from "hash-wasm";
import {
  b64ToBuf,
  bufToB64,
  decryptWith,
  deriveKey,
  encryptWith,
  type Bytes,
  type VaultKey,
} from "./crypto";

export interface PwEnvelopeV1 {
  v: 1;
  salt: string; // b64
  wrap: string; // b64(iv || ct) dari bufToB64(rawDEK)
}

export interface PwEnvelopeV2 {
  v: 2;
  salt: string; // b64
  wrap: string; // b64(iv || ct) dari bufToB64(rawDEK)
  kdf: {
    name: "argon2id";
    memoryKiB: number;
    iterations: number;
    parallelism: number;
  };
}

export type PwEnvelope = PwEnvelopeV1 | PwEnvelopeV2;

/** Parameter Argon2id untuk envelope baru (RFC 9106-aligned). */
export const ARGON2ID_PARAMS = {
  memoryKiB: 65536,
  iterations: 3,
  parallelism: 1,
} as const;

/** Raw bytes acak untuk DEK baru. */
export function generateRawDek(): Bytes {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** KDF apapun → AES-GCM KEK (non-extractable) untuk wrap/unwrap DEK. */
async function importKek(raw: Bytes): Promise<VaultKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Argon2id(password, salt) → KEK operasional. */
async function deriveKekArgon2id(
  password: string,
  saltBuf: Bytes,
  params: { memoryKiB: number; iterations: number; parallelism: number },
): Promise<VaultKey> {
  const hash = await argon2id({
    password,
    salt: saltBuf,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: 32,
    outputType: "binary",
  });
  // Copy into an ArrayBuffer-backed view (hash-wasm returns ArrayBufferLike).
  return importKek(new Uint8Array(hash));
}

/** Buat envelope password dari raw DEK. Salt baru dibuat di sini. Selalu v:2. */
export async function createPasswordEnvelope(
  password: string,
  rawDek: Bytes,
): Promise<PwEnvelopeV2> {
  const saltBuf = crypto.getRandomValues(new Uint8Array(16));
  const salt = bufToB64(saltBuf);
  const kek = await deriveKekArgon2id(password, saltBuf, ARGON2ID_PARAMS);
  const wrap = await encryptWith(kek, bufToB64(rawDek));
  return {
    v: 2,
    salt,
    wrap,
    kdf: { name: "argon2id", ...ARGON2ID_PARAMS },
  };
}

/**
 * Buka PW_WRAP menggunakan password. Mendukung envelope lama (v:1 PBKDF2)
 * dan baru (v:2 Argon2id).
 * Melempar Error (OPERATION/decrypt gagal) bila password salah.
 */
export async function unwrapWithPassword(
  env: PwEnvelope,
  password: string,
): Promise<Bytes> {
  const kek =
    env.v === 2
      ? await deriveKekArgon2id(
          password,
          b64ToBuf(env.salt),
          env.kdf,
        )
      : await deriveKey(password, b64ToBuf(env.salt));
  const b64 = await decryptWith(kek, env.wrap);
  return b64ToBuf(b64);
}

/** True untuk envelope PBKDF2 lama — kandidat upgrade transparan ke v:2. */
export function needsUpgrade(env: PwEnvelope): env is PwEnvelopeV1 {
  return env.v === 1;
}

/** Import raw DEK menjadi CryptoKey operasional (non-extractable). */
export async function importDek(raw: Bytes): Promise<CryptoKey> {
  return importKek(raw);
}
