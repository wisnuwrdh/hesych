// Secret-lock state (per-item countdown). Persisted in localStorage so it
// survives reloads/backgrounding, mirroring the legacy vault_secret_locks map.

import { STORAGE_KEYS } from "./constants";

export interface SecretLock {
  lockedAt: number;
  durationMs: number;
}

function readLocks(): Record<string, SecretLock> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.secretLocks);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SecretLock>;
  } catch {
    return {};
  }
}

function writeLocks(locks: Record<string, SecretLock>): void {
  const live = Object.fromEntries(
    Object.entries(locks).filter(([, l]) => Date.now() < l.lockedAt + l.durationMs),
  );
  if (Object.keys(live).length) {
    localStorage.setItem(STORAGE_KEYS.secretLocks, JSON.stringify(live));
  } else {
    localStorage.removeItem(STORAGE_KEYS.secretLocks);
  }
}

export function getSecretLock(id: number): SecretLock | null {
  const lock = readLocks()[String(id)];
  if (!lock) return null;
  if (Date.now() >= lock.lockedAt + lock.durationMs) {
    setSecretLock(id, 0);
    return null;
  }
  return lock;
}

export function isItemSecretLocked(id: number): boolean {
  return getSecretLock(id) !== null;
}

export function setSecretLock(id: number, durationMs: number): void {
  const locks = readLocks();
  if (durationMs <= 0) {
    delete locks[String(id)];
  } else {
    locks[String(id)] = { lockedAt: Date.now(), durationMs };
  }
  writeLocks(locks);
}