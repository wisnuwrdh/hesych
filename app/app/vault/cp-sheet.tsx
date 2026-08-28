"use client";

import { renderHtmlKey } from "./ui";

import { useState } from "react";
import { t } from "../../../lib/i18n";
import { useVault } from "./ctx";

function EyeSvg({ off }: { off?: boolean }) {
  return off ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ChangePwSheet() {
  const ctx = useVault();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [oldVis, setOldVis] = useState(false);
  const [newVis, setNewVis] = useState(false);
  const [confirmVis, setConfirmVis] = useState(false);

  // Reset reveal state when the sheet closes (render-time adjustment).
  const [lastOpen, setLastOpen] = useState(ctx.cpOpen);
  if (lastOpen !== ctx.cpOpen) {
    setLastOpen(ctx.cpOpen);
    if (!ctx.cpOpen) {
      setOldVis(false);
      setNewVis(false);
      setConfirmVis(false);
    }
  }

  if (!ctx.cpOpen) return null;

  const onSave = async () => {
    if (busy) return;
    if (!oldPw || !newPw || !confirmPw) {
      setMsg({ text: t("cp.allRequired"), err: true });
      return;
    }
    if (newPw !== confirmPw) {
      setMsg({ text: t("cp.noMatch"), err: true });
      return;
    }
    if (newPw.length < 12) {
      setMsg({ text: t("cp.minLen"), err: true });
      return;
    }
    setBusy(true);
    setMsg({ text: t("cp.verifying") });
    const err = await ctx.changeMasterPw(oldPw, newPw);
    setBusy(false);
    if (err) {
      setMsg({ text: t(err), err: true });
      return;
    }
    setMsg({ text: "Done. Vault re-encrypted with the new master password.", err: true });
    setOldPw("");
    setNewPw("");
    setConfirmPw("");
    ctx.setCpOpen(false);
  };

  return (
    <>
      <div className="overlay show" onClick={ctx.closeSheet} />
      <div className="sheet show" id="cpSheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
          </svg>
          <span>{t("cpSheet.title")}</span>
          <button className="sheet-close" onClick={() => ctx.setCpOpen(false)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div id="cpWarnBox" style={{ fontSize: 11, color: "var(--sub)", background: "var(--accent-dim)", border: "1px solid #3a2f7a", borderRadius: 8, padding: "8px 12px", marginBottom: 14, lineHeight: 1.5 }}>
          ⚠️ {renderHtmlKey("cpSheet.warn")}
        </div>
        <div className="field">
          <div className="field-label">{t("cpSheet.oldLabel")}</div>
          <div className="field-pw">
            <input
              type={oldVis ? "text" : "password"}
              id="cpOld"
              placeholder={t("cpSheet.oldPh")}
              autoComplete="current-password"
              spellCheck={false}
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
            <button className="pw-eye" type="button" title={oldVis ? "Hide password" : "Show password"} onClick={() => setOldVis((v) => !v)}>
              <EyeSvg off={oldVis} />
            </button>
          </div>
        </div>
        <div className="field">
          <div className="field-label">{t("cpSheet.newLabel")}</div>
          <div className="field-pw">
            <input
              type={newVis ? "text" : "password"}
              id="cpNew"
              placeholder={t("cpSheet.newPh")}
              autoComplete="new-password"
              spellCheck={false}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button className="pw-eye" type="button" title={newVis ? "Hide password" : "Show password"} onClick={() => setNewVis((v) => !v)}>
              <EyeSvg off={newVis} />
            </button>
          </div>
        </div>
        <div className="field">
          <div className="field-label">{t("cpSheet.confirmLabel")}</div>
          <div className="field-pw">
            <input
              type={confirmVis ? "text" : "password"}
              id="cpConfirm"
              placeholder={t("cpSheet.confirmPh")}
              autoComplete="new-password"
              spellCheck={false}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
            <button className="pw-eye" type="button" title={confirmVis ? "Hide password" : "Show password"} onClick={() => setConfirmVis((v) => !v)}>
              <EyeSvg off={confirmVis} />
            </button>
          </div>
        </div>
        <div id="cpMsg" style={{ fontSize: 11, color: msg?.err ? "var(--danger)" : "var(--sub)", minHeight: 16, marginBottom: 10 }}>
          {msg?.text ?? ""}
        </div>
        <div className="sheet-actions">
          <button className="btn-save" id="doChangePwBtn" disabled={busy} onClick={onSave}>
            {busy ? t("cp.reEncrypting") : t("cpSheet.saveBtn")}
          </button>
          <button className="btn-cancel" onClick={() => ctx.setCpOpen(false)}>
            {t("cpSheet.cancelBtn")}
          </button>
        </div>
      </div>
    </>
  );
}