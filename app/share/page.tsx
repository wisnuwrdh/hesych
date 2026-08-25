"use client";

import { useState } from "react";
import { t } from "../../lib/i18n";
import { decryptShare, type SharePayload } from "../../lib/share";
import "../app.css";

type Phase = "enter" | "wrong" | "expired" | "done";

export default function SharePage() {
  const [fragment] = useState(() =>
    typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "",
  );
  const [pw, setPw] = useState("");
  const [phase, setPhase] = useState<Phase>(() =>
    typeof window !== "undefined" && fragment ? "enter" : "expired",
  );
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    if (!fragment) return;
    setBusy(true);
    try {
      const res = await decryptShare(fragment, pw);
      if (res === "expired") {
        setPhase("expired");
      } else {
        setPayload(res);
        setPhase("done");
      }
    } catch {
      setPhase("wrong");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const inc: (k: "pw" | "user" | "notes" | "totp") => boolean = (k) =>
    !!payload?.incl.includes(k);

  return (
    <main className="share-viewer">
      <div className="logo">
        <div className="logo-mark">
          <img src="/logo-dark.webp" className="logo-img logo-img-dark" alt="" width={36} height={36} />
          <img src="/logo-light.webp" className="logo-img logo-img-light" alt="" width={36} height={36} />
        </div>
        <div>
          <div className="logo-name">Hesych</div>
          <div className="logo-sub">Encrypted Share</div>
        </div>
      </div>
      <div className="share-viewer-card">
        {phase === "expired" ? (
          <div className="share-viewer-msg">{t("share.expired")}</div>
        ) : phase === "enter" || phase === "wrong" ? (
          <>
            <div className="sheet-title" style={{ marginBottom: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>{t("share.viewerTitle")}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12, lineHeight: 1.5 }}>
              {t("share.desc")}
            </div>
            <div className="field">
              <div className="field-label">{t("share.passphraseLbl")}</div>
              <div className="field-pw">
                <input
                  type="password"
                  placeholder={t("share.passphrasePh")}
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    if (phase === "wrong") setPhase("enter");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                />
              </div>
            </div>
            {phase === "wrong" ? (
              <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8 }}>
                {t("share.wrongPw")}
              </div>
            ) : null}
            <button className="btn-save" style={{ marginTop: 14, width: "100%" }} disabled={busy || !pw} onClick={unlock}>
              {busy ? "…" : t("share.unlockBtn")}
            </button>
          </>
        ) : payload ? (
          <>
            <div className="sheet-title" style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>{payload.title}</span>
            </div>
            {inc("user") ? (
              <div className="detail-row">
                <span className="detail-label">{t("detail.username")}</span>
                <span style={{ color: "var(--text)" }}>{payload.username || "—"}</span>
                <button className="detail-eye" onClick={() => copyText(payload.username)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            ) : null}
            {inc("pw") ? (
              <div className="detail-row">
                <span className="detail-label">{t("detail.password")}</span>
                <span style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>
                  {revealed ? payload.password : "••••••••••"}
                </span>
                <button className="detail-eye" onClick={() => setRevealed((r) => !r)}>
                  {revealed ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <button className="detail-eye" onClick={() => copyText(payload.password)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            ) : null}
            {inc("notes") && payload.notes ? (
              <div className="detail-row" style={{ alignItems: "flex-start" }}>
                <span className="detail-label">{t("detail.notes")}</span>
                <span style={{ color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{payload.notes}</span>
              </div>
            ) : null}
            {inc("totp") && payload.totp ? (
              <div className="detail-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
                <span className="detail-label">{t("totp.label")}</span>
                <span style={{ color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, wordBreak: "break-all" }}>
                  {payload.totp}
                </span>
                <span style={{ fontSize: 10, color: "var(--dim)" }}>
                  Add this secret to your 2FA app.
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 16, textAlign: "center" }}>
        {t("app.title")} · {t("share.warning")}
      </div>
    </main>
  );
}