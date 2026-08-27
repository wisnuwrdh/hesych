"use client";

import { useState } from "react";
import { t } from "../../../lib/i18n";
import { renderHtmlKey } from "./ui";
import type { BackupBundle } from "../../../lib/backup";
import { useVault } from "./ctx";

function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <>
      <div className="sheet-handle" />
      <div className="sheet-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>{title}</span>
        <button className="sheet-close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </>
  );
}

export function ExportSheet() {
  const ctx = useVault();
  const [mode, setMode] = useState<"master" | "custom">("master");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ctx.backupOpen) return null;

  const onExport = async () => {
    if (mode === "custom") {
      if (pw.length < 8) {
        setMsg({ text: t("encExport.minLen"), err: true });
        return;
      }
      if (pw !== confirm) {
        setMsg({ text: t("encExport.noMatch"), err: true });
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    const err = await ctx.doExport(mode, pw || undefined);
    setBusy(false);
    if (err) {
      setMsg({ text: err, err: true });
      return;
    }
    setPw("");
    setConfirm("");
    setMsg({ text: "Backup downloaded", err: false });
    ctx.setBackupOpen(false);
  };

  return (
    <>
      <div className="overlay show" onClick={() => ctx.setBackupOpen(false)} />
      <div className="sheet show" id="encExportSheet">
        <SheetHead title={t("encExport.title")} onClose={() => ctx.setBackupOpen(false)} />
        <div style={{ fontSize: 12, color: "var(--dim)", margin: "4px 0 16px", lineHeight: 1.5 }}>
          {t("encExport.desc")}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button
            className="gen-action-btn primary"
            style={{ flex: 1, fontSize: 12, padding: "10px 8px" }}
            onClick={() => setMode("master")}
            aria-pressed={mode === "master"}
          >
            {t("encExport.useMaster")}
          </button>
          <button
            className="gen-action-btn primary"
            style={{ flex: 1, fontSize: 12, padding: "10px 8px" }}
            onClick={() => setMode("custom")}
            aria-pressed={mode === "custom"}
          >
            {t("encExport.useCustom")}
          </button>
        </div>

        {mode === "custom" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <div className="field-label">{t("encExport.pwLabel")}</div>
              <div className="field-pw">
                <input
                  type={ showPw ? "text" : "password" }
                  placeholder={t("encExport.pwPh")}
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <button
                  type="button"
                  className="pw-eye"
                  onClick={() => setShowPw(v => !v)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="field">
              <div className="field-label">{t("encExport.confirmLabel")}</div>
              <div className="field-pw">
                <input
                  type={ showConfirm ? "text" : "password" }
                  placeholder={t("encExport.confirmPh")}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  type="button"
                  className="pw-eye"
                  onClick={() => setShowConfirm(v => !v)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4, marginBottom: 10, lineHeight: 1.5 }}>
          {mode === "master"
            ? "Encrypted for this vault only. For cross-device backup, use custom password."
            : "Extra password-protected layer. Restores on any device/vault with the custom password."}
        </div>
        <div id="cpMsg" style={{ fontSize: 11, color: msg?.err ? "var(--danger)" : "var(--sub)", minHeight: 16, marginBottom: 10 }}>
          {msg?.text ?? ""}
        </div>
        <div className="sheet-actions">
          <button className="btn-save" id="doExportBtn" disabled={busy} onClick={onExport}>
            {busy ? "…" : t("encExport.exportBtn")}
          </button>
          <button className="btn-cancel" onClick={() => ctx.setBackupOpen(false)}>
            {t("encExport.cancelBtn")}
          </button>
        </div>
      </div>
    </>
  );
}

export function ImportSheet() {
  const ctx = useVault();
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [pw, setPw] = useState("");

const [showImportPw, setShowImportPw] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const needsPw = bundle?.pwMode === "custom";

  if (!ctx.importOpen) return null;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text) as BackupBundle;
      setBundle(parsed);
      setFile(f);
      setFileName(f.name);
      setPw("");
      setMsg(null);
    } catch {
      setBundle(null);
      setFile(null);
      setFileName("");
      setMsg({ text: "Not a valid backup file", err: true });
    }
  };

  const count =
    bundle?.pwMode === "custom"
      ? "?"
      : Array.isArray(bundle?.data)
        ? (bundle?.data as unknown[]).length
        : 0;

  const onImport = async () => {
    if (!bundle || !file) {
      setMsg({ text: "Choose a backup file first", err: true });
      return;
    }
    setBusy(true);
    setMsg(null);
    const err = await ctx.doImport(file, mode, pw || undefined);
    setBusy(false);
    if (err) {
      setMsg({ text: err, err: true });
      return;
    }
    setBundle(null);
    setFile(null);
    setFileName("");
    setPw("");
    ctx.setImportOpen(false);
  };

  return (
    <>
      <div className="overlay show" onClick={() => ctx.setImportOpen(false)} />
      <div className="sheet show" id="encImportSheet">
        <SheetHead title={t("import.title")} onClose={() => ctx.setImportOpen(false)} />
        <div style={{ fontSize: 12, color: "var(--dim)", margin: "4px 0 16px", lineHeight: 1.5 }}>
          {renderHtmlKey("import.desc")}
        </div>

        <label className="import-file-row">
          <input type="file" accept=".vault,.json,application/json" onChange={pick} style={{ display: "none" }} />
          <span>{fileName || "Choose file…"}</span>
          <button className="tag-input-btn" type="button">Browse</button>
        </label>

        {bundle ? (
          <>
            <div style={{ fontSize: 11, color: "var(--sub)", margin: "10px 0 4px", fontFamily: "var(--mono)" }}>
              {`${bundle.pwMode} · ${count} items`}
            </div>
            <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
              <button
                className="gen-action-btn primary"
                style={{ flex: 1, fontSize: 12, padding: "10px 8px" }}
                onClick={() => setMode("merge")}
                aria-pressed={mode === "merge"}
              >
                {t("import.mergeBtn")}
              </button>
              <button
                className="gen-action-btn primary"
                style={{ flex: 1, fontSize: 12, padding: "10px 8px" }}
                onClick={() => setMode("replace")}
                aria-pressed={mode === "replace"}
              >
                {t("import.replaceBtn")}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--warn)", marginBottom: 10, lineHeight: 1.5 }}>
              {mode === "merge" ? t("import.mergeNote") : t("import.replaceNote")}
            </div>
          </>
        ) : null}

        {needsPw ? (
          <div className="field">
            <div className="field-label">{t("encExport.pwLabel")}</div>
            <div className="field-pw">
              <input type={ showImportPw ? "text" : "password" } placeholder="Custom backup password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button
                type="button"
                className="pw-eye"
                onClick={() => setShowImportPw(v => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}

        <div id="cpMsg" style={{ fontSize: 11, color: msg?.err ? "var(--danger)" : "var(--sub)", minHeight: 16, marginBottom: 10 }}>
          {msg?.text ?? ""}
        </div>
        <div className="sheet-actions">
          <button className="btn-save" disabled={busy || !bundle} onClick={onImport}>
            {busy ? "…" : "Import"}
          </button>
          <button className="btn-cancel" onClick={() => ctx.setImportOpen(false)}>
            {t("import.cancelBtn")}
          </button>
        </div>
      </div>
    </>
  );
}