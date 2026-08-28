// Hesych Premium licensing - Gumroad-verified with device registry (max 3).
//
// Flow: activate(key) → POST /api/verify-license {license, deviceId,
// deviceName} → route handler verifies against api.gumroad.com (refunds /
// chargebacks / test purchases rejected server-side) and registers this
// device in D1. On success we persist locally; a silent re-verification runs
// whenever the last check is older than 30 days and the app is online, and
// downgrades the device (deactivate) when Gumroad reports the license
// refunded, chargebacked, disabled, or deleted.
//
// No secret lives in the client bundle - validation truth stays on Gumroad.

import { STORAGE_KEYS } from "./constants";
import { getDeviceId, getDeviceName } from "./device";

export interface DeviceRow {
  device_id: string;
  device_name: string;
  activated_at: number;
}

export type ActivateResult =
  | { ok: true; email?: string }
  | {
      ok: false;
      error: string;
      deviceLimitReached?: boolean;
      devices?: DeviceRow[];
    };

export interface LicenseMeta {
  key: string;
  email: string | null;
  since: number;
}

const REVERIFY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function persist(key: string, email: string | null): void {
  localStorage.setItem(STORAGE_KEYS.license, key);
  localStorage.setItem(STORAGE_KEYS.licenseVerified, "1");
  localStorage.setItem(STORAGE_KEYS.licenseAt, String(Date.now()));
  if (email) localStorage.setItem(STORAGE_KEYS.licenseEmail, email);
}

export function isActive(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.licenseVerified) === "1";
  } catch {
    return false;
  }
}

export function getMeta(): LicenseMeta | null {
  try {
    const key = localStorage.getItem(STORAGE_KEYS.license);
    const email = localStorage.getItem(STORAGE_KEYS.licenseEmail);
    const since = Number(localStorage.getItem(STORAGE_KEYS.licenseAt) || 0);
    if (!key || !isActive()) return null;
    return { key, email, since };
  } catch {
    return null;
  }
}

/** Silent 30-day revalidation - downgrades on Gumroad-confirmed revocation. */
export async function revalidateIfNeeded(): Promise<void> {
  const meta = getMeta();
  if (!meta) return;
  const since = Number(localStorage.getItem(STORAGE_KEYS.licenseAt) || 0);
  if (Date.now() - since < REVERIFY_MS) return;
  // Only treat as offline when the browser explicitly says so - Node and
  // non-browser runtimes expose a navigator without a meaningful onLine.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    const res = await fetch("/api/verify-license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        license: meta.key,
        deviceId: getDeviceId(),
        action: "list",
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      revoked?: boolean;
    } | null;
    if (!data) return;
    if (data.revoked) {
      // Gumroad says refunded / chargebacked / disabled / deleted → hard
      // downgrade. Server misconfig, rate limits and network errors never
      // carry `revoked`, so they keep the current state.
      deactivate();
      return;
    }
    if (res.ok) {
      // Registered device path returned OK → refresh timestamp.
      persist(meta.key, meta.email);
    }
  } catch {
    // offline/network error → keep current state until next attempt
  }
}

export async function activate(raw: string): Promise<ActivateResult> {
  const key = raw.trim();
  if (!key) return { ok: false, error: "premium.invalidKey" };
  let data: {
    valid?: boolean;
    error?: string;
    email?: string;
    deviceLimitReached?: boolean;
    devices?: DeviceRow[];
  };
  try {
    const res = await fetch("/api/verify-license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        license: key,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
      }),
    });
    data = await res.json();
  } catch {
    return { ok: false, error: "premium.networkError" };
  }
  if (!data.valid) {
    return {
      ok: false,
      error: data.error ?? "premium.invalidKey",
      deviceLimitReached: data.deviceLimitReached,
      devices: data.devices,
    };
  }
  persist(key, data.email ?? null);
  return { ok: true, email: data.email };
}

export function deactivate(): void {
  localStorage.removeItem(STORAGE_KEYS.license);
  localStorage.removeItem(STORAGE_KEYS.licenseVerified);
  localStorage.removeItem(STORAGE_KEYS.licenseAt);
  localStorage.removeItem(STORAGE_KEYS.licenseEmail);
}

export async function listDevices(key: string): Promise<DeviceRow[]> {
  const res = await fetch("/api/verify-license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ license: key, deviceId: getDeviceId(), action: "list" }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { devices?: DeviceRow[] };
  return data.devices ?? [];
}

export async function removeDevice(key: string, removeId: string): Promise<boolean> {
  const res = await fetch("/api/verify-license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      license: key,
      deviceId: getDeviceId(),
      action: "remove",
      removeDeviceId: removeId,
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}
