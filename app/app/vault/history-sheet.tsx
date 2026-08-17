"use client";

import { useEffect, useState } from "react";
import type { PasswordHistoryEntry } from "../../../lib/types";
import { useVault } from "./ctx";

export function HistorySheet() {
  const ctx = useVault();
  const item = ctx.histItem;
  const [hist, setHist] = useState<{ id: number; entries: PasswordHistoryEntry[] } | null>(null);
  const [revealed, setRevealed] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!item) return;
    let live = true;
    ctx
      .loadHistory(item.id)
      .then((list) => {
        if (live) {
          setHist({
            id: item.id,
            entries: list.sort((a, b) => b.changedAt - a.changedAt),
          });
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [item, ctx]);

  if (!item) return null;

  const loading = hist?.id !== item.id;
  const entries = hist?.id === item.id ? hist.entries : [];
  const atLimit = entries.length >= 10;

  const copy = async (b64: string) => {
    try {
      const plain = await ctx.decryptRaw(b64);
      await navigator.clipboard.writeText(plain);
      setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30000);
    } catch {
      // ignore
    }
  };

  const reveal = async (hid: number, b64: string) => {
    if (revealed[hid] !== undefined) {
      setRevealed((r) => ({ ...r, [hid]: "" }));
      return;
    }
    try {
      const plain = await ctx.decryptRaw(b64);
      setRevealed((r) => ({ ...r, [hid]: plain }));
    } catch {
      // ignore
    }
  };

  const del = async (hid: number) => {
    await ctx.deleteHistoryEntry(hid);
    setHist((h) =>
      h ? { ...h, entries: h.entries.filter((e) => e.hid !== hid) } : h,
    );
  };

  return (
    <>
      <div className="modal-overlay show" onClick={ctx.closeHist} />
      <div className="sheet show" id="historySheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <svg width="16" height="16" viewBox="0 0 192 192" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="80" cy="80" r="74" />
            <path d="M80 30v50l40 32" />
          </svg>
          <span>Password History · {item.title}</span>
          <button className="sheet-close" onClick={ctx.closeHist}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div id="historyBody">
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--sub)", fontSize: 12 }}>
              Loading…
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--sub)" }}>
              <svg width="32" height="32" viewBox="0 0 192 192" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.4 }}>
                <circle cx="80" cy="80" r="74" />
                <path d="M80 30v50l40 32" />
              </svg>
              <div style={{ fontSize: 13 }}>No history yet</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                Password changes will appear here
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--sub)", fontFamily: "var(--mono)" }}>
                  {entries.length} / 10
                </span>
              </div>
              {atLimit ? (
                <div style={{ fontSize: 11, color: "var(--warn)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  Oldest entry will be removed when a new password is saved.
                </div>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {entries.map((e) => {
                  const date = new Date(e.changedAt);
                  const dateStr = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
                  const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  const plain = revealed[e.hid!] || "";
                  return (
                    <div className="hist-entry" key={e.hid}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--sub)" }}>{dateStr} · {timeStr}</span>
                        <button
                          onClick={() => del(e.hid!)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 2, display: "flex", alignItems: "center" }}
                          title="Delete"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="hist-pw-val" style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {plain || "••••••••••"}
                        </span>
                        <button
                          onClick={() => reveal(e.hid!, e.encPassword)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: revealed[e.hid!] ? "var(--accent)" : "var(--dim)", padding: 4, display: "flex", alignItems: "center" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => copy(e.encPassword)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dim)", padding: 4, display: "flex", alignItems: "center" }}
                          title="Copy"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}