"use client";

import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n";
import {
  formatRelativeDate,
  fmtCountdown,
  isPasswordOld,
} from "../../../lib/format";
import { getSecretLock } from "../../../lib/secretlock";
import { generateTOTP, isValidBase32, totpSecsRemaining } from "../../../lib/totp";
import type { VaultItem } from "../../../lib/types";
import { getCategoryMeta, useVault } from "./ctx";
import {
  ChevronDown,
  CopyIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  StarIcon,
  TrashIcon,
} from "./icons";

function BreachBadge({ item }: { item: VaultItem }) {
  const { now } = useVault();
  void now;
  if (item.breachStatus === 2) {
    return (
      <span className="breach-badge breach-pwned">
        {t("breach.breached", { n: "!" })}
      </span>
    );
  }
  return null;
}

function LastChanged({ item }: { item: VaultItem }) {
  if (!item.updatedAt) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">Last changed</span>
      <span
        className="detail-value"
        style={{ color: isPasswordOld(item) ? "var(--warn)" : "var(--dim)" }}
      >
        {formatRelativeDate(item.updatedAt)}
      </span>
    </div>
  );
}

function CustomFields({ item }: { item: VaultItem }) {
  const ctx = useVault();
  const [values, setValues] = useState<Record<number, string>>({});
  const [showIdx, setShowIdx] = useState<number | null>(null);
  const decryptField = ctx.decryptField;
  useEffect(() => {
    if (!item.custom_fields.length) return;
    let live = true;
    for (let i = 0; i < item.custom_fields.length; i++) {
      decryptField(item.id, i).then((v) => {
        if (live) setValues((prev) => ({ ...prev, [i]: v }));
      });
    }
    return () => {
      live = false;
    };
  }, [item.id, item.custom_fields.length, decryptField]);
  if (!item.custom_fields.length) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div className="detail-label" style={{ marginBottom: 6 }}>
        {t("cf.label")}
      </div>
      <div className="cf-list">
        {item.custom_fields.map((f, i) => {
          const isPw = f.type === "password";
          const val = values[i];
          const visible = !isPw || showIdx === i;
          const shown =
            val !== undefined && visible ? val : isPw ? "••••••••" : "(loading…)";
          return (
            <div className="cf-item" key={`${item.id}-${i}`}>
              <div className="cf-item-header">
                <span className="cf-item-name">{f.name}</span>
              </div>
              <div className="cf-item-value-row">
                <span className="cf-item-value">{shown}</span>
                <div className="cf-item-actions">
                  {isPw ? (
                    <button
                      className="cf-item-btn"
                      onClick={() => setShowIdx(showIdx === i ? null : i)}
                    >
                      {isPw && visible ? (
                        <EyeOffIcon width={12} height={12} />
                      ) : (
                        <EyeIcon width={12} height={12} />
                      )}
                    </button>
                  ) : null}
                  <button
                    className="cf-item-btn"
                    onClick={() => ctx.copyField(item.id, i)}
                  >
                    <CopyIcon width={12} height={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TotpBlock({ item }: { item: VaultItem }) {
  const ctx = useVault();
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const decryptTotp = ctx.decryptTotp;
  useEffect(() => {
    let live = true;
    decryptTotp(item.id)
      .then((s) => {
        if (live) {
          setSecret(s);
          if (isValidBase32(s.toUpperCase())) {
            generateTOTP(s).then((c) => live && setCode(c));
          }
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [item.id, decryptTotp]);

  const secs = totpSecsRemaining();
  const pct = Math.round((secs / 30) * 100);
  const invalid = secret !== null && !isValidBase32(secret.toUpperCase());

  if (secret === null || secret === "" || invalid) return null;

  return (
    <div className="totp-block">
      <div className="detail-row">
        <span className="detail-label">{t("totp.label")}</span>
        <span className="detail-value totp-code" style={{ fontFamily: "var(--mono)", fontSize: 15, letterSpacing: 2 }}>
          {code || "······"}
        </span>
        <button
          className="detail-eye"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
            } catch {
              // ignore
            }
          }}
          title={t("totp.copy")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
      <div className="totp-timer">
        <div className="totp-timer-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ItemDetails({ item }: { item: VaultItem }) {
  const ctx = useVault();
  const revPw = ctx.revealed.get(item.id);
  const rev = revPw !== undefined;
  const lock = getSecretLock(item.id);
  void ctx.now;

  if (lock) {
    const elapsed = Math.max(ctx.now - lock.lockedAt, 0);
    const remMs = Math.max(0, lock.durationMs - elapsed);
    const unlockTime = new Date(lock.lockedAt + lock.durationMs);
    const unlockStr = unlockTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const unlockDateStr =
      unlockTime.toDateString() === new Date(ctx.now).toDateString()
        ? unlockStr
        : `${unlockTime.toLocaleDateString([], { month: "short", day: "numeric" })} ${unlockStr}`;
    return (
      <div className="secret-lock-bar">
        <div
          className="secret-lock-info"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LockIcon width={12} height={12} />
            <span style={{ fontWeight: 500 }}>
              {t("detail.locked", { time: unlockDateStr })}
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              color: "var(--dim)",
              fontFamily: "var(--mono)",
              paddingLeft: 18,
            }}
          >
            {t("secretLock.whatTitle")} · digital detox mode
          </span>
        </div>
        <span className="secret-lock-timer">{fmtCountdown(remMs)}</span>
      </div>
    );
  }

  return (
    <div className="item-details">
      <div className="detail-row">
        <span className="detail-label">{t("detail.username")}</span>
        <span className="detail-value">{item.username || "—"}</span>
        <button
          className="detail-eye"
          onClick={() => ctx.copyUsername(item.id)}
        >
          <CopyIcon width={11} height={11} />
        </button>
      </div>
      <div className="detail-row">
        <span className="detail-label">{t("detail.password")}</span>
        <span className={`detail-value${rev ? " revealed" : ""}`}>
          {rev ? revPw : "••••••••••"}
        </span>
        <button className="detail-eye" onClick={() => ctx.toggleReveal(item.id)}>
          {rev ? <EyeOffIcon width={11} height={11} /> : <EyeIcon width={11} height={11} />}
        </button>
      </div>
      {item.notes ? (
        <div className="detail-row">
          <span className="detail-label">{t("detail.notes")}</span>
          <span className="detail-value">{item.notes}</span>
        </div>
      ) : null}
      <TotpBlock item={item} />
      <div className="detail-row">
        <span className="detail-label">{t("breach.detailLabel")}</span>
        <span
          className="detail-value"
          style={{
            color:
              item.breachStatus === 2
                ? "#f87171"
                : item.breachStatus === 1
                  ? "#4ade80"
                  : "var(--dim)",
          }}
        >
          {item.breachStatus === 2
            ? t("breach.breachedSingle", { n: "?" })
            : item.breachStatus === 1
              ? t("breach.safe")
              : t("breach.unchecked")}
        </span>
      </div>
      {item.tags && item.tags.length ? (
        <div style={{ marginTop: 6 }}>
          <div className="tag-list">
            {item.tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <LastChanged item={item} />
      <CustomFields item={item} />
      <div className="detail-panel-actions">
        <button
          className="act-btn copy"
          onClick={() => ctx.copyPassword(item.id)}
        >
          <CopyIcon width={11} height={11} /> {t("detail.copyPw")}
        </button>
        <button
          className="act-btn"
          onClick={() => ctx.openSheet(item)}
        >
          <EditIcon width={11} height={11} /> {t("detail.edit")}
        </button>
        {ctx.isPremium() ? (
          <button
            className="act-btn-icon"
            style={{ color: "var(--accent)", borderColor: "var(--accent-dim)" }}
            onClick={() => ctx.openHist(item)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>{" "}
            <span style={{ fontSize: 11 }}>History</span>
          </button>
        ) : null}
        <button
          className="act-btn-icon"
          style={item.favorite ? { color: "var(--yellow)" } : undefined}
          onClick={() => ctx.toggleFav(item.id)}
        >
          <StarIcon width={12} height={12} />{" "}
          <span style={{ fontSize: 11 }}>
            {item.favorite ? t("detail.unfav") : t("detail.fav")}
          </span>
        </button>
        <button
          className="act-btn-icon"
          style={{ color: "var(--accent)", borderColor: "var(--accent-dim)" }}
          onClick={() => ctx.setPendingSecretLock(item)}
        >
          <LockIcon width={12} height={12} />{" "}
          <span style={{ fontSize: 11 }}>{t("detail.lockSecret")}</span>
        </button>
        <button
          className="act-btn del"
          onClick={() => ctx.setPendingDelete(item)}
        >
          <TrashIcon width={11} height={11} /> {t("detail.delete")}
        </button>
      </div>
    </div>
  );
}

export function ItemCard({ item }: { item: VaultItem }) {
  const ctx = useVault();
  const letter = item.title.charAt(0).toUpperCase() || "?";
  const cat = getCategoryMeta(item.category);
  const isFav = item.favorite;
  const lock = getSecretLock(item.id);
  const expanded = ctx.expanded.has(item.id);
  const isLocked = lock !== null;

  const onHeaderClick = () => ctx.toggleExpand(item.id);

  return (
    <div
      className={`item-card${expanded ? " expanded" : ""}${isFav ? " pinned" : ""}${isLocked ? " secret-locked" : ""}`}
      data-id={item.id}
    >
      <div
        className="item-header"
        style={{ userSelect: "none" }}
        onClick={onHeaderClick}
      >
        <div className={`item-avatar c${item.color || 0}`}>
          {letter}
          {isFav ? <span className="fav-dot" /> : null}
        </div>
        <div className="item-info">
          <div className="item-title">
            {item.title}
            <span className={`cat-badge ${cat.cls}`}>{cat.label}</span>
            {isLocked ? (
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "var(--mono)",
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  padding: "1px 6px",
                  borderRadius: 10,
                  flexShrink: 0,
                }}
              >
                {t("card.locked")}
              </span>
            ) : null}
            <BreachBadge item={item} />
            {isPasswordOld(item) && !isLocked ? (
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "var(--mono)",
                  color: "var(--warn)",
                  background: "#2a1e08",
                  padding: "1px 6px",
                  borderRadius: 10,
                  flexShrink: 0,
                }}
              >
                ⚠️ {t("expiry.badge")}
              </span>
            ) : null}
          </div>
          <div className="item-user">{item.username || "—"}</div>
        </div>
        <span className={`item-chevron${expanded ? " open" : ""}`}>
          <ChevronDown width={14} height={14} />
        </span>
      </div>
      {expanded && !isLocked ? <ItemDetails item={item} /> : null}
    </div>
  );
}

export function DetailPanel() {
  const ctx = useVault();
  const item = ctx.detailId
    ? ctx.items.find((i) => i.id === ctx.detailId) || null
    : null;
  if (!item) {
    return (
      <div className="detail-panel">
        <div className="detail-panel-empty">
          <LockIcon width={36} height={36} opacity={0.25} />
          <p>Select an item to view details</p>
        </div>
      </div>
    );
  }
  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <div className={`detail-panel-avatar c${item.color || 0}`}>
          {item.title.charAt(0).toUpperCase() || "?"}
        </div>
        <div>
          <div className="detail-panel-title">{item.title}</div>
          <div className="detail-panel-value" style={{ color: "var(--dim)" }}>
            {getCategoryMeta(item.category).label}
          </div>
        </div>
        <button
          className="detail-panel-close"
          onClick={() => ctx.setDetailId(null)}
        >
          <ChevronDown width={14} height={14} />
        </button>
      </div>
      <ItemDetails item={item} />
    </div>
  );
}