-- Cloudflare D1 schema — Hesych license device registry (max 3 devices/key)
-- + rate_limits table for the shared verify-license rate limiter.
--
-- Setup:
--   1. CF Dashboard → Workers & Pages → D1 → Create database → "hesych-license"
--   2. Open the database → Console → paste this file's contents → Run
--   3. Pages project hesych → Settings → Environment variables (Production):
--        CF_ACCOUNT_ID     = akun ID kamu
--        D1_DATABASE_ID    = Database ID dari langkah 1
--        CF_D1_API_TOKEN   = API token dengan izin "D1 — Edit"
--        GUMROAD_PRODUCT_ID = Product ID dari produk Gumroad
--   4. Redeploy

CREATE TABLE IF NOT EXISTS license_devices (
  license_key  TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  device_name  TEXT NOT NULL DEFAULT '',
  activated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (license_key, device_id)
);

-- Shared rate limiter for POST /api/verify-license (10 req / 15 min / IP).
-- Applied on top of an existing install via the D1 console (same as step 2):
--   ALTER-free additive table; until it exists the API silently falls back
--   to the per-isolate in-memory limiter.
CREATE TABLE IF NOT EXISTS rate_limits (
  ip           TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL DEFAULT 0
);
