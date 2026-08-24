#!/usr/bin/env node
// Hesych Premium license key generator (OWNER ONLY — do not ship to clients).
//
// Usage:
//   node scripts/gen-license.mjs [count]
//
// Keys are validated OFFLINE by lib/license.ts via HMAC-SHA256 tag.
// Keep SECRET and ALPHA in sync with lib/license.ts.

import { createHmac, randomBytes } from "node:crypto";

const SECRET = "hesych::license::v1::VFXC2J2CTF6KY9VQ96ZQ6K24";
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars, no 0/O/1/I/L
const PAYLOAD_LEN = 12;
const TAG_LEN = 4;

function tag(payload) {
  const sig = createHmac("sha256", SECRET).update(payload).digest();
  let out = "";
  for (let i = 0; i < sig.length; i++) out += ALPHA[sig[i] % ALPHA.length];
  return out.slice(0, TAG_LEN);
}

function mintKey() {
  const bytes = randomBytes(PAYLOAD_LEN);
  let payload = "";
  for (let i = 0; i < PAYLOAD_LEN; i++) payload += ALPHA[bytes[i] % ALPHA.length];
  const body = payload + tag(payload);
  return `HESYCH-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
}

const count = Math.max(1, Number(process.argv[2] || 1) || 1);
console.log(`# ${count} license key(s) — bagikan ke pembeli`);
for (let i = 0; i < count; i++) console.log(mintKey());
