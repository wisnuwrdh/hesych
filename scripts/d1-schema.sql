-- Cloudflare D1 schema — Hesych license device registry (max 3 devices/key)
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
