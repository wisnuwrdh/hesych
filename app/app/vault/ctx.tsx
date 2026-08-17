"use client";

import { createContext, useContext } from "react";
import { t } from "../../../lib/i18n";
import type {
  Category,
  CustomField,
  PasswordHistoryEntry,
  ShareLogEntry,
  VaultItem,
} from "../../../lib/types";
import type { ShareInclude } from "../../../lib/share";

export type VaultFilter = "all" | "fav" | Category;

export interface AdvFilter {
  tags: string[];
  status: "all" | "safe" | "breached" | "unchecked";
  strength: "all" | "weak" | "fair" | "strong";
  age: "all" | "new" | "old";
}

export const DEFAULT_ADV: AdvFilter = {
  tags: [],
  status: "all",
  strength: "all",
  age: "all",
};

export interface ItemSaveInput {
  id?: number;
  title: string;
  username: string;
  password: string;
  notes: string;
  category: Category;
  totpRaw: string;
  favorite: boolean;
  tags: string[];
  color?: number;
  custom_fields: CustomField[];
  keepPassword: boolean;
}

export interface VaultCtx {
  items: VaultItem[];
  filter: VaultFilter;
  setFilter: (f: VaultFilter) => void;
  search: string;
  setSearch: (q: string) => void;
  adv: AdvFilter;
  setAdv: (f: AdvFilter) => void;
  advCount: number;
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
  decryptTotp: (id: number) => Promise<string>;
  decryptUsername: (id: number) => Promise<string>;
  editing: VaultItem | null;
  sheetOpen: boolean;
  openSheet: (item?: VaultItem | null) => void;
  closeSheet: () => void;
  saveItem: (input: ItemSaveInput) => Promise<boolean>;
  genOpen: boolean;
  setGenOpen: (v: boolean) => void;
  useGenPassword: (pw: string) => void;
  registerGenTarget: (h: ((pw: string) => void) | null) => void;
  isPremium: () => boolean;
  cpOpen: boolean;
  setCpOpen: (v: boolean) => void;
  changeMasterPw: (oldPw: string, newPw: string) => Promise<string | null>;
histItem: VaultItem | null;
  openHist: (item: VaultItem) => void;
  closeHist: () => void;
  decryptRaw: (b64: string) => Promise<string>;
  loadHistory: (itemId: number) => Promise<PasswordHistoryEntry[]>;
  deleteHistoryEntry: (hid: number) => Promise<void>;
  shareItem: VaultItem | null;
  setShareItem: (i: VaultItem | null) => void;
  shareOpen: boolean;
  setShareOpen: (v: boolean) => void;
  buildShareLink: (
    item: VaultItem,
    passphrase: string,
    expHours: number,
    incl: ShareInclude[],
  ) => Promise<{ link: string } | { err: string }>;
  shareLog: ShareLogEntry[];
  loadShareLog: () => Promise<void>;
  deleteShareLog: (slid: number) => Promise<void>;
  shareLogOpen: boolean;
  setShareLogOpen: (v: boolean) => void;
  backupOpen: boolean;
  setBackupOpen: (v: boolean) => void;
  importOpen: boolean;
  setImportOpen: (v: boolean) => void;
  doExport: (mode: "master" | "custom", pw?: string) => Promise<string | null>;
  doImport: (file: File, mode: "replace" | "merge", pw?: string) => Promise<string | null>;
  breachRunning: boolean;
  breachChecking: Set<number>;
  checkItemBreach: (id: number) => Promise<void>;
  checkAllBreaches: () => Promise<void>;
  strengthMap: Map<number, number>;
  healthOpen: boolean;
  setHealthOpen: (v: boolean) => void;
  checkHealth: () => Promise<import("../../../lib/health").HealthReport | null>;
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