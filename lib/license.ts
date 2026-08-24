// Offline license validation for Hesych Premium.
//
// The legacy flow called a Vercel function (/api/verify-license) backed by
// Gumroad + Supabase + Upstash — those services are decommissioned, so
// activation is now fully offline: keys carry an HMAC-SHA256 tag that we
// recompute locally. Keys are minted by the owner via scripts/gen-license.mjs
// (same SECRET + alphabet — keep the two in sync).
//
// Key shape: HESYCH-PPPP-PPPP-PPPP-TAGG  (12 payload chars + 4-char HMAC tag)
//
// Threat model: this is indie-tier protection. A determined attacker can
// extract the secret from the bundle; the goal is stopping casual sharing.

import { STORAGE_KEYS } from "./constants";

const SECRET = "hesych::license::v1::VFXC2J2CTF6KY9VQ96ZQ6K24";
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars, no 0/O/1/I/L
const PREFIX = "HESYCH";

const enc = new TextEncoder();

async function hmacTag(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  let out = "";
  for (let i = 0; i < sig.length; i++) out += ALPHA[sig[i] % ALPHA.length];
  return out.slice(0, 4);
}

/** Uppercase, strip separators, ensure prefix → "HESYCH" + 16 alphanumerics. */
function compactKey(raw: string): string {
  const stripped = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return stripped.startsWith(PREFIX) ? stripped : PREFIX + stripped;
}

export function prettyKey(raw: string): string {
  const c = compactKey(raw);
  const b = c.slice(PREFIX.length);
  return `${PREFIX}-${b.slice(0, 4)}-${b.slice(4, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}`;
}

export async function validateKey(raw: string): Promise<boolean> {
  const c = compactKey(raw);
  if (!new RegExp(`^${PREFIX}[A-Z0-9]{16}$`).test(c)) return false;
  const b = c.slice(PREFIX.length);
  const payload = b.slice(0, 12);
  const tag = b.slice(12, 16);
  return (await hmacTag(payload)) === tag;
}

export interface LicenseMeta {
  key: string;
  since: number;
}

export function isActive(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.licenseVerified) === "1";
  } catch {
    return false;
  }
}

export function getMeta(): LicenseMeta | null {
  try {
    const key = localStorage.getItem(STORAGE_KEYS.license);
    const since = Number(localStorage.getItem(STORAGE_KEYS.licenseAt) || 0);
    if (!key || !isActive()) return null;
    return { key, since };
  } catch {
    return null;
  }
}

export async function activate(raw: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await validateKey(raw))) return { ok: false, error: "premium.invalidKey" };
  localStorage.setItem(STORAGE_KEYS.license, prettyKey(raw));
  localStorage.setItem(STORAGE_KEYS.licenseVerified, "1");
  localStorage.setItem(STORAGE_KEYS.licenseAt, String(Date.now()));
  return { ok: true };
}

export function deactivate(): void {
  localStorage.removeItem(STORAGE_KEYS.license);
  localStorage.removeItem(STORAGE_KEYS.licenseVerified);
  localStorage.removeItem(STORAGE_KEYS.licenseAt);
}
