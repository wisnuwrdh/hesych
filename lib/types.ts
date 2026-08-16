export type Category =
  | "social"
  | "finance"
  | "email"
  | "work"
  | "other"
  | "shopping"
  | "gaming";

export type CustomFieldType = "text" | "password";

export interface CustomField {
  name: string;
  /** base64 AES-GCM ciphertext; "" when empty */
  value: string;
  type: CustomFieldType;
}

export const REQUIRED_ITEM_FIELDS = ["title", "username", "password"] as const;

/**
 * A row exactly as persisted in IndexedDB `VaultDB` v6 (store "items").
 * Sensitive fields are base64 AES-GCM ciphertexts produced by lib/crypto.
 * Metadata (category/tags/breachStatus/breachCheckedAt) is encrypted or null;
 * `_metaV === 6` marks a migrated row.
 */
export type EncryptedVaultRow = {
  id?: number;
  title: string;
  username: string;
  password: string;
  notes: string;
  color: number;
  favorite: boolean;
  totp_secret: string;
  custom_fields: CustomField[];
  category: string | null;
  tags: string | null;
  breachStatus: string | null;
  breachCheckedAt: string | null;
  _metaV: number;
  updatedAt: number | null;
  createdAt: number | null;
};

/**
 * A decrypted item in app memory. ⚠️ `password`, `totp_secret` and
 * `custom_fields[].value` are kept as ciphertext and decrypted on demand.
 */
export type VaultItem = {
  id: number;
  title: string;
  username: string;
  password: string;
  notes: string;
  color: number;
  favorite: boolean;
  category: Category;
  tags: string[];
  breachStatus?: number;
  breachCheckedAt: number | null;
  totp_secret: string;
  custom_fields: CustomField[];
  updatedAt: number | null;
  createdAt: number | null;
};

export type PasswordHistoryEntry = {
  hid?: number;
  itemId: number;
  /** base64 AES-GCM ciphertext of the old password */
  encPassword: string;
  changedAt: number;
};

export type ShareLogEntry = {
  slid?: number;
  itemId: number;
  itemTitle: string;
  link: string;
  createdAt: number;
  expTs: number;
};

export type BreachCheckResult = {
  status: number | null;
  count: number;
  err?: string;
};