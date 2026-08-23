// Transforms the @opennextjs/cloudflare v1.x build output (.open-next/) into a
// Cloudflare Pages-compatible layout:
//   1. static assets copied from .open-next/assets/ up to .open-next/ root
//      (Pages serves upload-root files directly)
//   2. _worker.js shim written at the root, re-exporting the bundled worker's
//      default fetch — with no _routes.json, Pages routes EVERY request through
//      it; the shim relies on Pages' automatic env.ASSETS binding.
//
// Why: adapter v1.x only emits the Workers-with-assets format (worker.js +
// assets/) and no longer generates Pages' _worker.js — without this transform,
// Pages deployments serve static files fine but every SSR route 404s.
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), ".open-next");
const assetsDir = join(outDir, "assets");
const workerEntry = join(outDir, "worker.js");

if (!existsSync(workerEntry)) {
  console.error(
    "pages-postbuild: .open-next/worker.js not found — did `opennextjs-cloudflare build` run first?",
  );
  process.exit(1);
}

if (existsSync(assetsDir)) {
  cpSync(assetsDir, outDir, { recursive: true });
  console.log("pages-postbuild: copied assets/ to output root");
}

writeFileSync(
  join(outDir, "_worker.js"),
  'import handler from "./worker.js";\nexport default { fetch: handler.fetch };\n',
);
console.log("pages-postbuild: wrote _worker.js shim");
