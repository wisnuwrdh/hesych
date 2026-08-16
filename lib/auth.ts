// Attempt-counting + persistent lockout, mirroring the legacy H6 behavior:
//   - lockout state persists to localStorage so closing the tab doesn't reset it
//   - after MAX_ATTEMPTS failed tries the vault locks for LOCKOUT_MS_BASE

import { LOCKOUT_MS_BASE, MAX_ATTEMPTS, STORAGE_KEYS } from "./constants";

export interface LockoutState {
  attempts: number;
  lockedUntil: number;
}

const SESSION_KEY = "vault_lockout"; // legacy sessionStorage key, same value

function readLockoutJSON(): LockoutState | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.lockout) ??
      sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LockoutState;
  } catch {
    return null;
  }
}

function clearLockoutStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.lockout);
  sessionStorage.removeItem(SESSION_KEY);
}

/** Merges persisted attempts/lockedUntil into the fresh in-memory state. */
export function loadLockoutState(): LockoutState {
  const s = readLockoutJSON();
  if (!s) return { attempts: 0, lockedUntil: 0 };
  if (s.lockedUntil > Date.now()) {
    return {
      attempts: s.attempts || MAX_ATTEMPTS,
      lockedUntil: s.lockedUntil,
    };
  }
  clearLockoutStorage();
  return { attempts: 0, lockedUntil: 0 };
}

export function saveLockoutState(state: LockoutState): void {
  if (state.lockedUntil > Date.now()) {
    localStorage.setItem(
      STORAGE_KEYS.lockout,
      JSON.stringify({ attempts: state.attempts, lockedUntil: state.lockedUntil }),
    );
  } else {
    clearLockoutStorage();
  }
}

/** True while the lockout is still active. Clears a finished lockout. */
export function checkLockout(state: LockoutState): LockoutState {
  if (state.lockedUntil > 0 && Date.now() < state.lockedUntil) return state;
  if (state.lockedUntil > 0 && Date.now() >= state.lockedUntil) {
    state = { attempts: 0, lockedUntil: 0 };
    clearLockoutStorage();
  }
  return state;
}

export function recordFail(state: LockoutState): LockoutState {
  const next = { ...state, attempts: state.attempts + 1 };
  if (next.attempts >= MAX_ATTEMPTS) {
    next.lockedUntil = Date.now() + LOCKOUT_MS_BASE;
  }
  saveLockoutState(next);
  return next;
}

export function resetAttempts(): LockoutState {
  clearLockoutStorage();
  return { attempts: 0, lockedUntil: 0 };
}

export function isVaultLocked(state: LockoutState): boolean {
  return state.lockedUntil > 0 && Date.now() < state.lockedUntil;
}