// WebAuthn biometric unlock + PRF session handling (client-only).
//
// SECURITY (C1/H2 review fix): bio sessions live in sessionStorage ONLY with a
// 30-minute TTL, and the PRF path derives the wrapping key per-assertion and
// never stores it (no vault_bio_key). The legacy stored-key (non-PRF) path is
// kept only for authenticators without PRF support; `PRF_ONLY` can be flipped
// to enforce PRF-only sessions, in which case the fallback is disabled.

import { STORAGE_KEYS } from "./constants";
import { b64ToBuf, bufToB64, type Bytes } from "./crypto";

export const BIO_RP_NAME = "Hesych";
export const PRF_INPUT = new TextEncoder().encode("hesych-vault-session-key-v1");
export const BIO_SESSION_TTL_MS = 30 * 60 * 1000;

/** Flip to `true` to disable the stored-key fallback entirely (PRF-only). */
export const PRF_ONLY = false;

export type PrfOutput = ArrayBuffer;

export function isBiometricSupported(): boolean {
  return !!(
    typeof window !== "undefined" &&
    (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential &&
    navigator.credentials &&
    (navigator.credentials as { create?: unknown }).create
  );
}

export function isBiometricEnabled(): boolean {
  return !!(
    localStorage.getItem(STORAGE_KEYS.bioCredId) &&
    localStorage.getItem(STORAGE_KEYS.bioEnabled)
  );
}

export function getCredIdB64(): string | null {
  return localStorage.getItem(STORAGE_KEYS.bioCredId);
}

export function isPrfEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEYS.bioPrf) === "1";
}

export interface BioSessionInfo {
  exists: boolean;
  prfSession: boolean;
}

export function hasBioSession(): BioSessionInfo {
  if (!isBiometricEnabled()) return { exists: false, prfSession: false };
  if (PRF_ONLY && !isPrfEnabled()) return { exists: false, prfSession: false };
  const encB64 = sessionStorage.getItem(STORAGE_KEYS.bioSession);
  if (!encB64) return { exists: false, prfSession: false };
  const expiry = parseInt(sessionStorage.getItem(STORAGE_KEYS.bioExpiry) || "0");
  if (Date.now() > expiry) {
    clearBioSession();
    return { exists: false, prfSession: false };
  }
  const prfEnabled = isPrfEnabled();
  const bioKey = sessionStorage.getItem(STORAGE_KEYS.bioKey);
  // PRF session: no stored key → derived per-assertion.
  const prfSession = prfEnabled && !bioKey;
  const exists = PRF_ONLY ? prfSession : prfSession || !!bioKey;
  return { exists, prfSession };
}

/** Store the wrapped master password under a PRF-derived key (never stored). */
async function encryptWithAesKey(rawKey: Bytes, plaintext: string): Promise<string> {
  const aesKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext));
  const payload = new Uint8Array(iv.length + ct.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ct), iv.length);
  return bufToB64(payload);
}

/**
 * After a successful password unlock, wrap the master password so biometric
 * unlock can re-derive it later. Prefers the PRF path when the authenticator
 * supports it; falls back to the legacy stored-key path otherwise (disabled
 * when PRF_ONLY). Mirrors legacy setBioSession({ forceLegacy }).
 */
export async function setBioSession(
  password: string,
  credIdB64ForPrf: string | null,
  prfEnabled: boolean,
  { forceLegacy = false } = {},
): Promise<void> {
  const usePrf = !forceLegacy && prfEnabled && credIdB64ForPrf;
  if (usePrf) {
    const credId = credIdB64ForPrf!;
    try {
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: b64ToBuf(credId), type: "public-key" }],
          userVerification: "required",
          timeout: 60000,
          extensions: { prf: { eval: { first: PRF_INPUT } } },
        },
      })) as PublicKeyCredential;
      const prfOutput =
        assertion.getClientExtensionResults().prf?.results?.first as
          | ArrayBuffer
          | null;
      if (prfOutput && prfOutput.byteLength >= 32) {
        const b64 = await encryptWithAesKey(new Uint8Array(prfOutput), password);
        sessionStorage.setItem(STORAGE_KEYS.bioSession, b64);
        sessionStorage.removeItem(STORAGE_KEYS.bioKey); // key NOT stored on PRF path
        sessionStorage.setItem(STORAGE_KEYS.bioExpiry, (Date.now() + BIO_SESSION_TTL_MS).toString());
        localStorage.removeItem(STORAGE_KEYS.bioSession);
        localStorage.removeItem(STORAGE_KEYS.bioKey);
        localStorage.removeItem(STORAGE_KEYS.bioExpiry);
        return;
      }
    } catch {
      // PRF assertion failed/cancelled → legacy path (or nothing if PRF_ONLY)
    }
  }
  if (PRF_ONLY) return;
  try {
    const sessionKey = crypto.getRandomValues(new Uint8Array(32));
    const b64 = await encryptWithAesKey(sessionKey, password);
    sessionStorage.setItem(STORAGE_KEYS.bioSession, b64);
    sessionStorage.setItem(STORAGE_KEYS.bioKey, bufToB64(sessionKey));
    sessionStorage.setItem(STORAGE_KEYS.bioExpiry, (Date.now() + BIO_SESSION_TTL_MS).toString());
    localStorage.removeItem(STORAGE_KEYS.bioSession);
    localStorage.removeItem(STORAGE_KEYS.bioKey);
    localStorage.removeItem(STORAGE_KEYS.bioExpiry);
  } catch {}
}

/** Refresh a PRF session using an already-obtained prfOutput (no 2nd assertion). */
export async function refreshPrfSession(password: string, prfOutput: PrfOutput): Promise<void> {
  try {
    const b64 = await encryptWithAesKey(new Uint8Array(prfOutput), password);
    sessionStorage.setItem(STORAGE_KEYS.bioSession, b64);
    sessionStorage.removeItem(STORAGE_KEYS.bioKey);
    sessionStorage.setItem(STORAGE_KEYS.bioExpiry, (Date.now() + BIO_SESSION_TTL_MS).toString());
    localStorage.removeItem(STORAGE_KEYS.bioSession);
    localStorage.removeItem(STORAGE_KEYS.bioKey);
    localStorage.removeItem(STORAGE_KEYS.bioExpiry);
  } catch {
    // Refresh failed → existing session stays valid until expiry
  }
}

export async function getLegacyBioSession(): Promise<string | null> {
  const keyB64 = sessionStorage.getItem(STORAGE_KEYS.bioKey);
  const encB64 = sessionStorage.getItem(STORAGE_KEYS.bioSession);
  const expiry = parseInt(sessionStorage.getItem(STORAGE_KEYS.bioExpiry) || "0");
  if (!keyB64 || !encB64) return null;
  if (Date.now() > expiry) {
    clearBioSession();
    return null;
  }
  try {
    const sessionKey = b64ToBuf(keyB64);
    const payload = b64ToBuf(encB64);
    const iv = payload.slice(0, 12);
    const ct = payload.slice(12);
    const aesKey = await crypto.subtle.importKey("raw", sessionKey, { name: "AES-GCM" }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export function clearBioSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.bioSession);
  sessionStorage.removeItem(STORAGE_KEYS.bioKey);
  sessionStorage.removeItem(STORAGE_KEYS.bioExpiry);
  localStorage.removeItem(STORAGE_KEYS.bioSession);
  localStorage.removeItem(STORAGE_KEYS.bioKey);
  localStorage.removeItem(STORAGE_KEYS.bioExpiry);
}

export interface RegisterResult {
  ok: boolean;
  canceled?: boolean;
  /** true when the platform authenticator supports PRF (stored in bioPrf). */
  prfSupported?: boolean;
  errorName?: string;
}

export async function registerBiometric(): Promise<RegisterResult> {
  if (!isBiometricSupported()) return { ok: false, errorName: "unsupported" };
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { id: location.hostname || "localhost", name: BIO_RP_NAME },
        user: { id: userId, name: "vault-user", displayName: "Vault User" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        extensions: { prf: {} },
      },
    })) as PublicKeyCredential;
    if (!cred) return { ok: false, errorName: "not-created" };
    const prfSupported = !!(cred.getClientExtensionResults().prf?.enabled);
    localStorage.setItem(STORAGE_KEYS.bioCredId, bufToB64(new Uint8Array(cred.rawId)));
    localStorage.setItem(STORAGE_KEYS.bioEnabled, "1");
    localStorage.setItem(STORAGE_KEYS.bioPrf, prfSupported ? "1" : "0");
    return { ok: true, prfSupported };
  } catch (e) {
    const err = e as { name?: string };
    return {
      ok: false,
      canceled: err.name === "NotAllowedError",
      errorName: err.name,
    };
  }
}

export async function disableBiometric(): Promise<void> {
  localStorage.removeItem(STORAGE_KEYS.bioCredId);
  localStorage.removeItem(STORAGE_KEYS.bioEnabled);
  localStorage.removeItem(STORAGE_KEYS.bioPrf);
  clearBioSession();
}

export interface BioUnlockResult {
  ok: boolean;
  password: string | null;
  /** Present on the PRF path so the session can be refreshed without a 2nd assertion. */
  prfOutput: PrfOutput | null;
  isPrfSession: boolean;
  expiredCanceled?: boolean;
  errorName?: string;
}

/**
 * Fetches the wrapped password: PRF path derives the wrapping key from the
 * assertion, legacy path decrypts the stored session key. Mirrors legacy
 * unlockWithBiometric minus UI/DOM side effects.
 */
export async function unlockWithBiometric(): Promise<BioUnlockResult> {
  if (!isBiometricEnabled()) return { ok: false, password: null, prfOutput: null, isPrfSession: false };
  const info = hasBioSession();
  if (!info.exists) {
    if (!isPrfEnabled()) {
      const cred = getCredIdB64();
      if (!cred) return { ok: false, password: null, prfOutput: null, isPrfSession: false, expiredCanceled: true };
    }
    return { ok: false, password: null, prfOutput: null, isPrfSession: false, expiredCanceled: true };
  }
  try {
    const credIdB64 = getCredIdB64()!;
    const isPrfSession = info.prfSession;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: b64ToBuf(credIdB64), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
        ...(isPrfSession ? { extensions: { prf: { eval: { first: PRF_INPUT } } } } : {}),
      },
    })) as PublicKeyCredential;
    let password: string | null = null;
    let prfOutput: PrfOutput | null = null;
    if (isPrfSession) {
      prfOutput =
        (assertion.getClientExtensionResults().prf?.results?.first as
          | ArrayBuffer
          | null) ?? null;
      if (prfOutput && prfOutput.byteLength >= 32) {
        const prfKey = await crypto.subtle.importKey("raw", prfOutput, { name: "AES-GCM" }, false, ["decrypt"]);
        const encB64 = sessionStorage.getItem(STORAGE_KEYS.bioSession);
        const buf = b64ToBuf(encB64!);
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, prfKey, buf.slice(12));
        password = new TextDecoder().decode(pt);
      }
    }
    if (!password) password = await getLegacyBioSession();
    if (!password) return { ok: false, password: null, prfOutput, isPrfSession, expiredCanceled: true };
    return { ok: true, password, prfOutput, isPrfSession };
  } catch (e) {
    const err = e as { name?: string };
    return { ok: false, password: null, prfOutput: null, isPrfSession: false, errorName: err.name };
  }
}