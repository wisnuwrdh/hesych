"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "../../../lib/i18n";
import {
  DEFAULT_GEN,
  generateOne,
  type GenOptions,
} from "../../../lib/passphrase";
import { useVault } from "./ctx";

let optsStore: GenOptions = { ...DEFAULT_GEN };

function Toggle({
  label,
  checked,
  onChange,
  sub,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  sub?: string;
}) {
  return (
    <div className="gen-option-row">
      <div>
        <div className="gen-option-label">{label}</div>
        {sub ? <div className="gen-option-sub">{sub}</div> : null}
      </div>
      <label className="gen-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="gen-toggle-slider" />
      </label>
    </div>
  );
}

export function GenSheet() {
  const ctx = useVault();
  const [opts, setOpts] = useState<GenOptions>(optsStore);
  const [pw, setPw] = useState(() => generateOne(optsStore));
  const [bulkCount, setBulkCount] = useState(5);
  const [bulk, setBulk] = useState<string[]>(() =>
    Array.from({ length: 5 }, () => generateOne(optsStore)),
  );
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedSingle, setCopiedSingle] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeGen = ctx.setGenOpen;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeGen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [closeGen]);

  const regen = () => {
    setPw(generateOne(opts));
    setBulk(Array.from({ length: bulkCount }, () => generateOne(opts)));
  };

  const changeCount = (n: number) => {
    const c = Math.max(1, Math.min(50, Math.round(n)));
    setBulkCount(c);
    setBulk(Array.from({ length: c }, () => generateOne(opts)));
  };

  const update = (patch: Partial<GenOptions>) => {
    const next = { ...opts, ...patch };
    optsStore = next;
    setOpts(next);
    setPw(generateOne(next));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pw);
      setCopiedSingle(true);
      setTimeout(() => setCopiedSingle(false), 1500);
      setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30000);
    } catch {
      // ignore
    }
  };

  const copyOne = async (p: string, i: number) => {
    try {
      await navigator.clipboard.writeText(p);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // ignore
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(bulk.join("\n"));
      setCopiedAll(true);
      setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
        setCopiedAll(false);
      }, 30000);
    } catch {
      // ignore
    }
  };

  const CopySvg = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

  return (
    <>
      <div className="overlay show" id="genOverlay" />
      <div className="sheet show" id="genSheet" ref={ref}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>{t("gen.title")}</span>
          <button className="sheet-close" onClick={() => ctx.setGenOpen(false)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="gen-mode-tabs">
          <button
            className={`gen-mode-tab${opts.mode === "password" ? " active" : ""}`}
            onClick={() => update({ mode: "password" })}
          >
            {t("gen.modePassword")}
          </button>
          <button
            className={`gen-mode-tab${opts.mode === "passphrase" ? " active" : ""}`}
            onClick={() => update({ mode: "passphrase" })}
          >
            {t("gen.modePassphrase")}
          </button>
        </div>

        <div className="gen-preview">
          <span className="gen-preview-pw">{pw}</span>
          <div className="gen-preview-actions">
            <button
              className="gen-action-btn primary"
              onClick={() => ctx.useGenPassword(pw)}
            >
              {t("gen.useThis")}
            </button>
            <button
              className="gen-action-btn secondary"
              onClick={regen}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {t("gen.regenerate")}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            className="gen-action-btn secondary"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={copy}
          >
            {CopySvg}
            {copiedSingle ? t("gen.copied") : "Copy"}
          </button>
        </div>

        <div style={{ padding: "0 2px" }}>
          {opts.mode === "password" ? (
            <>
              <div className="gen-option-row">
                <div><div className="gen-option-label">{t("gen.length")}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    className="gen-slider"
                    min={8}
                    max={128}
                    value={opts.length}
                    onChange={(e) => update({ length: Number(e.target.value) })}
                  />
                  <span className="gen-slider-val">{opts.length}</span>
                </div>
              </div>
              <Toggle label={t("gen.includeUpper")} checked={opts.upper} onChange={(v) => update({ upper: v })} />
              <Toggle label={t("gen.includeLower")} checked={opts.lower} onChange={(v) => update({ lower: v })} />
              <Toggle label={t("gen.includeNumbers")} checked={opts.numbers} onChange={(v) => update({ numbers: v })} />
              <Toggle label={t("gen.includeSymbols")} checked={opts.symbols} onChange={(v) => update({ symbols: v })} />
              <Toggle
                label={t("gen.excludeAmbiguous")}
                sub="Avoids 0/O, l/1/I"
                checked={opts.excludeAmbiguous}
                onChange={(v) => update({ excludeAmbiguous: v })}
              />
            </>
          ) : (
            <>
              <div className="gen-option-row">
                <div><div className="gen-option-label">{t("gen.words")}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    className="gen-slider"
                    min={3}
                    max={8}
                    value={opts.words}
                    onChange={(e) => update({ words: Number(e.target.value) })}
                  />
                  <span className="gen-slider-val">{opts.words}</span>
                </div>
              </div>
              <div className="gen-option-row">
                <div>
                  <div className="gen-option-label">{t("gen.separator")}</div>
                  <div className="gen-option-sub">
                    e.g. word{opts.separator}word{opts.separator}word
                  </div>
                </div>
                <input
                  className="gen-separator-input"
                  maxLength={10}
                  value={opts.separator}
                  onChange={(e) => {
                    const sep = e.target.value || "-";
                    optsStore = { ...opts, separator: sep };
                    setOpts({ ...opts, separator: sep });
                    setPw(generateOne({ ...opts, separator: sep }));
                  }}
                  onBlur={() => {
                    if (!opts.separator) update({ separator: "-" });
                  }}
                />
              </div>
              <Toggle label={t("gen.capitalize")} checked={opts.capitalize} onChange={(v) => update({ capitalize: v })} />
              <Toggle label={t("gen.includeNumber")} checked={opts.includeNumber} onChange={(v) => update({ includeNumber: v })} />
            </>
          )}

                      {ctx.isPremium() ? (
              <div className="gen-bulk">
                <div className="gen-section-title">{t("gen.bulk")}</div>
                <div className="gen-option-row">
                  <div>
                    <div className="gen-option-label">
                      {t("gen.bulkCount", { n: bulkCount })}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="range"
                      className="gen-slider"
                      min={1}
                      max={50}
                      value={bulkCount}
                      onChange={(e) => changeCount(Number(e.target.value))}
                    />
                    <span className="gen-slider-val">{bulkCount}</span>
                  </div>
                </div>
                <div className="gen-bulk-list">
                  {bulk.map((p, i) => (
                    <div className="gen-bulk-item" key={`${i}-${p.slice(0, 4)}`}>
                      <span className="gen-bulk-pw">{p}</span>
                      <button
                        className="gen-bulk-copy"
                        title={t("gen.copied")}
                        onClick={() => copyOne(p, i)}
                      >
                        {copiedIdx === i ? (
                          <span style={{ fontSize: 10, color: "#4ade80" }}>✓</span>
                        ) : (
                          CopySvg
                        )}
                      </button>
                      <button className="gen-bulk-use" onClick={() => ctx.useGenPassword(p)}>
                        Use
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="gen-action-btn secondary"
                  style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onClick={copyAll}
                >
                  {CopySvg}
                  {copiedAll ? t("gen.bulkCopied") : t("gen.copyAll")}
                </button>
              </div>
            ) : (
              <div className="premium-gate" style={{ marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
                    {t("gen.bulk")}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                    {t("gen.premiumHint")}
                  </div>
                </div>
                <span className="premium-badge">PRO</span>
              </div>
            )}
        </div>
        <div style={{ height: 20 }} />
      </div>
    </>
  );
}