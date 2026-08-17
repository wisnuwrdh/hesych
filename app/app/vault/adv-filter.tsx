"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "../../../lib/i18n";
import { useVault, type AdvFilter } from "./ctx";

function Opt({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`adv-filter-opt${active ? " active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function AdvFilterBar() {
  const ctx = useVault();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const allTags = [...new Set(ctx.items.flatMap((i) => i.tags || []))].sort();

  const setField = <K extends keyof AdvFilter>(key: K, val: AdvFilter[K]) =>
    ctx.setAdv({ ...ctx.adv, [key]: val });

  const toggleTag = (tag: string) =>
    ctx.setAdv({
      ...ctx.adv,
      tags: ctx.adv.tags.includes(tag)
        ? ctx.adv.tags.filter((x) => x !== tag)
        : [...ctx.adv.tags, tag],
    });

  const clear = () => ctx.setAdv({ tags: [], status: "all", strength: "all", age: "all" });

  return (
    <div className="adv-filter-wrap" ref={ref}>
      <button
        className={`adv-filter-btn${open ? " active" : ""}`}
        id="advFilterBtn"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {t("tags.filterBtn")}
        {ctx.advCount > 0 ? (
          <span className="adv-filter-badge">{ctx.advCount}</span>
        ) : null}
      </button>

      {open ? (
        !ctx.isPremium() ? (
          <div className="adv-filter-panel" id="advFilterPanel">
            <div className="premium-gate" style={{ margin: 0 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
                  {t("tags.filterTitle")}
                </div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                  {t("tags.premiumHint")}
                </div>
              </div>
              <span className="premium-badge">PRO</span>
            </div>
          </div>
        ) : (
          <div className="adv-filter-panel" id="advFilterPanel">
            {allTags.length ? (
              <div className="adv-filter-section">
                <div className="adv-filter-section-title">{t("tags.filterTags")}</div>
                <div className="adv-filter-options">
                  {allTags.map((tag) => (
                    <Opt
                      key={tag}
                      active={ctx.adv.tags.includes(tag)}
                      label={`#${tag}`}
                      onClick={() => toggleTag(tag)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <div className="adv-filter-section">
              <div className="adv-filter-section-title">{t("tags.filterStatus")}</div>
              <div className="adv-filter-options">
                <Opt active={ctx.adv.status === "all"} label={t("tags.statusAll")} onClick={() => setField("status", "all")} />
                <Opt active={ctx.adv.status === "breached"} label={t("tags.statusBreached")} onClick={() => setField("status", "breached")} />
                <Opt active={ctx.adv.status === "safe"} label={t("tags.statusSafe")} onClick={() => setField("status", "safe")} />
                <Opt active={ctx.adv.status === "unchecked"} label={t("tags.statusUnchecked")} onClick={() => setField("status", "unchecked")} />
              </div>
            </div>
            <div className="adv-filter-section">
              <div className="adv-filter-section-title">{t("tags.filterStrength")}</div>
              <div className="adv-filter-options">
                <Opt active={ctx.adv.strength === "all"} label={t("tags.strengthAny")} onClick={() => setField("strength", "all")} />
                <Opt active={ctx.adv.strength === "weak"} label={t("tags.strengthWeak")} onClick={() => setField("strength", "weak")} />
                <Opt active={ctx.adv.strength === "fair"} label={t("tags.strengthFair")} onClick={() => setField("strength", "fair")} />
                <Opt active={ctx.adv.strength === "strong"} label={t("tags.strengthStrong")} onClick={() => setField("strength", "strong")} />
              </div>
            </div>
            <div className="adv-filter-section">
              <div className="adv-filter-section-title">{t("tags.filterAge")}</div>
              <div className="adv-filter-options">
                <Opt active={ctx.adv.age === "all"} label={t("tags.ageAny")} onClick={() => setField("age", "all")} />
                <Opt active={ctx.adv.age === "old"} label={t("tags.ageOld")} onClick={() => setField("age", "old")} />
                <Opt active={ctx.adv.age === "new"} label={t("tags.ageNew")} onClick={() => setField("age", "new")} />
              </div>
            </div>
            {ctx.advCount > 0 ? (
              <button className="adv-filter-clear" onClick={clear}>
                {t("tags.clearFilters")}
              </button>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}