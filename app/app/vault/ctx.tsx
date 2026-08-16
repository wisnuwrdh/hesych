"use client";

import { createContext, useContext } from "react";
import { t } from "../../../lib/i18n";
import type { Category, VaultItem } from "../../../lib/types";

export type VaultFilter = "all" | "fav" | Category;

export interface VaultCtx {
  items: VaultItem[];
  filter: VaultFilter;
  setFilter: (f: VaultFilter) => void;
  search: string;
  setSearch: (q: string) => void;
  pendingDelete: VaultItem | null;
  setPendingDelete: (i: VaultItem | null) => void;
  pendingSecretLock: VaultItem | null;
  setPendingSecretLock: (i: VaultItem | null) => void;
  detailId: number | null;
  setDetailId: (id: number | null) => void;
  expanded: Set<number>;
  revealed: Map<number, string>;
  toggleExpand: (id: number) => void;
  toggleReveal: (id: number) => Promise<void>;
  copyPassword: (id: number) => Promise<void>;
  copyUsername: (id: number) => Promise<void>;
  copyField: (id: number, idx: number) => Promise<void>;
  toggleFav: (id: number) => Promise<void>;
  decryptPassword: (id: number) => Promise<string>;
  decryptField: (id: number, idx: number) => Promise<string>;
  list: VaultItem[];
  counts: Record<string, number>;
  itemCount: number;
  now: number;
  onLock: () => void;
}

export const VaultCtx =
  createContext<VaultCtx | null>(null);

export function useVault(): VaultCtx {
  const ctx = useContext(VaultCtx);
  if (!ctx) throw new Error("VaultCtx missing");
  return ctx;
}

export function getCategoryMeta(cat: Category): { label: string; cls: string } {
  const labels: Record<Category, string> = {
    social: "cat.social.s",
    finance: "cat.finance.s",
    email: "cat.email.s",
    work: "cat.work.s",
    other: "cat.other.s",
    shopping: "cat.shopping.s",
    gaming: "cat.gaming.s",
  };
  const cls: Record<Category, string> = {
    social: "cat-social",
    finance: "cat-finance",
    email: "cat-email",
    work: "cat-work",
    other: "cat-other",
    shopping: "cat-shopping",
    gaming: "cat-gaming",
  };
  return { label: t(labels[cat]), cls: cls[cat] };
}

export const FILTERS: Array<{ key: VaultFilter; i18n: string }> = [
  { key: "all", i18n: "filter.all" },
  { key: "fav", i18n: "filter.fav" },
  { key: "social", i18n: "filter.social" },
  { key: "finance", i18n: "filter.finance" },
  { key: "email", i18n: "filter.email" },
  { key: "work", i18n: "filter.work" },
  { key: "shopping", i18n: "filter.shopping" },
  { key: "gaming", i18n: "filter.gaming" },
  { key: "other", i18n: "filter.other" },
];