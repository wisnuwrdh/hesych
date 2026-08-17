"use client";

import { useState } from "react";
import { t } from "../../../lib/i18n";
import {
  SHARE_EXPIRY_HOURS,
  shareExpiryKey,
  type ShareInclude,
} from "../../../lib/share";
import { formatShareExpiry } from "../../../lib/format";
import { useVault } from "./ctx";

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="gen-option-row">
      <div className="gen-option-label">{label}</div>
      <label className="gen-toggle">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="gen-toggle-slider" />
      </label>
    </div>
  );
}

export function ShareSheet() {
  const ctx = useVault();
  const [pw, setPw] = useState("");
  const [hours, setHours] = useState(24);
  const [incl, setIncl] = useState<ShareInclude[]>(["pw", "user"]);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const item = ctx.shareItem;
  if (!ctx.shareOpen || !item) return null;

  const toggleIncl = (k: ShareInclude) =>
    setIncl((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );

  const generate = async () => {
    if (pw.length < 8) {
      setErr(t("encExport.minLen"));
      return;
    }
    setBusy(true);
    setErr("");
    setLink("");
    const res = await ctx.buildShareLink(item, pw, hours, incl);
    setBusy(false);
    if ("err" in res) {
      setErr(res.err);
      return;
    }
    setCopied(false);
    setLink(res.link);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className="modal-overlay show" onClick={() => ctx.setShareOpen(false)} />
      <div className="sheet show" id="shareSheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>{t("share.title")}</span>
          <button className="sheet-close" onClick={() => ctx.setShareOpen(false)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!ctx.isPremium() ? (
          <div className="premium-gate" style={{ marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
                {t("share.title")} · PRO
              </div>
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                {t("share.premiumHint")}
              </div>
            </div>
            <span className="premium-badge">PRO</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--dim)", margin: "6px 0 12px", lineHeight: 1.5 }}>
              {t("share.desc")}
            </div>

            <div className="field">
              <div className="field-label">{t("share.passphraseLbl")}</div>
              <div className="field-pw">
                <input
                  type="password"
                  placeholder={t("share.passphrasePh")}
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <button
                  type="button"
                  className="pw-eye"
                  onClick={(e) => {
                    const el = e.currentTarget.previousElementSibling;
                    if (el instanceof HTMLInputElement)
                      el.type = el.type === "password" ? "text" : "password";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="field">
              <div className="field-label">{t("share.expiry")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SHARE_EXPIRY_HOURS.map((h) => (
                  <button
                    key={h}
                    className={`gen-action-btn primary${hours === h ? "" : " secondary"}`}
                    style={{ fontSize: 11, padding: "8px 10px" }}
                    onClick={() => setHours(h)}
                    aria-pressed={hours === h}
                  >
                    {t(shareExpiryKey(h))}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 6 }}>
              <div className="field-label">{t("share.includes")}</div>
              <Toggle label={t("share.inclPw")} checked={incl.includes("pw")} disabled onChange={() => {}} />
              <Toggle label={t("share.inclUser")} checked={incl.includes("user")} onChange={() => toggleIncl("user")} />
              <Toggle label={t("share.inclNotes")} checked={incl.includes("notes")} onChange={() => toggleIncl("notes")} />
              <Toggle label={t("share.inclTotp")} checked={incl.includes("totp")} onChange={() => toggleIncl("totp")} />
            </div>

            <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 4, lineHeight: 1.5 }}>
              {t("share.warning")}
            </div>

            {err ? (
              <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8 }}>
                {err}
              </div>
            ) : null}

            {link ? (
              <div className="share-link-box" style={{ marginTop: 12 }}>
                <div className="share-link-text">{link}</div>
                <button
                  className="gen-action-btn primary"
                  style={{ marginTop: 10, width: "100%" }}
                  onClick={copyLink}
                >
                  {copied ? t("share.linkCopied") : t("share.copyLink")}
                </button>
                <button
                  className="gen-action-btn secondary"
                  style={{ marginTop: 8, width: "100%" }}
                  onClick={() => {
                    setLink("");
                    setPw("");
                  }}
                >
                  {t("share.regenerate")}
                </button>
              </div>
            ) : (
              <div className="sheet-actions" style={{ marginTop: 14 }}>
                <button className="btn-save" disabled={busy} onClick={generate}>
                  {busy ? "…" : t("share.generateBtn")}
                </button>
                <button className="btn-cancel" onClick={() => ctx.setShareOpen(false)}>
                  {t("import.cancelBtn")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export function ShareLogSheet() {
  const ctx = useVault();
  if (!ctx.shareLogOpen) return null;

  return (
    <>
      <div className="modal-overlay show" onClick={() => ctx.setShareLogOpen(false)} />
      <div className="sheet show" id="shareLogSheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>{t("share.logTitle")}</span>
          <button className="sheet-close" onClick={() => ctx.setShareLogOpen(false)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {ctx.shareLog.length === 0 ? (
          <div className="gen-preview" style={{ marginTop: 12, flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, color: "var(--dim)" }}>{t("share.logEmpty")}</span>
          </div>
        ) : (
          <div className="share-log-list" style={{ marginTop: 8 }}>
            {ctx.shareLog.map((s) => {
              const st = formatShareExpiry(s.expTs);
              return (
                <div className="share-log-item" key={s.slid}>
                  <div className="share-log-main">
                    <div className="share-log-title">{s.itemTitle}</div>
                    <div className="share-log-link">{s.link}</div>
                    <div
                      className="share-log-exp"
                      style={{ color: st.expired ? "var(--dim)" : st.warn ? "var(--warn)" : "var(--sub)" }}
                    >
                      {st.label}
                    </div>
                  </div>
                  <button
                    className="share-log-del"
                    onClick={() => s.slid !== undefined && ctx.deleteShareLog(s.slid)}
                    title="Delete"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="sheet-actions" style={{ marginTop: 12 }}>
          <button className="btn-cancel" style={{ width: "100%" }} onClick={() => ctx.setShareLogOpen(false)}>
            {t("health.closeBtn")}
          </button>
        </div>
      </div>
    </>
  );
}