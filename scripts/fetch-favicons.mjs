#!/usr/bin/env node
// OWNER TOOL — unduh favicon untuk semua domain di DOMAIN_MAP.
// Jalankan SEKALI saat online:  node scripts/fetch-favicons.mjs
// Hasil: public/favicons/{domain}.png — commit folder ini ke repo.
//
// Sumber gambar: Google s2 favicon service (64px). Runtime app TIDAK pernah
// memanggil layanan eksternal — hanya membaca file lokal hasil script ini.

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = __dir + "/..";

const map = JSON.parse(readFileSync(ROOT + "/lib/favicon-domains.json", "utf-8"));
const domains = [...new Set(Object.values(map))].sort();

mkdirSync(ROOT + "/public/favicons", { recursive: true });

let ok = 0;
let skip = 0;
let fail = 0;

for (const d of domains) {
  const out = `${ROOT}/public/favicons/${d}.png`;
  if (existsSync(out)) {
    skip++;
    continue;
  }
  try {
    const res = await fetch(
      `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(d)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    // Google s2 membalas PNG default 16px "globe" bila domain tak dikenal —
    // file itu tetap disimpan (valid), ukurannya kecil.
    writeFileSync(out, buf);
    ok++;
    console.log("  ✓", d);
  } catch (e) {
    fail++;
    console.error("  ✗", d, "-", String(e));
  }
}

console.log(
  `\nSelesai: ${ok} diunduh, ${skip} sudah ada, ${fail} gagal. Total unik: ${domains.length}`,
);
if (fail > 0) process.exitCode = 1;
