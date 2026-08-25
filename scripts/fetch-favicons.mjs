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
    let buf = null;
    // Sumber 1: Google s2
    const r1 = await fetch(
      `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(d)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (r1.ok) buf = Buffer.from(await r1.arrayBuffer());
    // Sumber 2 (fallback): DuckDuckGo icons
    if (!buf || buf.length < 100) {
      const r2 = await fetch(
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      );
      if (r2.ok) buf = Buffer.from(await r2.arrayBuffer());
    }
    if (!buf) throw new Error("no source");
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
