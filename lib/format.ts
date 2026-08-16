import { OLD_PASSWORD_MS } from "./constants";
import { t } from "./i18n";

export function isPasswordOld(item: { updatedAt: number | null }): boolean {
  if (!item.updatedAt) return false;
  return Date.now() - item.updatedAt > OLD_PASSWORD_MS;
}

export function formatRelativeDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const ageMs = Date.now() - ts;
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "Today";
  if (days < 7) return days + " days ago";
  const months = Math.floor(days / 30);
  if (months < 1) return days + " days ago";
  if (months < 12) return t("expiry.months", { n: months });
  const years = Math.floor(months / 12);
  return years + (years === 1 ? " year ago" : " years ago");
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0)
    return `${d}${t("cd.day")} ${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  if (h > 0)
    return `${h}${t("cd.hour")} ${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface ShareExpiry {
  label: string;
  expired: boolean;
  warn: boolean;
}

export function formatShareExpiry(expTs: number): ShareExpiry {
  const rem = expTs - Date.now();
  if (rem <= 0)
    return { label: t("share.logExpired"), expired: true, warn: false };
  const hrs = Math.floor(rem / 3600000);
  const mins = Math.floor((rem % 3600000) / 60000);
  const warn = rem < 3600000;
  if (hrs >= 24) {
    const days = Math.floor(hrs / 24);
    return { label: `${days}d left`, expired: false, warn };
  }
  if (hrs > 0) return { label: `${hrs}h ${mins}m left`, expired: false, warn };
  return { label: `${mins}m left`, expired: false, warn: true };
}

export function formatShareCreated(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` ${time}`
  );
}