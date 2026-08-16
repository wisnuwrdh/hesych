import { t } from "./i18n";

export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return 1;
  if (score <= 2) return 2;
  if (score <= 3) return 3;
  return 4;
}

const STRENGTH_KEYS = ["", "strength.weak", "strength.fair", "strength.strong", "strength.veryStrong"] as const;

export function getStrengthLabel(score: number): string {
  return score ? t(STRENGTH_KEYS[score]) : "";
}

/** Mirrors legacy genPass(): 18 chars from a crypto-secure set. */
export function genPass(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  let pw = "";
  const arr = crypto.getRandomValues(new Uint8Array(18));
  for (const b of arr) pw += chars[b % chars.length];
  return pw;
}