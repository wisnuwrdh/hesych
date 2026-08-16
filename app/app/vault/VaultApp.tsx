"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../../lib/i18n";
import {
  checkLockout,
  loadLockoutState,
  recordFail,
  resetAttempts,
  type LockoutState,
} from "../../../lib/auth";
import { IDLE_LOCK_MS } from "../../../lib/constants";
import {
  deriveKey,
  decryptWith,
  type VaultKey,
} from "../../../lib/crypto";
import { checkVerifier, getSalt, isFirstTime, writeVerifierForKey } from "../../../lib/verifier";
import {
  loadItems,
  migrateMetadata,
  vaultDeleteItem,
  vaultSetFavorite,
} from "../../../lib/vault";
import { openDB } from "../../../lib/db";
import {
  disableBiometric,
  hasBioSession,
  isBiometricEnabled,
  isBiometricSupported,
  isPrfEnabled,
  refreshPrfSession,
  setBioSession,
  getCredIdB64,
} from "../../../lib/bio";
import { isItemSecretLocked } from "../../../lib/secretlock";
import type { VaultItem } from "../../../lib/types";
import { LockScreen } from "./lock-screen";
import { ConfirmModal, ToastHost } from "./ui";
import { SecretLockModal } from "./secret-lock-modal";
import { AppShell } from "./shell";
import { VaultCtx, type VaultFilter } from "./ctx";

type Phase = "locked" | "unlocked";

export function VaultApp() {
  const [phase, setPhase] = useState<Phase>("locked");
  const [firstTime, setFirstTime] = useState<boolean>(() => isFirstTime());
  const [lockout, setLockout] = useState<LockoutState>(() => loadLockoutState());
  const [items, setItems] = useState<VaultItem[]>([]);
  const [filter, setFilter] = useState<VaultFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Map<number, string>>(new Map());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VaultItem | null>(null);
  const [pendingSecretLock, setPendingSecretLock] = useState<VaultItem | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" } | null>(null);
  const [now, setNow] = useState(0);

  const keyRef = useRef<VaultKey | null>(null);
  const dbRef = useRef<IDBDatabase | null>(null);
  const lastActiveRef = useRef(0);
  const occupiedRef = useRef(false);

  const copyText = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (window.navigator.clipboard?.writeText) {
          await window.navigator.clipboard.writeText(text);
          return true;
        }
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
    },
    [],
  );

  const doLock = useCallback(() => {
    keyRef.current = null;
    setExpanded(new Set());
    setRevealed(new Map());
    setDetailId(null);
    setPendingDelete(null);
    setPendingSecretLock(null);
    if (dbRef.current) {
      dbRef.current.close();
      dbRef.current = null;
    }
    setPhase("locked");
  }, []);

  // Idle + tab-hidden auto-lock.
  useEffect(() => {
    if (phase !== "unlocked") return;
    const mark = () => {
      lastActiveRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, mark));
    const tick = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - lastActiveRef.current > IDLE_LOCK_MS) {
        setToast({ msg: t("toast.idleLock"), type: "warn" });
        doLock();
      }
    }, 1000);
    const onVis = () => {
      setNow(Date.now());
      if (document.hidden) {
        setToast({ msg: t("toast.tabLock"), type: "warn" });
        doLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase, doLock]);

  // ===== unlock / create =====

  const enterVault = useCallback(async (db: IDBDatabase, key: VaultKey) => {
    const { items: loaded, needMigrate } = await loadItems(db, key);
    if (needMigrate.length) {
      migrateMetadata(db, key, needMigrate).catch((e) =>
        console.warn("metadata migration", e),
      );
    }
    keyRef.current = key;
    dbRef.current = db;
    setItems(loaded);
    setExpanded(new Set());
    setRevealed(new Map());
    setPhase("unlocked");
  }, []);

  const handlePasswordSubmit = useCallback(
    async (pw: string, isSetup: boolean): Promise<boolean> => {
      if (occupiedRef.current) return false;
      occupiedRef.current = true;
      try {
        if (isSetup) {
          const salt = getSalt();
          const key = await deriveKey(pw, salt);
          await writeVerifierForKey(key);
          const db = await openDB();
          setFirstTime(false);
          await enterVault(db, key);
          setLockout(resetAttempts());
          if (isBiometricSupported()) {
            // wrapped for a future legacy bio unlock (PRF path needs an assertion)
            setBioSession(pw, null, false, { forceLegacy: true }).catch(() => {});
          }
          return true;
        }
        // unlock
        const active = checkLockout(lockout);
        if (active.lockedUntil > Date.now()) {
          setLockout(active);
          return false;
        }
        const salt = getSalt();
        const key = await deriveKey(pw, salt);
        if (!(await checkVerifier(pw, salt))) {
          const next = recordFail(active);
          setLockout(next);
          return false;
        }
        const db = await openDB();
        await enterVault(db, key);
        setLockout(resetAttempts());
        const credId = getCredIdB64();
        setBioSession(pw, credId, isPrfEnabled(), { forceLegacy: true }).catch(
          () => {},
        );
        return true;
      } finally {
        occupiedRef.current = false;
      }
    },
    [lockout, enterVault],
  );

  const handleBioUnlock = useCallback(
    async (pw: string, prfOutput: ArrayBuffer | null): Promise<void> => {
      const salt = getSalt();
      const key = await deriveKey(pw, salt);
      if (!(await checkVerifier(pw, salt))) {
        setToast({ msg: t("bio.failed"), type: "err" });
        return;
      }
      const db = await openDB();
      await enterVault(db, key);
      setLockout(resetAttempts());
      if (prfOutput) {
        refreshPrfSession(pw, prfOutput).catch(() => {});
      } else {
        setBioSession(pw, null, false, { forceLegacy: true }).catch(() => {});
      }
    },
    [enterVault],
  );

  // ===== reset =====

  const doReset = useCallback(async () => {
    const db = dbRef.current;
    if (db) {
      db.close();
      dbRef.current = null;
    }
    keyRef.current = null;
    disableBiometric();
    localStorage.removeItem("vault_salt");
    localStorage.removeItem("vault_ver");
    localStorage.removeItem("vault_license");
    localStorage.removeItem("vault_license_verified");
    localStorage.removeItem("vault_license_at");
    localStorage.removeItem("hesych_device_id");
    localStorage.removeItem("hesych_sync_ts");
    localStorage.removeItem("vault_lockout");
    localStorage.removeItem("vault_secret_locks");
    sessionStorage.removeItem("vault_lockout");
    getSalt(); // fresh salt for the new vault
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("VaultDB");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    setItems([]);
    setExpanded(new Set());
    setRevealed(new Map());
    setLockout(resetAttempts());
    setFirstTime(true);
    setPhase("locked");
    setToast({ msg: t("lock.resetDone"), type: "ok" });
  }, []);

  // ===== item actions =====

  const withKey = useCallback(async <T,>(fn: (db: IDBDatabase, key: VaultKey) => Promise<T>): Promise<T> => {
    const key = keyRef.current;
    const db = dbRef.current;
    if (!key || !db) throw new Error("vault closed");
    return fn(db, key);
  }, []);

  const decryptPassword = useCallback(
    (id: number): Promise<string> =>
      withKey(async (_db, key) => {
        const item = items.find((i) => i.id === id);
        if (!item || !item.password) return "";
        return decryptWith(key, item.password);
      }),
    [withKey, items],
  );

  const decryptField = useCallback(
    (id: number, idx: number): Promise<string> =>
      withKey(async (_db, key) => {
        const item = items.find((i) => i.id === id);
        const f = item?.custom_fields[idx];
        if (!f || !f.value) return "";
        return decryptWith(key, f.value);
      }),
    [withKey, items],
  );

  const copyPassword = useCallback(
    async (id: number) => {
      try {
        const pw = await decryptPassword(id);
        if (!pw) return;
        if (await copyText(pw)) setToast({ msg: t("toast.copiedPw"), type: "ok" });
        else setToast({ msg: t("toast.copyFail"), type: "err" });
      } catch {
        setToast({ msg: t("toast.decryptFailed"), type: "err" });
      }
    },
    [decryptPassword, copyText],
  );

  const copyUsername = useCallback(
    async (id: number) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      if (await copyText(item.username)) setToast({ msg: t("toast.copiedUser"), type: "ok" });
      else setToast({ msg: t("toast.copyFail"), type: "err" });
    },
    [items, copyText],
  );

  const copyField = useCallback(
    async (id: number, idx: number) => {
      try {
        const v = await decryptField(id, idx);
        if (await copyText(v)) setToast({ msg: t("cf.copied"), type: "ok" });
        else setToast({ msg: t("toast.copyFail"), type: "err" });
      } catch {
        setToast({ msg: t("toast.decryptFailed"), type: "err" });
      }
    },
    [decryptField, copyText],
  );

  const toggleReveal = useCallback(
    async (id: number) => {
      const currently = revealed.has(id);
      if (currently) {
        setRevealed((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        return;
      }
      try {
        const pw = await decryptPassword(id);
        setRevealed((prev) => {
          const next = new Map(prev);
          if (pw) next.set(id, pw);
          else next.delete(id);
          return next;
        });
      } catch {
        setToast({ msg: t("toast.decryptErr"), type: "err" });
      }
    },
    [decryptPassword, revealed],
  );

  const toggleExpand = useCallback(
    (id: number) => {
      if (isItemSecretLocked(id)) {
        setToast({ msg: t("toast.itemLocked"), type: "warn" });
        return;
      }
      if (window.innerWidth >= 768) {
        setDetailId((cur) => (cur === id ? null : id));
        return;
      }
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const toggleFav = useCallback(
    async (id: number) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const favorite = !item.favorite;
      await withKey(async (db) => {
        await vaultSetFavorite(db, id, favorite);
      });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, favorite } : i)));
      setToast({ msg: favorite ? t("toast.favAdded") : t("toast.favRemoved"), type: "ok" });
    },
    [items, withKey],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await withKey(async (db) => {
      await vaultDeleteItem(db, pendingDelete.id);
    });
    setItems((prev) => prev.filter((i) => i.id !== pendingDelete.id));
    if (detailId === pendingDelete.id) setDetailId(null);
    setToast({ msg: t("toast.deleted"), type: "ok" });
    setPendingDelete(null);
  }, [pendingDelete, withKey, detailId]);

  // ===== derived lists =====

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items.filter((i) => {
      if (filter === "fav") return i.favorite;
      if (filter !== "all") return i.category === filter;
      return true;
    });
    if (q) {
      out = out.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.username.toLowerCase().includes(q) ||
          (i.notes && i.notes.toLowerCase().includes(q)) ||
          (i.tags && i.tags.some((tag) => tag.toLowerCase().includes(q))),
      );
    }
    const showGroups = (filter === "all" || filter === "fav") && !q;
    if (showGroups) {
      out = [...out.filter((i) => i.favorite), ...out.filter((i) => !i.favorite)];
    }
    return out;
  }, [items, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: items.length,
      fav: items.filter((i) => i.favorite).length,
    };
    for (const cat of ["social", "finance", "email", "work", "shopping", "gaming", "other"]) {
      c[cat] = items.filter((i) => i.category === cat).length;
    }
    return c;
  }, [items]);

  const ctx = useMemo(
    () => ({
      items,
      filter,
      setFilter,
      search,
      setSearch,
      pendingDelete,
      setPendingDelete,
      pendingSecretLock,
      setPendingSecretLock,
      detailId,
      setDetailId,
      expanded,
      revealed,
      toggleExpand,
      toggleReveal,
      copyPassword,
      copyUsername,
      copyField,
      toggleFav,
      decryptPassword,
      decryptField,
      list,
      counts,
      itemCount: items.length,
      now,
      onLock: doLock,
    }),
    [
      items, filter, search, pendingDelete, pendingSecretLock, detailId,
      expanded, revealed, toggleExpand, toggleReveal, copyPassword,
      copyUsername, copyField, toggleFav, decryptPassword, decryptField,
      list, counts, now, doLock,
    ],
  );

  const bioAvailable =
    !firstTime && isBiometricEnabled() && hasBioSession().exists;

  return (
    <VaultCtx.Provider value={ctx}>
      {phase === "locked" ? (
        <LockScreen
          firstTime={firstTime}
          lockout={lockout}
          onPasswordSubmit={handlePasswordSubmit}
          onBioUnlock={handleBioUnlock}
          onReset={() => setResetOpen(true)}
          showToast={(msg, type = "ok") => setToast({ msg, type })}
        />
      ) : (
        <AppShell onLock={doLock} bioOn={bioAvailable} />
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title={t("delete.title")}
        desc={t("delete.desc")}
        confirmLabel={t("delete.confirmBtn")}
        cancelLabel={t("delete.cancelBtn")}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmModal
        open={resetOpen}
        title="Reset Vault?"
        desc={t("lock.resetConfirm")}
        confirmLabel="Yes, Reset"
        cancelLabel="Cancel"
        danger
        onConfirm={doReset}
        onCancel={() => setResetOpen(false)}
      />
      <SecretLockModal
        itemId={pendingSecretLock?.id ?? null}
        onClose={() => setPendingSecretLock(null)}
        onLocked={() => setToast({ msg: t("secretLock.whatTitle"), type: "ok" })}
      />
      <ToastHost state={toast} />
    </VaultCtx.Provider>
  );
}