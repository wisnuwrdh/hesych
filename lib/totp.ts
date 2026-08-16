// TOTP (RFC 6238 / Google Authenticator), byte-compatible with legacy.

import type { Bytes } from "./crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function isValidBase32(s: string): boolean {
  return /^[A-Z2-7]+=*$/.test(s) && s.replace(/=/g, "").length > 0;
}

export function base32Decode(s: string): Bytes {
  s = s.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let val = 0;
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const idx = BASE32.indexOf(s[i]);
    if (idx === -1) throw new Error("Invalid base32");
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function generateTOTP(
  secret: string,
  time = Date.now() / 1000,
): Promise<string> {
  const keyBytes = base32Decode(secret);
  const t = Math.floor(time / 30);
  const msg = new Uint8Array(8);
  let tmp = t;
  for (let i = 7; i >= 0; i--) {
    msg[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  const hmac = new Uint8Array(sig);
  const offset = hmac[19] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

export function totpSecsRemaining(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}