"use client";

// Upgrade funnel page - pure marketing shell (pricing/features/buy/compare)
// using verbatim legacy markup. License activation happens ONLY inside the
// vault (menu ⋮ → Enter License Key) - see VaultApp + lib/license.

import { useEffect, useState } from "react";
import { t } from "../../lib/i18n";
import {
  deactivate as deactivateLicense,
  getMeta as getLicenseMeta,
  isActive as licenseIsActive,
} from "../../lib/license";

export function UpgradeClient({
  css,
  headHtml,
  activatedHtml,
  buyHtml,
  compareHtml,
}: {
  css: string;
  headHtml: string;
  activatedHtml: string;
  buyHtml: string;
  compareHtml: string;
}) {
  const [status, setStatus] = useState<"buy" | "active">("buy");
  const [meta, setMeta] = useState<ReturnType<typeof getLicenseMeta>>(null);

  // localStorage hanya tersedia di client - flip setelah mount agar SSR aman
  useEffect(() => {
    // defer agar tidak memicu cascading render sinkron (react-hooks lint)
    const id = requestAnimationFrame(() => {
      if (licenseIsActive()) {
        setStatus("active");
        setMeta(getLicenseMeta());
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: headHtml }} />

      {status === "active" ? (
        <div className="wrap">
          <div dangerouslySetInnerHTML={{ __html: activatedHtml }} />
          <div
            className="card"
            style={{ marginTop: -8, marginBottom: 16, textAlign: "center" }}
          >
            {meta?.email ? (
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--sub)" }}>
                {meta.email}
              </div>
            ) : null}
            {meta?.key ? (
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>
                {meta.key}
              </div>
            ) : null}
            <button
              type="button"
              className="act-btn del"
              style={{ margin: "12px auto 0", display: "flex" }}
              onClick={() => {
                deactivateLicense();
                setStatus("buy");
                setMeta(null);
              }}
            >
              {t("premium.deactivateBtn")}
            </button>
          </div>
        </div>
      ) : (
        <div className="wrap">
          {/* Pricing card + trust badges - verbatim legacy markup */}
          <div dangerouslySetInnerHTML={{ __html: buyHtml.replace('id="buySection"', 'data-buy') }} />

          <p style={{ fontSize: 11, color: "var(--dim)", textAlign: "center", margin: "-6px 0 16px" }}>
            After purchase, open Hesych → menu ⋮ → Enter License Key
          </p>

          <div dangerouslySetInnerHTML={{ __html: compareHtml }} />
          <div style={{ height: 32 }} />
        </div>
      )}
    </>
  );
}
