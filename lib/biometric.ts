// Biometric orchestrator — PRF-based DEK unwrapping (clean-room, B2).
//
// Alur:
//   enable(dekRaw)  → register credential + assertion pertama → PRF output
//                     → wrapKey = HKDF(prfOutput) → bio_wrap = seal(dekRaw)
//   unlock()        → assertion dengan allowCredentials terdaftar → PRF output
//                     → unwrap bio_wrap → kembalikan raw DEK
//
// Semua data (cred_id, iv, ct) tersimpan lokal di IndexedDB store
// vault_keys sebagai satu record id="bio_map". Zero-knowledge tetap.

import { decryptWith, encryptWith } from "./crypto";
import {
  getCredentialAssertion,
  registerCredential,
  type AssertionResult,
} from "./webauthn";

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface BioEntry {
  /** base64url credential id */
  cred_id: string;
  /** b64(iv || AES-GCM(wrapKey, dekRaw)) */
  ct: string;
  created_at: number;
}

export interface BioMapRecord {
  id: "bio_map";
  wraps: BioEntry[];
}

const APP_SALT = enc.encode("hesych-bio-wrap-v1") as Uint8Array<ArrayBuffer>;

export function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** HKDF-SHA256 dari PRF output → kunci unwrap 32 byte. */
async function deriveWrapKey(prfOutput: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: APP_SALT, info: APP_SALT },
    base,
    256,
  );
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Enkripsi dekRaw dengan kunci turunan PRF → string b64(iv||ct). */
async function sealDek(
  wrapKey: CryptoKey,
  dekRaw: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const buf = await encryptWith(wrapKey, Buffer.from(dekRaw).toString("base64"));
  return buf;
}

/** Kebalikan sealDek. */
async function openDek(
  wrapKey: CryptoKey,
  payload: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const b64 = await decryptWith(wrapKey, payload);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Aktifkan biometrik: registrasi kredensial platform + simpan DEK
 * terbungkus PRF. Mengembalikan hasil yang jujur (termasuk dibatalkan).
 */
export async function enableBiometrics(dekRaw: Uint8Array<ArrayBuffer>): Promise<
  | { ok: true; credId: string; prfSupported: boolean }
  | { ok: false; reason: "canceled" | "no-prf" | "failed"; detail?: string }
> {
  const reg = await registerCredential("Hesych");
  if (!reg.ok || !reg.credId) {
    return {
      ok: false,
      reason: reg.canceled ? "canceled" : "failed",
      detail: reg.errorName,
    };
  }

  // Assertion pertama untuk mendapatkan PRF output.
  const assert: AssertionResult = await getCredentialAssertion({
    credIds: [reg.credId],
    requestPrf: true,
  });
  if (!assert.ok || !assert.prfOutput) {
    return { ok: false, reason: "no-prf", detail: assert.errorName };
  }

  const wrapKey = await deriveWrapKey(assert.prfOutput);
  const entry: BioEntry = {
    cred_id: reg.credId,
    ct: await sealDek(wrapKey, dekRaw),
    created_at: Date.now(),
  };

  // Simpan/merge ke record peta.
  const existing = await loadBioMap();
  existing.wraps = existing.wraps.filter((w) => w.cred_id !== entry.cred_id);
  existing.wraps.push(entry);
  await saveBioMap(existing);

  return { ok: true, credId: reg.credId, prfSupported: true };
}

/** Hapus satu kredensial biometrik. */
export async function disableBiometric(credId: string): Promise<void> {
  const rec = await loadBioMap();
  rec.wraps = rec.wraps.filter((w) => w.cred_id !== credId);
  await saveBioMap(rec);
}

/** Daftar semua kredensial terdaftar. */
export async function listBiometrics(): Promise<BioEntry[]> {
  return (await loadBioMap()).wraps;
}

export interface UnlockResult {
  ok: boolean;
  canceled?: boolean;
  raw?: Uint8Array<ArrayBuffer>;
}

/**
 * Unlock via biometrik: assertion dengan kredensial terdaftar → PRF →
 * buka bungusan DEK. Mengembalikan raw DEK untuk di-import pemanggil.
 */
export async function unlockWithBiometrics(): Promise<UnlockResult> {
  const wraps = await listBiometrics();
  if (wraps.length === 0) return { ok: false };

  const res = await getCredentialAssertion({
    credIds: wraps.map((w) => w.cred_id),
    requestPrf: true,
  });
  if (!res.ok) {
    return { ok: false, canceled: res.canceled };
  }

  const entry = wraps.find((w) => w.cred_id === res.credId);
  if (!entry) {
    // authenticator memilih kredensial yang tidak kita kenal — coba cocokkan
    return { ok: false };
  }

  try {
    const wrapKey = await deriveWrapKey(res.prfOutput!);
    const raw = await openDek(wrapKey, entry.ct);
    return { ok: true, raw };
  } catch {
    return { ok: false };
  }
}

// ── IDB helpers (record tunggal id="bio_map") ─────────────────────────────

async function loadBioMap(): Promise<BioMapRecord> {
  const db = await import("./db").then((m) => m.openDB());
  return new Promise((resolve) => {
    const tx = db.transaction("vault_keys", "readonly");
    const req = tx.objectStore("vault_keys").get("bio_map");
    tx.oncomplete = () =>
      resolve((req.result as BioMapRecord) ?? { id: "bio_map", wraps: [] });
    tx.onerror = () => resolve({ id: "bio_map", wraps: [] });
  });
}

async function saveBioMap(rec: BioMapRecord): Promise<void> {
  const db = await import("./db").then((m) => m.openDB());
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("vault_keys", "readwrite");
    tx.objectStore("vault_keys").put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("bio_map save failed"));
  });
}

// re-export agar modul lain bisa pakai decoder konsisten
export { dec };
