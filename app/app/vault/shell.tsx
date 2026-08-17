"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "../../../lib/i18n";
import { STORAGE_KEYS } from "../../../lib/constants";
import { renderHtmlKey } from "./ui";
import { DetailPanel, ItemCard } from "./item-card";
import { FILTERS, useVault, type VaultFilter } from "./ctx";
import { AdvFilterBar } from "./adv-filter";
import {
  FingerprintIcon,
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
    body = <>{t("empty.noResults").replace(/<[^>]+>/g, "").replace("{q}", `“${ctx.search}”`)}</>;
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

function OverflowMenu({ onLock }: { onLock: () => void }) {
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
          <button className="overflow-item" onClick={onLock}>
            <LockIcon width={14} height={14} />
            <span>{t("app.lockTitle")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ onLock, bioOn }: { onLock: () => void; bioOn: boolean }) {
  const ctx = useVault();
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
            <ThemeToggle />
            {bioOn && (
              <button className="icon-btn bio-active" id="bioToggleBtn" title={t("bio.enabled")}>
                <FingerprintIcon width={15} height={15} />
              </button>
            )}
            <button className="icon-btn" id="headerLockBtn" onClick={onLock} title={t("app.lockTitle")}>
              <LockIcon width={15} height={15} />
            </button>
            <OverflowMenu onLock={onLock} />
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