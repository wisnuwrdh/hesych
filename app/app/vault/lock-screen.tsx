"use client";

import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n";
import { MAX_ATTEMPTS } from "../../../lib/constants";
import { getStrengthLabel, scorePassword } from "../../../lib/password";
import {
  isBiometricEnabled,
  isBiometricSupported,
  unlockWithBiometric,
} from "../../../lib/bio";
import type { LockoutState } from "../../../lib/auth";
import { FingerprintIcon } from "./icons";

export function LockScreen({
  firstTime,
  lockout,
  onPasswordSubmit,
  onBioUnlock,
  onReset,
  showToast,
}: {
  firstTime: boolean;
  lockout: LockoutState;
  onPasswordSubmit: (pw: string, isSetup: boolean) => Promise<boolean>;
  onBioUnlock: (pw: string, prfOutput: ArrayBuffer | null) => Promise<void>;
  onReset: () => void;
  showToast: (msg: string, type?: "ok" | "err" | "warn") => void;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"" | "err" | "warn">("");
  const [working, setWorking] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.ceil((lockout.lockedUntil - Date.now()) / 1000)),
  );
  const [pwVisible, setPwVisible] = useState(false);
  const attempts = lockout.attempts;
  const locked = secs > 0;

  useEffect(() => {
    if (secs <= 0) return;
    const iv = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [secs]);

  const bioSupported = isBiometricSupported() && isBiometricEnabled();
  const showBio = !firstTime && bioSupported;
  const score = firstTime ? scorePassword(pw) : 0;

  const doSubmit = async () => {
    if (locked || working) return;
    const v = pw.trim();
    if (!v) {
      setMsg(t("lock.enterPw"));
      setMsgType("err");
      return;
    }
    if (firstTime) {
      if (v.length < 8) {
        setMsg(t("lock.minLenWarn"));
        setMsgType("err");
        return;
      }
      if (v !== confirm) {
        setMsg(t("lock.noMatch"));
        setMsgType("err");
        return;
      }
    }
    setWorking(true);
    setMsg("");
    setMsgType("");
    try {
      const ok = await onPasswordSubmit(v, firstTime);
      if (!ok) {
        setMsg(t("lock.wrongPw"));
        setMsgType("err");
      }
    } catch (err) {
      console.error("onPasswordSubmit error", err);
      setMsg(err instanceof Error ? err.message : t("lock.wrongPw"));
      setMsgType("err");
    } finally {
      setWorking(false);
    }
  };

  const doBio = async () => {
    if (bioBusy || locked) return;
    setBioBusy(true);
    try {
      const res = await unlockWithBiometric();
      if (res.ok && res.password) {
        await onBioUnlock(res.password, res.prfOutput);
      } else if (res.expiredCanceled) {
        showToast(t("bio.expired"), "warn");
      } else {
        showToast(t("bio.failed"), "err");
      }
    } finally {
      setBioBusy(false);
    }
  };

  return (
    <div id="lockScreen" className={`lock-screen${firstTime ? " setup-mode" : ""}`}>
      <div className="lock-mark">
        <img
          src="/logo-dark.webp"
          className="logo-img logo-img-dark"
          alt=""
          width="56"
          height="56"
        />
        <img
          src="/logo-light.webp"
          className="logo-img logo-img-light"
          alt=""
          width="56"
          height="56"
        />
      </div>
      <div className="lock-title">Hesych</div>
      <div
        className={`lock-mode-badge ${firstTime ? "badge-setup" : "badge-unlock"}`}
      >
        <span className="badge-dot" />
        <span id="lockModeBadgeText">{firstTime ? "New Vault" : "Unlock"}</span>
      </div>
      <div className="lock-sub" id="lockSub">
        {firstTime ? t("lock.setupSubtitle") : t("lock.subtitle")}
      </div>
      <div className="lock-form">
        <div className="lock-field-group">
          <div className="pw-field-label">{t("lock.masterPwLabel")}</div>
          <div className="input-wrap">
            <input
              type={pwVisible ? "text" : "password"}
              id="masterPass"
              placeholder={t("lock.masterPwPh")}
              autoComplete={firstTime ? "new-password" : "current-password"}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={pw}
              disabled={locked || working}
              onChange={(e) => {
                setPw(e.target.value);
                setMsg("");
                setMsgType("");
              }}
              onKeyDown={(e) => e.key === "Enter" && doSubmit()}
            />
            <button
              className="eye-btn"
              type="button"
              aria-label={pwVisible ? "Hide" : "Show"}
              onClick={() => setPwVisible((v) => !v)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        {firstTime && (
          <div className="lock-field-group" id="confirmWrap">
            <div className="pw-field-label">{t("lock.confirmPwLabel")}</div>
            <div className="input-wrap">
              <input
                type="password"
                id="masterConfirm"
                placeholder={t("lock.confirmPwPh")}
                autoComplete="new-password"
                value={confirm}
                disabled={working}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setMsg("");
                  setMsgType("");
                }}
                onKeyDown={(e) => e.key === "Enter" && doSubmit()}
              />
            </div>
          </div>
        )}

        {firstTime && (
          <div id="lockStrengthWrap" style={{ marginTop: 6 }}>
            <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={`strength-seg${score >= s ? ` s${score}` : ""}`} />
              ))}
            </div>
            <div
              className={`strength-label${score ? ` s${score}` : ""}`}
              id="lockStrengthLabel"
            >
              {getStrengthLabel(score)}
            </div>
          </div>
        )}

        {showBio && (
          <button
            className="btn-bio"
            id="bioBtn"
            disabled={locked || bioBusy}
            onClick={doBio}
          >
            <FingerprintIcon width={15} height={15} />
            <span>{t("bio.btnUnlock")}</span>
          </button>
        )}

        <div className="attempt-dots" id="dots">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
            <div key={i} className={`dot${i < attempts ? " used" : ""}`} />
          ))}
        </div>

        <div id="lockMsg" className={`lock-msg${msgType ? ` ${msgType}` : ""}`}>
          {locked ? t("lock.lockedFor", { s: secs }) : msg}
        </div>

        <button
          className="btn-primary"
          id="unlockBtn"
          disabled={locked || working}
          onClick={doSubmit}
        >
          {firstTime
            ? working
              ? t("lock.creatingBtn")
              : t("lock.createBtn")
            : working
              ? t("lock.openingBtn")
              : t("lock.unlockBtn")}
        </button>

        {!firstTime && (
          <button className="reset-link" id="resetLink" onClick={onReset}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span>{t("lock.resetLink")}</span>
          </button>
        )}
      </div>
    </div>
  );
}