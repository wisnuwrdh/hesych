"use client";

// Interactive upgrade funnel — static shell (head/buy/compare) uses the
// verbatim legacy markup; React adds the license activation form, honest
// device-limit handling, and a proper activated state.

import { useState } from "react";
import { t } from "../../lib/i18n";
import {
  activate as activateLicense,
  deactivate as deactivateLicense,
  getMeta as getLicenseMeta,
  isActive as licenseIsActive,
  removeDevice,
  type DeviceRow,
} from "../../lib/license";

// Module-scope component (React Compiler: never define during render).
function DevicesBox({
  rows,
  busy,
  onRemove,
}: {
  rows: DeviceRow[];
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="field-label">{t("premium.devicesTitle")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((d) => (
          <div
            key={d.device_id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 11,
            }}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {d.device_name}
            </span>
            <button
              type="button"
              className="act-btn del"
              style={{ flex: "0 0 auto", padding: "4px 8px" }}
              disabled={busy}
              onClick={() => onRemove(d.device_id)}
            >
              {t("premium.removeDevice")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [status, setStatus] = useState<"buy" | "active">(() =>
    licenseIsActive() ? "active" : "buy",
  );
  const [meta, setMeta] = useState(() => getLicenseMeta());
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null);
  const [limitDevices, setLimitDevices] = useState<DeviceRow[] | null>(null);

  async function doActivate(k: string) {
    setBusy(true);
    setErrKey(null);
    setLimitDevices(null);
    const res = await activateLicense(k);
    setBusy(false);
    if (res.ok) {
      setStatus("active");
      setMeta(getLicenseMeta());
      return;
    }
    if (res.deviceLimitReached && res.devices) {
      setLimitDevices(res.devices);
      setErrKey("premium.deviceLimit");
      return;
    }
    setErrKey(res.error ?? "premium.invalidKey");
  }

  async function removeThenActivate(id: string) {
    setBusy(true);
    await removeDevice(key.trim(), id);
    setBusy(false);
    await doActivate(key);
  }

  const doActivateInput = () => void doActivate(key);

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
          <div
            className="card"
            style={{ marginTop: 16, marginBottom: 16 }}
          >
            <div className="card-title" style={{ textAlign: "left" }}>
              Already purchased? Enter your license key
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="HESYCH-XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                onKeyDown={(e) => e.key === "Enter" && doActivateInput()}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--text)",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                type="button"
                className="btn-buy"
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "0 16px",
                  fontWeight: 600,
                  cursor: busy ? "wait" : "pointer",
                  color: "#fff",
                  fontSize: 12,
                }}
                disabled={busy}
                onClick={doActivateInput}
              >
                {busy ? "…" : t("premium.activateBtn")}
              </button>
            </div>
            {errKey ? (
              <div
                style={{
                  fontSize: 11,
                  marginTop: 8,
                  lineHeight: 1.5,
                  color: errKey === "premium.deviceLimit" ? "#c07800" : "var(--danger)",
                }}
              >
                {t(errKey)}
              </div>
            ) : null}
            {limitDevices && limitDevices.length > 0 ? (
              <DevicesBox rows={limitDevices} busy={busy} onRemove={(id) => void removeThenActivate(id)} />
            ) : null}
            <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 8 }}>
              The key is also emailed to you after purchase.
            </div>

            {/* Pricing card + trust badges — verbatim legacy markup */}
            <div dangerouslySetInnerHTML={{ __html: buyHtml.replace('id="buySection"', 'data-buy') }} />
          </div>

          <div dangerouslySetInnerHTML={{ __html: compareHtml }} />
          <div style={{ height: 32 }} />
        </div>
      )}
    </>
  );
}
