// Post-build transform: makes @opennextjs/cloudflare v1.x output deployable to
// Cloudflare Pages (mirrors narehatsaas' scripts/build-pages.mjs, minus the
// sharp/onnx native-module patches hesych doesn't need):
//   1. rename .open-next/worker.js -> .open-next/_worker.js  (Pages entry)
//   2. inject env.ASSETS-first static serving into _worker.js
//   3. copy .open-next/assets/* up to .open-next/ root
//   4. copy public/* up to .open-next/ root
//
// Why: adapter v1.x only emits the Workers-with-assets format and no longer
// generates Pages' _worker.js — without this transform, Pages deployments
// serve static files fine but every SSR route 404s.
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  cpSync,
  readdirSync,
} from "node:fs";

const outDir = ".open-next";
const workerPath = `${outDir}/worker.js`;
const pagesWorkerPath = `${outDir}/_worker.js`;

if (!existsSync(workerPath)) {
  console.error(
    "pages-postbuild: .open-next/worker.js not found — did `opennextjs-cloudflare build` run first?",
  );
  process.exit(1);
}

// [1/4] worker.js -> _worker.js (Pages advanced-mode entry point)
renameSync(workerPath, pagesWorkerPath);
console.log("  ✓ _worker.js ready");

// [2/4] serve static assets via env.ASSETS before handing off to Next server
const ANCHOR = "            // - `Request`s are handled by the Next server";
const INSERT = [
  "            // Serve static assets from env.ASSETS (Cloudflare Pages)",
  '            if (url.pathname.startsWith("/_next/static/") || !url.pathname.startsWith("/api/")) {',
  "                const asset = await env.ASSETS.fetch(request);",
  "                if (asset.status !== 404) return asset;",
  "            }",
  "            ",
].join("\n");

let code = readFileSync(pagesWorkerPath, "utf-8");
if (code.includes(ANCHOR)) {
  code = code.replace(ANCHOR, INSERT + ANCHOR);
  writeFileSync(pagesWorkerPath, code);
  console.log("  ✓ injected env.ASSETS static serving");
} else {
  console.log(
    "  ∼ anchor not found in _worker.js — skipping inject (worker handles assets itself)",
  );
}

// [3/4] assets/* -> output root (Pages serves upload-root files directly)
if (existsSync(`${outDir}/assets`)) {
  for (const entry of readdirSync(`${outDir}/assets`)) {
    const dest = `${outDir}/${entry}`;
    if (!existsSync(dest)) {
      cpSync(`${outDir}/assets/${entry}`, dest, { recursive: true });
    }
  }
  console.log("  ✓ assets copied to output root");
} else {
  console.log("  - assets/ not found");
}

// [4/4] public/* -> output root
if (existsSync("public")) {
  let copied = 0;
  for (const entry of readdirSync("public")) {
    const dest = `${outDir}/${entry}`;
    if (!existsSync(dest)) {
      cpSync(`public/${entry}`, dest, { recursive: true });
      copied++;
    }
  }
  console.log(`  ✓ public/ files copied (${copied})`);
}

console.log("✓ pages-postbuild done");
