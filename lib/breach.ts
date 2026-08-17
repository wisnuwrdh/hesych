// HIBP (Have I Been Pwned) breach checking using the k-anonymity range API —
// only the first 5 hex chars of the SHA-1 hash ever leave the device.

import { decryptWith, encryptMetaValue, type VaultKey } from "./crypto";
import { dbGetItem, dbPutItem } from "./db";
import type { VaultItem } from "./types";

export const HIBP_API = "https://api.pwnedpasswords.com/range/";

export async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Parses the HIBP range response body; returns the occurrence count for a suffix. */
export function parseRangeResponse(text: string, suffix: string): number {
  const target = suffix.toUpperCase();
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    if (line.slice(0, idx).toUpperCase() === target) {
      const n = parseInt(line.slice(idx + 1), 10);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

export interface BreachCheck {
  count: number;
  checkedAt: number;
}

/**
 * Checks a single password against HIBP. Returns the number of times it has
 * appeared in known breaches (0 = safe). Throws on network/API errors.
 */
export async function checkBreach(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetchImpl(`${HIBP_API}${prefix}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!res.ok) throw new Error(`HIBP HTTP ${res.status}`);
  const text = await res.text();
  return parseRangeResponse(text, suffix);
}

/** Stores a fresh breach status on an existing row (encrypted meta, no re-encrypt). */
export async function saveBreachResult(
  db: IDBDatabase,
  key: VaultKey,
  id: number,
  status: number,
  checkedAt: number,
): Promise<void> {
  const row = await dbGetItem(db, id);
  if (!row) throw new Error("item not found");
  row.breachStatus = await encryptMetaValue(key, status);
  row.breachCheckedAt = await encryptMetaValue(key, checkedAt);
  await dbPutItem(db, row);
}

export interface BreachSummary {
  checked: number;
  breached: number;
  safe: number;
  failed: number;
}

/**
 * Checks every item's password (decrypting one at a time) and persists each
 * result. `onItem` fires after each item so the UI can live-update.
 */
export async function checkAllItems(
  db: IDBDatabase,
  key: VaultKey,
  items: VaultItem[],
  fetchImpl?: typeof fetch,
  onItem?: (id: number, status: number) => void,
): Promise<BreachSummary> {
  const summary: BreachSummary = { checked: 0, breached: 0, safe: 0, failed: 0 };
  for (const item of items) {
    try {
      const pw = await decryptWith(key, item.password);
      const count = await checkBreach(pw, fetchImpl);
      const status = count > 0 ? 2 : 1;
      await saveBreachResult(db, key, item.id, status, Date.now());
      summary.checked++;
      if (count > 0) summary.breached++;
      else summary.safe++;
      onItem?.(item.id, status);
    } catch (e) {
      console.error("breach check failed:", item.id, e);
      summary.failed++;
    }
  }
  return summary;
}
