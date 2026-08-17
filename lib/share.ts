// Encrypted share links — fully client-side, no backend server involved.
//
// Link format:  <origin>/share#s=<urlsafe-b64(JSON envelope)>
// envelope: { v, salt, iv, ct }  where ct is AES-256-GCM of the payload JSON,
// keyed by PBKDF2(passphrase, salt). Only the base64 envelope — never any
// plaintext — travels in the URL fragment.

import { bufToB64, b64ToBuf, decryptWith, deriveKey, encryptWith } from "./crypto";
import { randomB64 } from "./backup";

export type ShareInclude = "pw" | "user" | "notes" | "totp";

export const SHARE_INCLUDE_ALL: ShareInclude[] = ["pw", "user", "notes", "totp"];

export interface SharePayload {
  v: 1;
  iat: number;
  exp: number;
  incl: ShareInclude[];
  title: string;
  username: string;
  password: string;
  notes: string;
  totp: string;
}

export interface ShareEnvelope {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

export const SHARE_IV_LEN = 12;

function b64ToUrlsafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function urlsafeToB64(u: string): string {
  const pad = u.length % 4 === 0 ? "" : "=".repeat(4 - (u.length % 4));
  return u.replace(/-/g, "+").replace(/_/g, "/") + pad;
}

/**
 * Encrypts a payload and renders the fragment value for the /share page.
 */
export async function buildShareFragment(
  payload: SharePayload,
  passphrase: string,
): Promise<string> {
  const salt = b64ToBuf(randomB64(16));
  const key = await deriveKey(passphrase, salt);
  const cipher = await encryptWith(key, JSON.stringify(payload));
  const buf = b64ToBuf(cipher);
  const envelope: ShareEnvelope = {
    v: 1,
    salt: bufToB64(salt),
    iv: bufToB64(buf.slice(0, SHARE_IV_LEN)),
    ct: bufToB64(buf.slice(SHARE_IV_LEN)),
  };
  return `s=${b64ToUrlsafe(bufToB64(new TextEncoder().encode(JSON.stringify(envelope))))}`;
}

/**
 * Decrypts a share fragment with a passphrase.
 * Returns "expired" if the payload is past its expiry.
 * Throws on malformed input or a wrong passphrase (AES-GCM auth failure).
 */
export async function decryptShare(
  fragment: string,
  passphrase: string,
): Promise<SharePayload | "expired"> {
  const raw = fragment.startsWith("s=") ? fragment.slice(2) : fragment;
  const envelopeJson = new TextDecoder().decode(
    b64ToBuf(urlsafeToB64(raw)),
  );
  const envelope = JSON.parse(envelopeJson) as ShareEnvelope;
  if (envelope.v !== 1) throw new Error("unsupported share version");
  const key = await deriveKey(passphrase, b64ToBuf(envelope.salt));
  const iv = b64ToBuf(envelope.iv);
  const ct = b64ToBuf(envelope.ct);
  const combined = new Uint8Array(SHARE_IV_LEN + ct.length);
  combined.set(iv, 0);
  combined.set(ct, SHARE_IV_LEN);
  const json = await decryptWith(key, bufToB64(combined));
  const payload = JSON.parse(json) as SharePayload;
  if (payload.v !== 1) throw new Error("unsupported share payload");
  if (Date.now() > payload.exp) return "expired";
  return payload;
}

/** Empties the payload's included fields to their "off" state (label helpers re-use this). */
export function shareIncludeI18n(incl: ShareInclude[]): string[] {
  return incl.map((k) =>
    k === "pw"
      ? "share.inclPw"
      : k === "user"
        ? "share.inclUser"
        : k === "notes"
          ? "share.inclNotes"
          : "share.inclTotp",
  );
}

export const SHARE_EXPIRY_HOURS = [1, 24, 72, 168] as const;
export const SHARE_EXPIRY_KEYS = ["share.exp1h", "share.exp24h", "share.exp72h", "share.exp7d"] as const;
export function shareExpiryKey(hours: number): string {
  const idx = SHARE_EXPIRY_HOURS.indexOf(hours as (typeof SHARE_EXPIRY_HOURS)[number]);
  return idx >= 0 ? SHARE_EXPIRY_KEYS[idx] : "share.exp24h";
}