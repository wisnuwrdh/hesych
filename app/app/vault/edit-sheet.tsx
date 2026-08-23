"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../../../lib/i18n";
import { getStrengthLabel, scorePassword } from "../../../lib/password";
import { isValidBase32 } from "../../../lib/totp";
import type { Category, CustomField, VaultItem } from "../../../lib/types";
import { useVault, type ItemSaveInput } from "./ctx";

const CATEGORIES: Category[] = [
  "other",
  "social",
  "finance",
  "email",
  "work",
  "shopping",
  "gaming",
];

function strengthSegs(score: number): boolean[] {
  return [0, 1, 2].map((i) => i < Math.min(score, 3) || (i === 2 && score === 4));
}

export function EditSheet() {
  const ctx = useVault();
  const editing: VaultItem | null = ctx.editing;
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [totpRaw, setTotpRaw] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [cf, setCf] = useState<CustomField[]>([]);

  const isEdit = editing !== null;

  const hydrate = useCallback(async (item: VaultItem | null) => {
    if (!item) {
      setTitle("");
      setCategory("other");
      setUsername("");
      setPassword("");
      setNotes("");
      setTotpRaw("");
      setFavorite(false);
      setTags([]);
      setCf([]);
      return;
    }
    setTitle(item.title ?? "");
    setCategory((item.category as Category) || "other");
    setFavorite(!!item.favorite);
    setTags(item.tags?.length ? (item.tags as string[]) : []);
    setNotes(typeof item.notes === "string" ? item.notes : "");

    try {
      const [user, pw, totp] = await Promise.all([
        ctx.decryptUsername(item.id),
        ctx.decryptPassword(item.id),
        ctx.decryptTotp(item.id),
      ]);
      setUsername(user);
      setPassword(pw);
      setTotpRaw(totp);
    } catch {
      setUsername("");
      setPassword("");
      setTotpRaw("");
    }

    const fields: CustomField[] = [];
    for (let i = 0; i < (item.custom_fields?.length ?? 0); i++) {
      const f = (item.custom_fields as CustomField[])[i];
      try {
        const val = await ctx.decryptField(item.id, i);
        fields.push({ ...f, value: val });
      } catch {
        fields.push({ ...f, value: "" });
      }
    }
    setCf(fields);
  }, [ctx]);

  const lastOpenRef = useRef(false);
  useEffect(() => {
    if (!ctx.sheetOpen) {
      lastOpenRef.current = false;
      return;
    }
    if (lastOpenRef.current) return;
    lastOpenRef.current = true;
    void hydrate(editing);
  }, [ctx.sheetOpen, editing, hydrate]);

  useEffect(() => {
    if (!ctx.sheetOpen) return;
    ctx.registerGenTarget((pw) => {
      setPassword(pw);
    });
    return () => ctx.registerGenTarget(null);
  }, [ctx, ctx.sheetOpen]);

  if (!ctx.sheetOpen) return null;

  const addTag = () => {
    const raw = tagInput.trim();
    if (!raw || tags.length >= 10) return;
    const clean = raw.slice(0, 30).replace(/[^a-zA-Z0-9-_]/g, "");
    if (!clean || tags.includes(clean) || tags.length >= 10) return;
    setTags((ts) => [...ts, clean]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags((ts) => ts.filter((x) => x !== tag));

  const setFieldVal = (i: number, v: string) =>
    setCf((f) => f.map((x, j) => (j === i ? { ...x, value: v } : x)));

  const onSave = async () => {
    setBusy(true);
    const input: ItemSaveInput = {
      id: editing?.id,
      title: title.trim() || "Unnamed",
      username,
      password,
      notes,
      category,
      totpRaw: totpRaw.trim().toUpperCase(),
      favorite,
      tags,
      custom_fields: cf.map((f) => ({ name: f.name.trim(), type: f.type, value: f.value })),
      color: editing?.color,
      keepPassword: isEdit && password.length === 0,
    };
    const ok = await ctx.saveItem(input);
    setBusy(false);
    if (ok) ctx.closeSheet();
  };

  const score = scorePassword(password);
  const segs = strengthSegs(score);
  const totpValid = !totpRaw || isValidBase32(totpRaw.toUpperCase());

  return (
    <>
      <div className="overlay show" onClick={ctx.closeSheet} />
      <div className="sheet show" id="itemSheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{isEdit ? t("sheet.editTitle") : t("sheet.addTitle")}</span>
          <button className="sheet-close" onClick={ctx.closeSheet}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="field">
          <div className="field-label">{t("sheet.nameLabel")}</div>
          <input
            id="fTitle"
            value={title}
            placeholder={t("sheet.namePh")}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field-label">{t("sheet.catLabel")}</div>
          <select
            id="fCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="field-label">{t("sheet.userLabel")}</div>
          <input
            id="fUser"
            value={username}
            placeholder={t("sheet.userPh")}
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field-label">
            <span>{t("sheet.pwLabel")}</span>
            <span className="form-strength-label" id="strengthLabel">
              {password ? getStrengthLabel(score) : ""}
            </span>
          </div>
          <div className="field-pw">
            <input
              id="fPass"
              type="password"
              value={password}
              placeholder={isEdit ? t("sheet.pwEditPh") : t("sheet.pwPh")}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />
            <button
              type="button"
              className="pw-gen"
              id="pwGenBtn"
              title="Advanced Generator"
              onClick={() => ctx.setGenOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
            <button
              type="button"
              className="pw-eye"
              onClick={(e) => {
                const input = e.currentTarget.parentElement?.querySelector("input");
                if (input) input.type = input.type === "password" ? "text" : "password";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          <div className="form-strength">
            <div className="form-strength-bar">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`form-strength-seg${segs[i] ? " lit" : ""}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <div className="field-label">{t("sheet.notesLabel")}</div>
          <textarea
            id="fNotes"
            rows={3}
            value={notes}
            placeholder={t("sheet.notesPh")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field-label">{t("sheet.totpLabel")}</div>
          <div className="totp-field-wrap">
            <input
              id="fTotp"
              value={totpRaw}
              placeholder={t("sheet.totpPh")}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTotpRaw(e.target.value)}
            />
            <button
              type="button"
              className={`totp-clear-btn${totpRaw ? "" : " hidden"}`}
              title="Clear secret"
              onClick={() => setTotpRaw("")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", marginTop: 4, color: totpRaw && !totpValid ? "var(--danger)" : "var(--dim)" }}>
            {totpRaw && !totpValid ? "Secret invalid (A-Z, 2-7)" : t("sheet.totpHint")}
          </div>
        </div>

        <div className="field">
          <div className="field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{t("tags.label")}</span>
            <span className="premium-badge" style={{ fontSize: 8 }}>PRO</span>
          </div>
          {ctx.isPremium() ? (
            <>
              <div className="tag-list">
                {tags.map((tag) => (
                  <span className="tag-chip removable" key={tag} onClick={() => removeTag(tag)}>
                    #{tag}
                    <button type="button" className="tag-chip-remove" title="Remove" onClick={() => removeTag(tag)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="tag-input-wrap">
                <input
                  className="tag-input"
                  id="tagFormInput"
                  placeholder={t("tags.addPh")}
                  value={tagInput}
                  maxLength={30}
                  onChange={(e) => setTagInput(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      addTag();
                    } else if (e.key === "Backspace" && !tagInput && tags.length) {
                      removeTag(tags[tags.length - 1]);
                    }
                  }}
                />
                <button type="button" className="tag-input-btn" onClick={addTag}>
                  Add
                </button>
              </div>
            </>
          ) : (
            <div className="cf-premium-gate">
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
                  {t("tags.label")} <span className="premium-badge" style={{ fontSize: 8 }}>PRO</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{t("tags.premiumHint")}</div>
              </div>
              <button className="gen-action-btn primary" style={{ fontSize: 11, padding: "6px 10px", flexShrink: 0 }}>
                Upgrade
              </button>
            </div>
          )}
        </div>

        <div className="field" id="cfFormSection">
          <div className="field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{t("cf.label")}</span>
            <span className="premium-badge" style={{ fontSize: 8 }}>PRO</span>
          </div>
          {ctx.isPremium() ? (
            <>
              <div className="cf-form-list">
                {cf.map((f, i) => (
                  <div className="cf-form-item" key={i}>
                    <div className="cf-form-row">
                      <input
                        className="cf-form-input"
                        placeholder={t("cf.fieldNamePh")}
                        value={f.name}
                        onChange={(e) =>
                          setCf((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                        }
                      />
                      <button
                        type="button"
                        className="cf-form-type"
                        title="Toggle type"
                        onClick={() =>
                          setCf((arr) =>
                            arr.map((x, j) =>
                              j === i ? { ...x, type: x.type === "password" ? "text" : "password" } : x,
                            ),
                          )
                        }
                      >
                        {f.type === "password" ? t("cf.typePassword") : t("cf.typeText")}
                      </button>
                      <button
                        className="cf-item-remove"
                        title={t("cf.removeField")}
                        onClick={() => setCf((arr) => arr.filter((_, j) => j !== i))}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <input
                      className="cf-form-input"
                      type={f.type === "password" ? "password" : "text"}
                      placeholder={t("cf.fieldValuePh")}
                      value={f.value}
                      onChange={(e) => setFieldVal(i, e.target.value)}
                    />
                  </div>
                ))}
                <button type="button" className="cf-add-btn" onClick={() => setCf((arr) => [...arr, { name: "", type: "text", value: "" }])}>
                  {t("cf.addField")}
                </button>
              </div>
            </>
          ) : (
            <div className="cf-premium-gate">
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
                  {t("cf.label")} <span className="premium-badge" style={{ fontSize: 8 }}>PRO</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{t("cf.premiumHint")}</div>
              </div>
              <button className="gen-action-btn primary" style={{ fontSize: 11, padding: "6px 10px", flexShrink: 0 }}>
                Upgrade
              </button>
            </div>
          )}
        </div>

        <div className="sheet-actions">
          <button className="btn-save" disabled={busy} onClick={onSave}>
            {t("sheet.saveBtn")}
          </button>
          <button className="btn-cancel" onClick={ctx.closeSheet}>
            {t("sheet.cancelBtn")}
          </button>
        </div>
      </div>
    </>
  );
}