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
import { histAdd, openDB, dbPutItem, histGetAll, histDelete, resetDBCache } from "../../../lib/db";
import { shareLogAdd, shareLogAll, shareLogDelete } from "../../../lib/db";
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
import { scanVaultHealth, type HealthReport } from "../../../lib/health";
import { scorePassword } from "../../../lib/password";
import {
  buildShareFragment,
  type ShareInclude,
} from "../../../lib/share";
import type { ShareLogEntry } from "../../../lib/types";
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
import { ConfirmModal, ToastHost, showGlobalToast } from "./ui";
import { SecretLockModal } from "./secret-lock-modal";
import { AppShell } from "./shell";
import { VaultCtx, type VaultFilter, DEFAULT_ADV, type AdvFilter } from "./ctx";
import { EditSheet } from "./edit-sheet";
import { GenSheet } from "./gen-sheet";
import { ChangePwSheet } from "./cp-sheet";
import { HistorySheet } from "./history-sheet";
import { ExportSheet, ImportSheet } from "./backup-sheets";
import { HealthSheet } from "./health-sheet";
import { ShareSheet, ShareLogSheet } from "./share-sheets";

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
  const [strengthMap, setStrengthMap] = useState<Map<number, number>>(new Map());
  const [healthOpen, setHealthOpen] = useState(false);
  const [shareItem, setShareItem] = useState<VaultItem | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLog, setShareLog] = useState<ShareLogEntry[]>([]);
  const [shareLogOpen, setShareLogOpen] = useState(false);
  const genTargetRef = useRef<((pw: string) => void) | null>(null);

  const keyRef = useRef<VaultKey | null>(null);
  const dbRef = useRef<IDBDatabase | null>(null);
  const lastActiveRef = useRef(0);
  const occupiedRef = useRef(false);

  /** Auto-dismissing toast (2.6s) — never call raw setToast directly. */
  const pushToast = useCallback(
    (msg: string, type: "ok" | "err" | "warn" = "ok") =>
      showGlobalToast(msg, type, setToast),
    [],
  );

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
    // Flush the cached openDB() promise — it resolves to the connection we
    // just closed; reusing it throws "The database connection is closing".
    resetDBCache();
    setPhase("locked");
  }, []);

  // Idle + tab-hidden auto-lock.
  useEffect(() => {
    if (phase !== "unlocked") return;
    lastActiveRef.current = Date.now();
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const mark = () => {
      lastActiveRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, mark));
    const tick = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - lastActiveRef.current > IDLE_LOCK_MS) {
        pushToast(t("toast.idleLock"), "warn");
        doLock();
      }
    }, 1000);
    const onVis = () => {
      setNow(Date.now());
      if (document.hidden) {
        // Debounce: momentary hides (app switch during key derivation,
        // rotation) must not insta-lock the vault.
        hideTimer = setTimeout(() => {
          if (document.hidden) {
            pushToast(t("toast.tabLock"), "warn");
            doLock();
          }
        }, 600);
      } else if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [phase, doLock, pushToast]);

  // ===== unlock / create =====

  const loadShareLog = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    try {
      setShareLog(await shareLogAll(db));
    } catch {
      setShareLog([]);
    }
  }, []);

  const deleteShareLog = useCallback(async (slid: number) => {
    const db = dbRef.current;
    if (!db) return;
    try {
      await shareLogDelete(db, slid);
      setShareLog((prev) => prev.filter((s) => s.slid !== slid));
    } catch {
      // ignore
    }
  }, []);

  const populateStrengths = useCallback(async (list: VaultItem[], key: VaultKey) => {
    if (list.length === 0) return;
    for (const item of list) {
      try {
        const pw = await decryptWith(key, item.password);
        const score = scorePassword(pw);
        setStrengthMap((prev) => {
          if (prev.get(item.id) === score) return prev;
          const next = new Map(prev);
          next.set(item.id, score);
          return next;
        });
      } catch {
        // leave unpopulated → treated as strong until computed
      }
    }
  }, []);

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
    setStrengthMap(new Map());
    setExpanded(new Set());
    setRevealed(new Map());
    setPhase("unlocked");
    void populateStrengths(loaded, key);
    void loadShareLog();
  }, [populateStrengths, loadShareLog]);

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
          await enterVault(db, key);
          setFirstTime(false); // only set after vault is successfully open
          setLockout(resetAttempts());
          if (isBiometricSupported()) {
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
        setBioSession(pw, credId, isPrfEnabled(), { forceLegacy: true }).catch(() => {});
        return true;
      } catch (err) {
        console.error("handlePasswordSubmit error", err);
        throw err; // re-throw so lock-screen catch block shows the message
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
        pushToast(t("bio.failed"), "err");
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
    [enterVault, pushToast],
  );

  // ===== reset =====

  const doReset = useCallback(async () => {
    const db = dbRef.current;
    if (db) {
      db.close();
      dbRef.current = null;
    }
    keyRef.current = null;
    resetDBCache(); // flush stale singleton so next openDB() creates a fresh connection
    disableBiometric();
    localStorage.removeItem("vault_salt");
    localStorage.removeItem("vault_ver");
    localStorage.removeItem("vault_ver_magic");
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
    pushToast(t("lock.resetDone"), "ok");
  }, [pushToast]);

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
            const itemId = input.id;
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
            if (!input.keepPassword) {
              const score = scorePassword(input.password);
              setStrengthMap((prev) => {
                if (prev.get(itemId) === score) return prev;
                const next = new Map(prev);
                next.set(itemId, score);
                return next;
              });
            }
            pushToast(t("toast.saved"), "ok");
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
          setStrengthMap((prev) => {
            const score = scorePassword(input.password);
            if (prev.get(id) === score) return prev;
            const next = new Map(prev);
            next.set(id, score);
            return next;
          });
          pushToast(t("toast.saved"), "ok");
          return true;
        });
      } catch {
        pushToast(t("toast.saveFail"), "err");
        return false;
      }
    },
    [withKey, items, isPremium, pushToast],
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
        pushToast(
          count > 0 ? t("breach.breachedSingle", { n: count }) : t("breach.safeSingle"),
          count > 0 ? "err" : "ok",
        );
      } catch (e) {
        pushToast(
          t("breach.apiErr", { msg: e instanceof Error ? e.message : String(e) }),
          "err",
        );
      } finally {
        setBreachChecking((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [items, updateItemMeta, pushToast],
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
          pushToast(t("breach.offline"), "err");
        } else if (summary.breached > 0) {
          pushToast(
            t("breach.done", { breached: summary.breached, safe: summary.safe }),
            "warn",
          );
        } else {
          pushToast(t("breach.doneAll"));
        }
      } finally {
        setBreachRunning(false);
      }
    },
    [items, updateItemMeta, pushToast],
  );

  const checkHealth = useCallback(
    async (): Promise<HealthReport | null> => {
      const db = dbRef.current;
      const key = keyRef.current;
      if (!db || !key) return null;
      const current = items;
      return scanVaultHealth(current, key, (id, score) => {
        setStrengthMap((prev) => {
          if (prev.get(id) === score) return prev;
          const next = new Map(prev);
          next.set(id, score);
          return next;
        });
      });
    },
    [items],
  );

  const buildShareLink = useCallback(
    async (
      item: VaultItem,
      passphrase: string,
      expHours: number,
      incl: ShareInclude[],
    ): Promise<{ link: string } | { err: string }> => {
      const db = dbRef.current;
      const key = keyRef.current;
      if (!db || !key) return { err: "Vault closed" };
      try {
        const password = incl.includes("pw") ? await decryptPassword(item.id) : "";
        const totp = incl.includes("totp") ? await decryptTotp(item.id) : "";
        const username = incl.includes("user") ? item.username : "";
        const notes = incl.includes("notes") ? item.notes : "";
        const now = Date.now();
        const payload = {
          v: 1 as const,
          iat: now,
          exp: now + expHours * 3600 * 1000,
          incl,
          title: item.title,
          username,
          password,
          notes,
          totp,
        };
        const fragment = await buildShareFragment(payload, passphrase);
        const link = `${window.location.origin}/share#${fragment}`;
        try {
          await shareLogAdd(db, {
            itemId: item.id,
            itemTitle: item.title,
            link,
            createdAt: now,
            expTs: payload.exp,
          });
          void loadShareLog();
        } catch {
          // logging is best-effort
        }
        return { link };
      } catch (e) {
        return { err: e instanceof Error ? e.message : String(e) };
      }
    },
    [decryptPassword, decryptTotp, loadShareLog],
  );

  const copyPassword = useCallback(
    async (id: number) => {
      try {
        const pw = await decryptPassword(id);
        if (!pw) return;
        if (await copyText(pw)) pushToast(t("toast.copiedPw"), "ok");
        else pushToast(t("toast.copyFail"), "err");
      } catch {
        pushToast(t("toast.decryptFailed"), "err");
      }
    },
    [decryptPassword, copyText, pushToast],
  );

  const copyUsername = useCallback(
    async (id: number) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      if (await copyText(item.username)) pushToast(t("toast.copiedUser"), "ok");
      else pushToast(t("toast.copyFail"), "err");
    },
    [items, copyText, pushToast],
  );

  const copyField = useCallback(
    async (id: number, idx: number) => {
      try {
        const v = await decryptField(id, idx);
        if (await copyText(v)) pushToast(t("cf.copied"), "ok");
        else pushToast(t("toast.copyFail"), "err");
      } catch {
        pushToast(t("toast.decryptFailed"), "err");
      }
    },
    [decryptField, copyText, pushToast],
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
        pushToast(t("toast.decryptErr"), "err");
      }
    },
    [decryptPassword, revealed, pushToast],
  );

  const toggleExpand = useCallback(
    (id: number) => {
      if (isItemSecretLocked(id)) {
        pushToast(t("toast.itemLocked"), "warn");
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
    [pushToast],
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
      pushToast(favorite ? t("toast.favAdded") : t("toast.favRemoved"), "ok");
    },
    [items, withKey, pushToast],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await withKey(async (db) => {
      await vaultDeleteItem(db, pendingDelete.id);
    });
    setItems((prev) => prev.filter((i) => i.id !== pendingDelete.id));
    if (detailId === pendingDelete.id) setDetailId(null);
    pushToast(t("toast.deleted"), "ok");
    setPendingDelete(null);
  }, [pendingDelete, withKey, detailId, pushToast]);

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
    if (adv.strength !== "all") {
      out = out.filter((i) => {
        const s = strengthMap.get(i.id);
        if (adv.strength === "weak") return s !== undefined && s <= 2;
        if (adv.strength === "strong") return s !== undefined && s >= 3;
        if (adv.strength === "fair") return s === 3;
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
  }, [items, filter, search, adv, strengthMap]);

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
        (adv.age !== "all" ? 1 : 0) +
        (adv.strength !== "all" ? 1 : 0),
      now,
      onLock: doLock,
      strengthMap,
      healthOpen,
      setHealthOpen,
      checkHealth,
      shareItem,
      setShareItem,
      shareOpen,
      setShareOpen,
      buildShareLink,
      shareLog,
      loadShareLog,
      deleteShareLog,
      shareLogOpen,
      setShareLogOpen,
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
      strengthMap, healthOpen, setHealthOpen, checkHealth,
      shareItem, setShareItem, shareOpen, setShareOpen, buildShareLink,
      shareLog, loadShareLog, deleteShareLog, shareLogOpen, setShareLogOpen,
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
          showToast={pushToast}
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
      <HealthSheet />
      <ShareSheet />
      <ShareLogSheet />
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
        onLocked={() => pushToast(t("secretLock.whatTitle"), "ok")}
      />
      <ToastHost state={toast} />
    </VaultCtx.Provider>
  );
}