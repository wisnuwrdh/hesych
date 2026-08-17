"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../../../lib/i18n";
import type { HealthReport } from "../../../lib/health";
import { useVault } from "./ctx";

function Section({
  title,
  desc,
  noState,
  problem,
  onFix,
  accent,
}: {
  title: string;
  desc: string;
  noState?: string;
  problem?: { label: string; count: number } | null;
  onFix?: () => void;
  accent: "red" | "amber" | "accent";
}) {
  const color =
    accent === "red" ? "#f87171" : accent === "amber" ? "var(--warn)" : "var(--accent)";
  return (
    <div className="health-section">
      <div className="health-section-title">{title}</div>
      {problem ? (
        <>
          <div className="health-section-desc">{desc}</div>
          {onFix ? (
            <button
              className="health-fix-btn"
              style={{ color, borderColor: "transparent", background: "var(--surface2)" }}
              onClick={onFix}
            >
              {t("health.fixBtn")}
            </button>
          ) : null}
        </>
      ) : (
        <div className="health-ok-line">{noState ?? ""}</div>
      )}
    </div>
  );
}

export function HealthSheet() {
  const ctx = useVault();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [err, setErr] = useState(false);
  const scanningRef = useRef(false);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!ctx.healthOpen || !firstRun.current) return;
    firstRun.current = false;
    if (!ctx.isPremium()) return;
    if (scanningRef.current) return;
    scanningRef.current = true;
    setReport(null);
    setErr(false);
    ctx
      .checkHealth()
      .then((r) => {
        if (r) setReport(r);
      })
      .catch(() => setErr(true))
      .finally(() => {
        scanningRef.current = false;
      });
  }, [ctx.healthOpen, ctx]);

  const reopen = useCallback(() => {
    firstRun.current = true;
    setReport(null);
    setErr(false);
  }, []);

  if (!ctx.healthOpen) return null;

  const apply = (patch: Partial<Pick<import("./ctx").AdvFilter, "status" | "strength" | "age">>) => {
    ctx.setAdv({ ...ctx.adv, ...patch, tags: ctx.adv.tags });
    ctx.setHealthOpen(false);
  };

  const levelText =
    report?.level === "great"
      ? t("health.great")
      : report?.level === "good"
        ? t("health.good")
        : report?.level === "fair"
          ? t("health.fair")
          : t("health.poor");

  return (
    <>
      <div className="modal-overlay show" onClick={() => ctx.setHealthOpen(false)} />
      <div className="sheet show" id="healthSheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="12 6 12 12 9 12" />
          </svg>
          <span>{t("health.title")}</span>
          <button className="sheet-close" onClick={() => ctx.setHealthOpen(false)}>
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
                {t("health.title")} · PRO
              </div>
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                {t("premium.lockedDesc")}
              </div>
            </div>
            <span className="premium-badge">PRO</span>
          </div>
        ) : report === null ? (
          <div className="health-scanning">
            <div className="spinner" />
            <span>{t("health.scanning")}</span>
          </div>
        ) : err ? (
          <div className="health-scanning">{t("health.scanErr")}</div>
        ) : (
          <div className="health-body">
            <div className="health-score-wrap">
              <div className="health-score" style={{ color: report.score >= 85 ? "#4ade80" : report.score >= 50 ? "var(--warn)" : "#f87171" }}>
                {report.score}
              </div>
              <div className="health-level">{levelText}</div>
              <div className="health-recap">
                {t("health.recap", {
                  total: report.total,
                  checked: report.checked,
                })}
              </div>
            </div>

            {report.total === 0 ? (
              <div className="health-ok-line" style={{ marginTop: 12 }}>
                {t("health.empty")}
              </div>
            ) : (
              <div className="health-sections">
                <Section
                  accent="red"
                  title={t("health.breachedTitle")}
                  desc={t("health.breachedDesc", { n: report.breached })}
                  noState={t("health.noBreach")}
                  problem={report.breached > 0 ? { label: t("breach.detailLabel"), count: report.breached } : null}
                  onFix={() => apply({ status: "breached" })}
                />
                <Section
                  accent="accent"
                  title={t("health.dupTitle")}
                  desc={t("health.dupDesc", { n: report.dupExtra })}
                  noState={t("health.noDup")}
                  problem={report.dupExtra > 0 ? { label: "Reused", count: report.dupGroups.length } : null}
                />
                <Section
                  accent="amber"
                  title={t("health.weakTitle")}
                  desc={t("health.weakDesc", { n: report.weak })}
                  noState={t("health.noWeak")}
                  problem={report.weak > 0 ? { label: "Weak", count: report.weak } : null}
                  onFix={() => apply({ strength: "weak" })}
                />
                <Section
                  accent="amber"
                  title={t("health.oldTitle")}
                  desc={t("health.oldDesc", { n: report.oldCount })}
                  noState={t("health.noOld")}
                  problem={report.oldCount > 0 ? { label: "Old", count: report.oldCount } : null}
                  onFix={() => apply({ age: "old" })}
                />
              </div>
            )}

            <div className="sheet-actions" style={{ marginTop: 16 }}>
              <button className="btn-save" onClick={reopen}>
                {t("health.rescan")}
              </button>
              <button className="btn-cancel" onClick={() => ctx.setHealthOpen(false)}>
                {t("health.closeBtn")}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}