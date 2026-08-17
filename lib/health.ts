// Vault health scan — analyzes breach status, strength, age, and reuse.

import { decryptWith, type VaultKey } from "./crypto";
import { isPasswordOld } from "./format";
import { scorePassword } from "./password";
import type { VaultItem } from "./types";

export type HealthLevel = "great" | "good" | "fair" | "poor";

export interface HealthReport {
  score: number;
  level: HealthLevel;
  total: number;
  checked: number;
  breached: number;
  weak: number;
  oldCount: number;
  /** Number of accounts beyond the first per reused password. */
  dupExtra: number;
  dupGroups: { count: number }[];
  breachedIds: number[];
  weakIds: number[];
  oldIds: number[];
  dupIds: number[];
}

export function levelForScore(score: number): HealthLevel {
  if (score >= 85) return "great";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/**
 * Scans every item: decrypts each password once, then computes a 0–100 score
 * and the contributing problem lists. `onStrength` fires per item so the UI
 * can cache strength values incrementally.
 */
export async function scanVaultHealth(
  items: VaultItem[],
  key: VaultKey,
  onStrength?: (id: number, score: number) => void,
): Promise<HealthReport> {
  const report: HealthReport = {
    score: 100,
    level: "great",
    total: items.length,
    checked: 0,
    breached: 0,
    weak: 0,
    oldCount: 0,
    dupExtra: 0,
    dupGroups: [],
    breachedIds: [],
    weakIds: [],
    oldIds: [],
    dupIds: [],
  };
  if (items.length === 0) {
    report.level = levelForScore(report.score);
    return report;
  }

  const byPw = new Map<string, number[]>();
  let failed = 0;
  for (const item of items) {
    try {
      const pw = await decryptWith(key, item.password);
      if (item.breachStatus === 2) {
        report.breached++;
        report.breachedIds.push(item.id);
      }
      if (item.breachStatus !== undefined && item.breachStatus !== null) {
        report.checked++;
      }
      const score = scorePassword(pw);
      onStrength?.(item.id, score);
      if (score <= 2) {
        report.weak++;
        report.weakIds.push(item.id);
      }
      if (isPasswordOld(item)) {
        report.oldCount++;
        report.oldIds.push(item.id);
      }
      const list = byPw.get(pw) ?? [];
      list.push(item.id);
      byPw.set(pw, list);
    } catch {
      failed++;
    }
  }

  for (const ids of byPw.values()) {
    if (ids.length > 1) {
      report.dupGroups.push({ count: ids.length });
      report.dupExtra += ids.length - 1;
      report.dupIds.push(...ids);
    }
  }

  let penalty = 0;
  penalty += Math.min(report.breached * 20, 70);
  penalty += Math.min(report.weak * 10, 30);
  penalty += Math.min(report.oldCount * 5, 20);
  penalty += Math.min(failed * 1, 10);
  const unchecked = report.total - report.checked - failed;
  penalty += Math.min(unchecked * 1, 10);
  penalty += Math.min(report.dupExtra * 10, 30);
  report.score = Math.max(0, 100 - penalty);
  report.level = levelForScore(report.score);
  return report;
}