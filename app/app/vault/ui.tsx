"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "../../../lib/i18n";

type ToastType = "ok" | "err" | "warn";
let _toastTimer: ReturnType<typeof setTimeout> | null = null;

interface ToastApi {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastCtx = createContext<ToastApi>({ showToast: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastCtx);
}

/** Mirrors legacy showToast(): also flashes the favicon dot on /app?tab=… */
export function showGlobalToast(
  msg: string,
  type: ToastType = "ok",
  setState?: (s: { msg: string; type: ToastType } | null) => void,
): void {
  if (setState) setState({ msg, type });
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => setState?.(null), 2600);
}

export function ToastHost({
  state,
}: {
  state: { msg: string; type: ToastType } | null;
}) {
  if (!state) return null;
  return (
    <div id="toast" className={`toast show ${state.type}`} role="status">
      {state.msg}
    </div>
  );
}

export function useClipboard(): (text: string) => Promise<boolean> {
  return useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }, []);
}

// ===== Confirm modal (custom, mirrors the legacy confirmWrap) =====

export function ConfirmModal({
  open,
  title,
  desc,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  desc: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [working, setWorking] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!open) busy.current = false;
  }, [open]);

  const confirm = async () => {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      busy.current = false;
    }
  };

  if (!open) return null;
  return (
    <div data-particle="confirm-panel">
      <div
        className="modal-overlay show"
        onClick={() => !busy.current && onCancel()}
      >
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title">{title}</h3>
          <p className="modal-desc" style={{ whiteSpace: "pre-line" }}>
            {desc}
          </p>
          <div className="modal-actions">
            <button
              className="btn-primary"
              style={
                danger
                  ? { background: "var(--danger)", borderColor: "var(--danger)" }
                  : undefined
              }
              disabled={working}
              onClick={confirm}
            >
              {confirmLabel}
            </button>
            <button className="btn-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Replaces dangerous inline <strong>…</strong>/<br> keys with safe JSX. */
export function renderHtmlKey(key: string): ReactNode {
  const raw = t(key);
  const parts = raw.split(/(<strong>.*?<\/strong>|<br\s*\/?>)/g);
  return parts.map((part, i) => {
    if (part === "<br>" || part === "<br />" || part === "<br/>") {
      return <br key={i} />;
    }
    const m = part.match(/^<strong>(.*)<\/strong>$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return part;
  });
}