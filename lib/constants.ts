// ===== IndexedDB (must stay byte-compatible with legacy VaultDB v6) =====
export const DB_NAME = "VaultDB";
export const DB_VER = 6;
export const STORE_ITEMS = "items";
export const STORE_HISTORY = "pw_history";
export const STORE_SHARE_LOG = "share_log";

export const HIST_MAX = 10;
export const ROW_META_V = 6;

// ===== Crypto =====
export const PBKDF2_ITERATIONS = 600000;
export const PBKDF2_HASH = "SHA-256";
export const AES_IV_LEN = 12;

// ===== Lock policy (mirrors legacy) =====
export const MAX_ATTEMPTS = 5;
export const IDLE_LOCK_MS = 5 * 60 * 1000;
export const LOCKOUT_MS_BASE = 10 * 60 * 1000;

// ===== Vault health =====
export const EXPIRY_DAYS = 90;
export const OLD_PASSWORD_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// ===== localStorage keys (must stay identical to legacy) =====
export const STORAGE_KEYS = {
  theme: "hesych_theme",
  deviceId: "hesych_device_id",
  vaultSalt: "vault_salt",
  vaultVerifier: "vault_ver",
  vaultVerifierMagic: "vault_ver_magic",
  lockout: "vault_lockout",
  secretLocks: "vault_secret_locks",
  secretLockHintDismissed: "vault_secretlock_hint_dismissed",
  license: "vault_license",
  licenseVerified: "vault_license_verified",
  licenseAt: "vault_license_at",
  syncTs: "hesych_sync_ts",
  bioCredId: "vault_bio_cred_id",
  bioEnabled: "vault_bio_enabled",
  bioPrf: "vault_bio_prf",
  bioSession: "vault_bio_session",
  bioKey: "vault_bio_key",
  bioExpiry: "vault_bio_expiry",
} as const;