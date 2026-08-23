// Neutralizes the native `sharp` module so the OpenNext bundler (esbuild)
// doesn't choke on unresolvable `.node` binaries. The vault app never calls
// sharp at runtime (plain <img> tags, no image optimization), so an empty
// stub is safe. Mirrors the sharp portion of narehatsaas' build-pages.mjs.
import { existsSync, writeFileSync } from "node:fs";

const STUB = "module.exports = {};\n";

const targets = [
  "node_modules/sharp/dist/sharp.cjs",
  ".next/standalone/node_modules/sharp/dist/sharp.cjs",
];

for (const file of targets) {
  if (existsSync(file)) {
    writeFileSync(file, STUB);
    console.log(`  ✓ stubbed ${file}`);
  } else {
    console.log(`  - ${file} not present, skipped`);
  }
}
console.log("✓ sharp stubbed");
