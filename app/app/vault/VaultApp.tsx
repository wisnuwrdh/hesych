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
import { getSalt, writeVerifierForKey, checkVerifier, isFirstTime } from "../../../lib/verifier";
import {
  buildEncryptedRow,
  loadItems,
  migrateMetadata,
  vaultDeleteItem,
  vaultSetFavorite,
  type EncryptedVaultRow,
} from "../../../lib/vault";
import { histAdd, openDB, dbPutItem, histGetAll, histDelete } from "../../../lib/db";
import { reencryptVault } from "../../../lib/master";
import {
  exportMasterBackup,
  exportCustomBackup,
  importBackup as importBackupJson,
} from "../../../lib/backup";
import {
  checkBreach,
  checkAllItems,
  saveBreachResult,
} from "../../../lib/breach";
import type { ItemSaveInput } from "./ctx";
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
import { isPasswordOld } from "../../../lib/format";
import { isItemSecretLocked } from "../../../lib/secretlock";
import type { VaultItem } from "../../../lib/types";
import { LockScreen } from "./lock-screen";
import { ConfirmModal, ToastHost } from "./ui";
import { SecretLockModal } from "./secret-lock-modal";
import { AppShell } from "./shell";
import { VaultCtx, type VaultFilter, DEFAULT_ADV, type AdvFilter } from "./ctx";
import { EditSheet } from "./edit-sheet";
import { GenSheet } from "./gen-sheet";
import { ChangePwSheet } from "./cp-sheet";
import { HistorySheet } from "./history-sheet";
import { ExportSheet, ImportSheet } from "./backup-sheets";

type Phase = "locked" | "unlocked";

export function VaultApp() {
  const [phase, setPhase] = useState<Phase>("locked");
  const [firstTime, setFirstTime] = useState<boolean>(() => isFirstTime());
  const [lockout, setLockout] = useState<LockoutState>(() => loadLockoutState());
  const [items, setItems] = useState<VaultItem[]>([]);
  const [filter, setFilter] = useState<VaultFilter>("all");
  const [search, setSearch] = useState("");
  const [adv, setAdv] = useState<AdvFilter>(DEFAULT_ADV);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Map<number, string>>(new Map());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VaultItem | null>(null);
  const [pendingSecretLock, setPendingSecretLock] = useState<VaultItem | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" } | null>(null);
  const [now, setNow] = useState(0);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);
  const [histItem, setHistItem] = useState<VaultItem | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [breachRunning, setBreachRunning] = useState(false);
  const [breachChecking, setBreachChecking] = useState<Set<number>>(new Set());
  const genTargetRef = useRef<((pw: string) => void) | null>(null);

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

  const decryptUsername = useCallback(
    (id: number): Promise<string> =>
      withKey(async (_db, key) => {
        const item = items.find((i) => i.id === id);
        if (!item || !item.username) return "";
        return decryptWith(key, item.username);
      }),
    [withKey, items],
  );

  const decryptTotp = useCallback(
    (id: number): Promise<string> =>
      withKey(async (_db, key) => {
        const item = items.find((i) => i.id === id);
        if (!item || !item.totp_secret) return "";
        return decryptWith(key, item.totp_secret);
      }),
    [withKey, items],
  );

  const isPremium = useCallback(() => {
    try {
      return localStorage.getItem("vault_license_verified") === "1";
    } catch {
      return false;
    }
  }, []);

  const openSheet = useCallback(
    (item?: VaultItem | null) => {
      setEditing(item ?? null);
      setSheetOpen(true);
    },
    [],
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setEditing(null);
  }, []);

  const useGenPassword = useCallback(
    (pw: string) => {
      setGenOpen(false);
      genTargetRef.current?.(pw);
    },
    [],
  );

  const registerGenTarget = useCallback((h: ((pw: string) => void) | null) => {
    genTargetRef.current = h;
  }, []);

  const saveItem = useCallback(
    async (input: ItemSaveInput): Promise<boolean> => {
      try {
        return await withKey(async (db, key) => {
          const meta = {
            resetBreach: false,
            breachStatus: null as number | null,
            breachCheckedAt: null as number | null,
          };
          if (input.id !== undefined) {
            const existing = items.find((i) => i.id === input.id);
            if (!existing) return false;
            const passwordChanged = !input.keepPassword && input.password.length > 0;
            const row = await buildEncryptedRow(
              key,
              {
                ...input,
                resetBreach: passwordChanged,
                breachStatus: existing.breachStatus ?? null,
                breachCheckedAt: existing.breachCheckedAt ?? null,
              },
              existing,
            );
            await dbPutItem(db, row);
            if (passwordChanged && isPremium()) {
              await histAdd(db, input.id, existing.password);
            }
            setItems((prev) =>
              prev.map((i) =>
                i.id === input.id
                  ? {
                      ...i,
                      title: input.title,
                      username: input.username,
                      category: input.category,
                      tags: input.tags,
                      custom_fields: input.custom_fields,
                      password: row.password,
                      totp_secret: row.totp_secret,
                      notes: input.notes,
                      ...(passwordChanged
                        ? { breachStatus: undefined as number | undefined, breachCheckedAt: null }
                        : {}),
                      updatedAt: row.updatedAt,
                    }
                  : i,
              ),
            );
            setToast({ msg: t("toast.saved"), type: "ok" });
            return true;
          }
          const row: EncryptedVaultRow = await buildEncryptedRow(
            key,
            { ...input, favorite: false, ...meta },
          );
          const id = await dbPutItem(db, row);
          const saved: VaultItem = {
            id,
            title: input.title,
            username: input.username,
            password: row.password,
            notes: input.notes,
            color: row.color,
            favorite: !!input.favorite,
            category: input.category,
            tags: input.tags,
            totp_secret: row.totp_secret,
            custom_fields: row.custom_fields,
            breachStatus: undefined,
            breachCheckedAt: null,
            updatedAt: row.updatedAt,
            createdAt: row.createdAt,
          };
          setItems((prev) => [saved, ...prev]);
          setToast({ msg: t("toast.saved"), type: "ok" });
          return true;
        });
      } catch {
        setToast({ msg: t("toast.saveFail"), type: "err" });
        return false;
      }
    },
    [withKey, items, isPremium],
  );

  const changeMasterPw = useCallback(
    async (oldPw: string, newPw: string): Promise<string | null> => {
      const db = dbRef.current;
      const key = keyRef.current;
      if (!db || !key) return "cp.failed";
      const salt = getSalt();
      if (!(await checkVerifier(oldPw, salt))) return "cp.wrongOld";
      try {
        const newKey = await deriveKey(newPw, salt);
        await reencryptVault(db, key, newKey);
        await writeVerifierForKey(newKey);
        keyRef.current = newKey;
        await enterVault(db, newKey);
        return null;
      } catch (e) {
        console.warn("change master password", e);
        return "cp.failed";
      }
    },
    [enterVault],
  );

  const decryptRaw = useCallback(
    (b64: string): Promise<string> =>
      withKey(async (_db, key) => decryptWith(key, b64)),
    [withKey],
  );

  const loadHistory = useCallback(
    (itemId: number) => withKey((db) => histGetAll(db, itemId)),
    [withKey],
  );

  const deleteHistoryEntry = useCallback(
    (hid: number) => withKey((db) => histDelete(db, hid)),
    [withKey],
  );

  const openHist = useCallback((item: VaultItem) => setHistItem(item), []);
  const closeHist = useCallback(() => setHistItem(null), []);

  const doExport = useCallback(
    async (mode: "master" | "custom", pw?: string): Promise<string | null> => {
      const db = dbRef.current;
      const key = keyRef.current;
      if (!db || !key) return "Vault closed";
      try {
        const bundle =
          mode === "custom"
            ? await exportCustomBackup(db, key, pw || "")
            : await exportMasterBackup(db);
        const blob = new Blob([JSON.stringify(bundle)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hesych_backup_${Date.now()}.vault`;
        a.click();
        URL.revokeObjectURL(url);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [],
  );

  const doImport = useCallback(
    async (
      file: File,
      mode: "replace" | "merge",
      pw?: string,
    ): Promise<string | null> => {
      const db = dbRef.current;
      const key = keyRef.current;
      if (!db || !key) return "Vault closed";
      try {
        const text = await file.text();
        const bundle = JSON.parse(text);
        await importBackupJson(db, bundle, key, mode, pw);
        await enterVault(db, key);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [enterVault],
  );

  const updateItemMeta = useCallback(
    (id: number, patch: Partial<VaultItem>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    [],
  );

  const checkItemBreach = useCallback(
    async (id: number) => {
      const db = dbRef.current;
      const key = keyRef.current;
      const item = items.find((i) => i.id === id);
      if (!db || !key || !item) return;
      setBreachChecking((prev) => new Set(prev).add(id));
      try {
        const pw = await decryptWith(key, item.password);
        const count = await checkBreach(pw);
        const status = count > 0 ? 2 : 1;
        const checkedAt = Date.now();
        await saveBreachResult(db, key, id, status, checkedAt);
        updateItemMeta(id, { breachStatus: status, breachCheckedAt: checkedAt });
        setToast(
          count > 0
            ? { msg: t("breach.breachedSingle", { n: count }), type: "err" }
            : { msg: t("breach.safeSingle"), type: "ok" },
        );
      } catch (e) {
        setToast({
          msg: t("breach.apiErr", { msg: e instanceof Error ? e.message : String(e) }),
          type: "err",
        });
      } finally {
        setBreachChecking((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [items, updateItemMeta],
  );

  const checkAllBreaches = useCallback(
    async () => {
      const db = dbRef.current;
      const key = keyRef.current;
      if (!db || !key || items.length === 0) return;
      setBreachRunning(true);
      try {
        const summary = await checkAllItems(db, key, items, undefined, (id, status) => {
          updateItemMeta(id, { breachStatus: status, breachCheckedAt: Date.now() });
        });
        if (summary.failed === items.length) {
          setToast({ msg: t("breach.offline"), type: "err" });
        } else {
          setToast(
            summary.breached > 0
              ? {
                  msg: t("breach.done", {
                    breached: summary.breached,
                    safe: summary.safe,
                  }),
                  type: "warn",
                }
              : { msg: t("breach.doneAll"), type: "ok" },
          );
        }
      } finally {
        setBreachRunning(false);
      }
    },
    [items, updateItemMeta],
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
    if (adv.tags.length) {
      out = out.filter((i) => adv.tags.every((tag) => (i.tags || []).includes(tag)));
    }
    if (adv.status !== "all") {
      out = out.filter((i) => {
        if (adv.status === "breached") return i.breachStatus === 2;
        if (adv.status === "safe") return i.breachStatus === 1;
        if (adv.status === "unchecked")
          return i.breachStatus === undefined || i.breachStatus === null;
        return true;
      });
    }
    if (adv.age !== "all") {
      out = out.filter((i) => {
        if (adv.age === "old") return isPasswordOld(i);
        if (adv.age === "new") return !!i.updatedAt && !isPasswordOld(i);
        return true;
      });
    }
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
  }, [items, filter, search, adv]);

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
      decryptUsername,
      decryptTotp,
      editing,
      sheetOpen,
      openSheet,
      closeSheet,
      saveItem,
      genOpen,
      setGenOpen,
      useGenPassword,
      registerGenTarget,
      isPremium,
      cpOpen,
      setCpOpen,
      changeMasterPw,
      histItem,
      openHist,
      closeHist,
      decryptRaw,
      loadHistory,
      deleteHistoryEntry,
      backupOpen,
      setBackupOpen,
      importOpen,
      setImportOpen,
      doExport,
      doImport,
      breachRunning,
      breachChecking,
      checkItemBreach,
      checkAllBreaches,
      list,
      counts,
      itemCount: items.length,
      adv,
      setAdv,
      advCount:
        adv.tags.length +
        (adv.status !== "all" ? 1 : 0) +
        (adv.age !== "all" ? 1 : 0),
      now,
      onLock: doLock,
    }),
    [
      items, filter, search, pendingDelete, pendingSecretLock, detailId,
      expanded, revealed, toggleExpand, toggleReveal, copyPassword,
      copyUsername, copyField, toggleFav, decryptPassword, decryptField,
      decryptUsername, decryptTotp, editing, sheetOpen, openSheet, closeSheet, saveItem,
      genOpen, useGenPassword, registerGenTarget, isPremium, cpOpen, changeMasterPw,
      histItem, openHist, closeHist, decryptRaw, loadHistory, deleteHistoryEntry,
      backupOpen, setBackupOpen, importOpen, setImportOpen, doExport, doImport,
      breachRunning, breachChecking, checkItemBreach, checkAllBreaches,
      list, counts, adv, now, doLock,
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

      <EditSheet />
      {genOpen ? <GenSheet /> : null}
      <ChangePwSheet />
      <HistorySheet />
      <ExportSheet />
      <ImportSheet />
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