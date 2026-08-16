"use client";

import { useState } from "react";
import { t } from "../../../lib/i18n";
import { setSecretLock } from "../../../lib/secretlock";
import { LockIcon } from "./icons";

const PRESETS: Array<{ key: string; ms: number }> = [
  { key: "secretLock.p5m", ms: 5 * 60000 },
  { key: "secretLock.p30m", ms: 30 * 60000 },
  { key: "secretLock.p1h", ms: 3600000 },
  { key: "secretLock.p6h", ms: 6 * 3600000 },
  { key: "secretLock.p1d", ms: 86400000 },
  { key: "secretLock.p1w", ms: 7 * 86400000 },
];

export function SecretLockModal({
  itemId,
  onClose,
  onLocked,
}: {
  itemId: number | null;
  onClose: () => void;
  onLocked: () => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [custom, setCustom] = useState({
    y: 0,
    mo: 0,
    w: 0,
    d: 0,
    h: 0,
    m: 0,
    s: 0,
  });

  if (itemId === null) return null;

  const customMs =
    ((((((custom.y * 12 + custom.mo) * 4 + custom.w) * 7 + custom.d) * 24 +
      custom.h) *
      60 +
      custom.m) *
      60 +
      custom.s) *
    1000;

  const choose = (key: string) => setSel(key);

  const lock = () => {
    const ms = sel ? PRESETS.find((p) => p.key === sel)!.ms : customMs;
    if (ms <= 0) return;
    setSecretLock(itemId, ms);
    onLocked();
    onClose();
  };

  const setUnit = (k: keyof typeof custom) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCustom((c) => ({ ...c, [k]: Math.max(0, Number(e.target.valueAsNumber) || 0) }));

  return (
    <div className="modal-overlay show" id="secretLockModal">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <LockIcon width={18} height={18} style={{ color: "var(--accent)" }} />
          <span>{t("secretLock.title")}</span>
        </div>
        <p className="modal-desc">{t("secretLock.desc")}</p>
        <div className="dur-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`dur-preset-btn${sel === p.key ? " active" : ""}`}
              onClick={() => choose(p.key)}
            >
              {t(p.key)}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6 }}>
          {t("secretLock.chooseDur")}
        </div>
        <div className="dur-custom-grid">
          {(
            [
              ["y", "secretLock.year"],
              ["mo", "secretLock.month"],
              ["w", "secretLock.week"],
              ["d", "secretLock.day"],
              ["h", "secretLock.hour"],
              ["m", "secretLock.min"],
              ["s", "secretLock.sec"],
            ] as const
          ).map(([k, label]) => (
            <div className="dur-unit" key={k}>
              <div className="dur-unit-label">{t(label)}</div>
              <input
                className="dur-unit-input"
                type="number"
                min={0}
                value={custom[k]}
                onClick={() => setSel(null)}
                onChange={setUnit(k)}
              />
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={lock}>
            {t("secretLock.lockBtn")}
          </button>
          <button className="btn-cancel" onClick={onClose}>
            {t("secretLock.cancelBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}