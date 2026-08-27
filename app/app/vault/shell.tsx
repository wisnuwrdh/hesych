"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../../lib/i18n";
import { STORAGE_KEYS } from "../../../lib/constants";
import {
  activate as activateLicense,
  deactivate as deactivateLicense,
  getMeta as getLicenseMeta,
  isActive as licenseIsActive,
  listDevices,
  removeDevice,
  type DeviceRow,
} from "../../../lib/license";
import { getDeviceId } from "../../../lib/device";
import {
  disableBiometric as removeBiometric,
  enableBiometrics,
  listBiometrics,
  type BioEntry,
} from "../../../lib/biometric";
import {
  disableLocalBackup,
  dismissReminder,
  fsSupported,
  isEnabled as lbEnabled,
  lastBackupAt,
  pickBackupFolder,
  reminderDue,
  writeSnapshot,
} from "../../../lib/localbackup";
import { renderHtmlKey } from "./ui";
import { DetailPanel, ItemCard } from "./item-card";
import { FILTERS, useVault, type VaultFilter } from "./ctx";
import { AdvFilterBar } from "./adv-filter";
import {
  LockIcon,
  MoonIcon,
  MoreIcon,
  SearchIcon,
  ShieldIcon,
  SunIcon,
  XIcon,
} from "./icons";

function getTheme(): "light" | "dark" {
  return localStorage.getItem(STORAGE_KEYS.theme) === "light" ? "light" : "dark";
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  if (theme === "light") {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff");
  } else {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0a0a0c");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => getTheme());
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEYS.theme, next);
    setTheme(next);
  };
  return (
    <button className="icon-btn" id="themeToggleBtn" onClick={toggle}>
      <MoonIcon width={15} height={15} style={{ display: theme === "dark" ? "inline" : "none" }} />
      <SunIcon width={15} height={15} style={{ display: theme === "light" ? "inline" : "none" }} />
    </button>
  );
}

function Sidebar() {
  const ctx = useVault();
  const catLabels = new Map<string, string>();
  for (const f of FILTERS) {
    catLabels.set(f.key, t(f.i18n));
  }
  const sideFilters: Array<{ key: VaultFilter; icon: React.ReactNode; label: string }> = [
    {
      key: "all",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
      label: t("filter.all"),
    },
    {
      key: "fav",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      label: t("filter.fav"),
    },
  ];
  return (
    <aside className="sidebar" id="desktopSidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <img src="/logo-dark.webp" className="logo-img logo-img-dark" alt="" width="28" height="28" />
          <img src="/logo-light.webp" className="logo-img logo-img-light" alt="" width="28" height="28" />
        </div>
        <span className="sidebar-brand-name">Hesych</span>
        <span className="sidebar-brand-count" id="sidebarCount">{ctx.items.length}</span>
      </div>

      <div className="sidebar-search">
        <div className="search-wrap main-search-wrap">
          <div className="search-inner">
            <span className="search-icon"><SearchIcon width={13} height={13} /></span>
            <input
              className="search-box"
              id="searchDesktop"
              placeholder="Search…"
              value={ctx.search}
              onChange={(e) => ctx.setSearch(e.target.value)}
            />
            {ctx.search ? (
              <button className="search-clear visible" onClick={() => ctx.setSearch("")}>
                <XIcon width={12} height={12} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Hesych</div>
        {sideFilters.map((f) => (
          <button
            key={f.key}
            className={`sidebar-nav-item${ctx.filter === f.key ? " active" : ""}`}
            data-filter={f.key}
            onClick={() => ctx.setFilter(f.key)}
          >
            {f.icon}
            <span>{f.label}</span>
            <span className="sidebar-nav-badge">{ctx.counts[f.key] ?? 0}</span>
          </button>
        ))}
        <div className="sidebar-sep" />
        <div className="sidebar-nav-label">Categories</div>
        {(["social", "finance", "email", "work", "shopping", "gaming", "other"] as const).map((c) => (
          <button
            key={c}
            className={`sidebar-nav-item${ctx.filter === c ? " active" : ""}`}
            data-filter={c}
            onClick={() => ctx.setFilter(c)}
          >
            <span>{catLabels.get(c)}</span>
            <span className="sidebar-nav-badge">{ctx.counts[c] ?? 0}</span>
          </button>
        ))}
        <div className="sidebar-sep" />
        <div className="sidebar-nav-label">Tools</div>
        <button className="sidebar-nav-item" onClick={() => ctx.setFilter("all")}>
          <ShieldIcon width={14} height={14} />
          <span>{t("health.title")}</span>
          <span className="sidebar-pro-badge">PRO</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-nav-item" id="sidebarLockBtn" onClick={ctx.onLock}>
          <LockIcon width={14} height={14} />
          <span>{t("app.lockTitle")}</span>
        </button>
      </div>
    </aside>
  );
}

function EmptyState() {
  const ctx = useVault();
  let body: React.ReactNode;
  if (ctx.filter === "fav") {
    body = renderHtmlKey("empty.noFav");
  } else if (ctx.search) {
    body = renderHtmlKey("empty.noResults", { q: ctx.search });
  } else {
    body = t("empty.noItems");
  }
  return (
    <div className="empty-state">
      <div className="empty-title">{ctx.search ? "No results" : t("filter.all")}</div>
      <div className="empty-sub">{body}</div>
    </div>
  );
}

function OverflowMenu({
  onLock,
  pro,
  onOpenLicense,
  onOpenBackup,
}: {
  onLock: () => void;
  pro: boolean;
  onOpenLicense: () => void;
  onOpenBackup: () => void;
}) {
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
  return (
    <div className="overflow-menu" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)}>
        <MoreIcon width={15} height={15} />
      </button>
      {open ? (
        <div className="overflow-dropdown">
          <button className="overflow-item" onClick={() => { setOpen(false); ctx.setCpOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
            </svg>
            <span>{t("app.changePwTitle")}</span>
          </button>
          <div className="overflow-sep" />
          <button className="overflow-item" onClick={() => { setOpen(false); ctx.setBackupOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{t("encExport.menuItem")}</span>
          </button>
          <button className="overflow-item" onClick={() => { setOpen(false); ctx.setImportOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>{t("import.title")}</span>
          </button>
          <button className="overflow-item" onClick={() => { setOpen(false); onOpenBackup(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>{t("lb.menuItem")}</span>
          </button>
          <div className="overflow-sep" />
          <button
            className="overflow-item"
            disabled={ctx.breachRunning}
            onClick={() => { setOpen(false); void ctx.checkAllBreaches(); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>{ctx.breachRunning ? t("breach.checking") : t("breach.btnTitle")}</span>
          </button>
          <button className="overflow-item" onClick={() => { setOpen(false); ctx.setHealthOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="12 6 12 12 9 12" />
            </svg>
            <span>{t("health.title")}</span>
          </button>
          <div className="overflow-sep" />
          {!pro ? (
            <>
              <a className="overflow-item" href="/upgrade" style={{ display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>{t("premium.menuItem")}</span>
              </a>
              <button className="overflow-item" onClick={() => { setOpen(false); onOpenLicense(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>{t("premium.enterKey")}</span>
              </button>
            </>
          ) : (
            <button className="overflow-item" onClick={() => { setOpen(false); onOpenLicense(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t("premium.manageItem")}</span>
            </button>
          )}
          <div className="overflow-sep" />
          <button className="overflow-item" onClick={() => { setOpen(false); void ctx.loadShareLog(); ctx.setShareLogOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>{t("share.logTitle")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Modal kelola biometrik (per browser) ──────────────────────────────────

// ── Modal kelola kredensial biometrik (per browser) ──────────────────────

function BiometricModal({
  dekRaw,
  onClose,
  onChanged,
}: {
  dekRaw: Uint8Array<ArrayBuffer> | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [entries, setEntries] = useState<BioEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    void listBiometrics().then((list) => {
      if (alive) setEntries(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function add() {
    if (!dekRaw || busyId) return;
    setBusyId("__add__");
    const res = await enableBiometrics(dekRaw);
    setBusyId(null);
    if (res.ok) {
      onChanged();
      onClose();
      return;
    }
    if (res.reason === "canceled") {
      setMsg({ text: "Setup canceled by browser prompt", warn: true });
      return;
    }
    if (res.reason === "no-prf") {
      setMsg({
        text: "This browser does not support the PRF extension. Try the latest Chrome or Edge.",
        warn: true,
      });
      return;
    }
    setMsg({ text: "Setup failed" + (res.detail ? ` (${res.detail})` : ""), warn: true });
  }

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    await removeBiometric(id);
    setBusyId(null);
    setEntries(await listBiometrics());
  }

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Biometric Unlock</h3>
        <p className="modal-desc">
          Per browser and device. Register separately in each browser. Your phone must have a screen lock.
        </p>
        {msg ? (
          <p style={{ fontSize: 11, color: msg.warn ? "#c07800" : "var(--danger)", lineHeight: 1.5 }}>
            {msg.text}
          </p>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {(entries ?? []).map((e) => (
            <div
              key={e.cred_id}
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
                {new Date(e.created_at).toLocaleString()}
              </span>
              <button
                type="button"
                className="act-btn del"
                style={{ flex: "0 0 auto", padding: "4px 8px" }}
                disabled={busyId !== null}
                onClick={() => void remove(e.cred_id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", display: "flex" }}
            disabled={busyId !== null || !dekRaw}
            onClick={() => void add()}
          >
            {busyId === "__add__" ? "…" : "+ Register this browser"}
          </button>
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  onLock,
  dekRaw,
  onBioChanged,
}: {
  onLock: () => void;
  dekRaw: Uint8Array<ArrayBuffer> | null;
  onBioChanged: () => void;
}) {
  const ctx = useVault();
  const [licOpen, setLicOpen] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [dismissTick, setDismissTick] = useState(0);
  const pro = ctx.isPremium();
  const showLbReminder = useMemo(() => {
    void dismissTick;
    return reminderDue(ctx.itemCount);
  }, [ctx.itemCount, dismissTick]);
  const desktopCount = ctx.counts[ctx.filter] ?? ctx.list.length;

  const chipLabel = (key: VaultFilter) =>
    key === "fav" ? (
      <>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span>{t("filter.fav")}</span>
      </>
    ) : (
      t("filter.all")
    );

  return (
    <div id="app">
      <Sidebar />
      <div className="main-pane">
        {showLbReminder ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"#2a1e08", color:"var(--warn)", fontSize:11, borderBottom:"1px solid #3a2f00" }}>
            <span style={{ flex:1 }}>{t("lb.reminder")}</span>
            <button className="act-btn" style={{ flex:"0 0 auto", padding:"4px 10px" }} onClick={() => setLbOpen(true)}>
              {t("lb.enableAction")}
            </button>
            <button
              className="icon-btn"
              aria-label="dismiss"
              onClick={() => {
                dismissReminder();
                setDismissTick((n) => n + 1);
              }}
            >
              <XIcon width={12} height={12} />
            </button>
          </div>
        ) : null}
        <div className="appbar">
          <div className="app-title">
            <img src="/logo-dark.webp" className="logo-img logo-img-dark" alt="" width="22" height="22" />
            <img src="/logo-light.webp" className="logo-img logo-img-light" alt="" width="22" height="22" />
            Hesych
            <span className="count-badge" id="countBadge">{ctx.itemCount}</span>
          </div>
          <div className="appbar-desktop-title" id="appbarDesktopTitle">
            {desktopCount} · {t(ctx.filter === "all" ? "filter.all" : `filter.${ctx.filter}`)}
          </div>
          <div className="bar-actions">
            <button
              className="icon-btn"
              title="Biometric unlock"
              onClick={() => setBioOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12v2a3 3 0 0 0 6 0v-2a3 3 0 0 0-6 0v2"/>
              </svg>
            </button>
            <ThemeToggle />

            <button className="icon-btn" id="headerLockBtn" onClick={onLock} title={t("app.lockTitle")}>
              <LockIcon width={15} height={15} />
            </button>
            <OverflowMenu
              onOpenBackup={() => setLbOpen(true)}
              onLock={onLock}
              pro={pro}
              onOpenLicense={() => setLicOpen(true)}
            />
            {lbOpen ? <LocalBackupModal onClose={() => setLbOpen(false)} /> : null}
            {bioOpen ? (
              <BiometricModal
                dekRaw={dekRaw}
                onChanged={onBioChanged}
                onClose={() => {
                  setBioOpen(false);
                  onBioChanged();
                }}
              />
            ) : null}
            {licOpen ? <LicenseModal onClose={() => setLicOpen(false)} /> : null}
          </div>
        </div>

        <div className="filter-bar">
          <button className={`filter-chip fav-chip${ctx.filter === "fav" ? " active" : ""}`} onClick={() => ctx.setFilter("fav")}>
            {chipLabel("fav")}
          </button>
          {(["all", "social", "finance", "email", "work", "shopping", "gaming", "other"] as const).map((f) => (
            <button
              key={f}
              className={`filter-chip${ctx.filter === f ? " active" : ""}`}
              onClick={() => ctx.setFilter(f)}
            >
              {t(`filter.${f}`)}
            </button>
          ))}
          <AdvFilterBar />
        </div>

        <div className="search-wrap">
          <div className="search-inner">
            <span className="search-icon"><SearchIcon width={14} height={14} /></span>
            <input
              className="search-box"
              id="search"
              placeholder={t("search.ph")}
              value={ctx.search}
              onChange={(e) => ctx.setSearch(e.target.value)}
            />
            {ctx.search ? (
              <button className="search-clear" onClick={() => ctx.setSearch("")}>
                <XIcon width={12} height={12} />
              </button>
            ) : null}
          </div>
        </div>

        {ctx.list.length === 0 ? (
          <EmptyState />
        ) : (
          <div id="list">
            {ctx.list.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
      <DetailPanel />
      <button className="fab" id="fab" title="Add Item" onClick={() => ctx.openSheet()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

// Renders the device registry rows for the license modal.
function DevicesBox({
  rows,
  onRemove,
  removable,
}: {
  rows: DeviceRow[];
  onRemove?: (id: string) => void;
  removable?: boolean;
}) {
  const mine = getDeviceId();
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
              {d.device_id === mine ? (
                <em style={{ color: "var(--accent)", fontStyle: "normal" }}>
                  {" "}
                  · {t("premium.thisDevice")}
                </em>
              ) : null}
            </span>
            {removable && onRemove ? (
              d.device_id === mine ? (
                <span style={{ color: "var(--dim)", fontSize: 10, flexShrink: 0 }}>—</span>
              ) : (
                <button
                  className="act-btn del"
                  style={{ flex: "0 0 auto", padding: "4px 8px" }}
                  onClick={() => onRemove(d.device_id)}
                >
                  {t("premium.removeDevice")}
                </button>
              )
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 4 }}>
        {t("premium.devicesHint")}
      </div>
    </div>
  );
}

// ===== LICENSE (Premium activation, device registry max 3) =====

function LicenseModal({ onClose }: { onClose: () => void }) {
  const meta = getLicenseMeta();
  const active = meta !== null && licenseIsActive();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null);
  const [limitDevices, setLimitDevices] = useState<DeviceRow[] | null>(null);
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [done, setDone] = useState<null | "activated" | "removed">(null);

  async function tryActivate(k: string) {
    setBusy(true);
    setErrKey(null);
    setLimitDevices(null);
    const res = await activateLicense(k);
    setBusy(false);
    if (res.ok) {
      setDone("activated");
      return;
    }
    if (res.deviceLimitReached && res.devices) {
      setLimitDevices(res.devices);
      setErrKey("premium.deviceLimit");
      return;
    }
    setErrKey(res.error ?? "premium.invalidKey");
  }

  const doActivate = () => void tryActivate(key);

  const doRemoveThenActivate = async (id: string) => {
    setBusy(true);
    await removeDevice(key, id);
    setBusy(false);
    await tryActivate(key);
  };

  const loadManageDevices = () => {
    if (meta) void listDevices(meta.key).then(setDevices);
  };

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        onFocus={active ? undefined : undefined}
      >
        {done === "activated" ? (
          <>
            <h3 className="modal-title">{t("premium.activeTitle")}</h3>
            <p className="modal-desc">{t("premium.activeDesc")}</p>
            <div className="modal-actions">
              <button className="btn-primary" style={{ width: "100%" }} onClick={onClose}>
                OK
              </button>
            </div>
          </>
        ) : done === "removed" ? (
          <>
            <h3 className="modal-title">{t("premium.manageItem")}</h3>
            <p className="modal-desc">{t("premium.deactivated")}</p>
            <div className="modal-actions">
              <button className="btn-primary" style={{ width: "100%" }} onClick={onClose}>
                OK
              </button>
            </div>
          </>
        ) : active ? (
          <>
            <h3 className="modal-title">{t("premium.activeTitle")}</h3>
            <p className="modal-desc">
              {t("premium.activeSince").replace(
                "{date}",
                new Date(meta.since).toLocaleDateString(),
              )}
              {meta.email ? (
                <>
                  <br />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{meta.email}</span>
                </>
              ) : null}
              <br />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{meta.key}</span>
            </p>
            <DevicesBox
              rows={devices ?? []}
              removable
              onRemove={(id) => {
                if (!meta) return;
                void removeDevice(meta.key, id).then(() => loadManageDevices());
              }}
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>
                {t("delete.cancelBtn")}
              </button>
              <button
                className="btn-primary"
                style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={() => {
                  deactivateLicense();
                  setDone("removed");
                }}
              >
                {t("premium.deactivateBtn")}
              </button>
            </div>
            <LoadDevicesOnMount onReady={loadManageDevices} />
          </>
        ) : (
          <>
            <h3 className="modal-title">{t("premium.enterKey")}</h3>
            <p className="modal-desc">{t("premium.lockedDesc")}</p>
            <div style={{ marginBottom: 10 }}>
              <div className="field-label">{t("premium.keyLabel")}</div>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t("premium.keyPh")}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--text)",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  outline: "none",
                }}
                onKeyDown={(e) => e.key === "Enter" && doActivate()}
              />
              <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 4 }}>
                {t("premium.keyHint")}
              </div>
            </div>
            {errKey ? (
              <div
                style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}
              >
                {t(errKey)}
              </div>
            ) : null}
            {limitDevices ? (
              <DevicesBox rows={limitDevices} removable onRemove={(id) => void doRemoveThenActivate(id)} />
            ) : null}
            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>
                {t("delete.cancelBtn")}
              </button>
              <button className="btn-primary" disabled={busy} onClick={doActivate}>
                {busy ? t("premium.activating") : t("premium.activateBtn")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Loads the device registry once the manage view has painted. */
function LoadDevicesOnMount({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const id = setTimeout(onReady, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ===== LOCAL AUTO-BACKUP (encrypted snapshot to a user-chosen folder) =====

function LocalBackupModal({ onClose }: { onClose: () => void }) {
  const supported = fsSupported();
  const [enabled, setEnabled] = useState(lbEnabled());
  const [last, setLast] = useState(lastBackupAt());
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const refresh = () => {
    setLast(lastBackupAt());
    setEnabled(lbEnabled());
  };

  const pickAndEnable = async () => {
    setBusy(true);
    setModalErr(null);
    const res = await pickBackupFolder();
    if (res.ok) {
      try {
        await writeSnapshot();
        refresh();
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "missing_handle") setModalErr("Backup folder not found, please re-select");
        else if (msg === "permission") setModalErr("Backup folder permission needed");
        else setModalErr("Backup failed: " + msg);
        console.warn("local backup:", e);
      }
    } else if (res.error && res.error !== "canceled" && res.error !== "unsupported") {
      setModalErr(res.error);
    }
    setBusy(false);
  };

  const backupNow = async () => {
    setBusy(true);
    setModalErr(null);
    try {
      await writeSnapshot();
      refresh();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "missing_handle") setModalErr("Backup folder not found, please re-select");
      else if (msg === "permission") setModalErr("Backup folder permission needed");
      else setModalErr("Backup failed: " + msg);
      console.warn("local backup:", e);
    }
    setBusy(false);
  };

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{t("lb.title")}</h3>
        {!supported ? (
          <>
            <p className="modal-desc">{t("lb.unsupported")}</p>
          </>
        ) : (
          <>
            <p className="modal-desc">{t("lb.desc")}</p>
            <p className="modal-desc" style={{ marginBottom: 12 }}>
              <strong>{enabled ? t("lb.enabledOn") : t("lb.enabledOff")}</strong>
              {" · "}
              {t("lb.lastBackup")}:{" "}
              <span style={{ fontFamily: "var(--mono)" }}>
                {last ? new Date(last).toLocaleString() : t("lb.never")}
              </span>
            </p>
            {savedFlash ? (
              <div style={{ fontSize: 12, color: "var(--green)", marginBottom: 8 }}>
                {t("lb.saved")}
              </div>
            ) : null}
            {modalErr ? (
              <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>
                {modalErr}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn-primary"
                style={{ justifyContent: "center", display: "flex" }}
                disabled={busy}
                onClick={() => void pickAndEnable()}
              >
                {t("lb.pickFolder")}
              </button>
              {enabled ? (
                <>
                  <button
                    className="btn-cancel"
                    style={{ justifyContent: "center", display: "flex" }}
                    disabled={busy}
                    onClick={() => void backupNow()}
                  >
                    {t("lb.backupNow")}
                  </button>
                  <button
                    className="act-btn del"
                    style={{ justifyContent: "center", display: "flex" }}
                    disabled={busy}
                    onClick={() => {
                      disableLocalBackup();
                      refresh();
                    }}
                  >
                    {t("lb.turnOff")}
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn-cancel" style={{ width: "100%" }} onClick={onClose}>
            {t("delete.cancelBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
