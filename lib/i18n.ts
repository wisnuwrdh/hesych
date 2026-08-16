import { STRINGS } from "./i18n-strings";

export type I18nVars = Record<string, string | number | undefined>;

// Mirror of the legacy t(): returns the raw string or interpolates {var}.
export function t(key: string, vars?: I18nVars): string {
  const str = (STRINGS as Readonly<Record<string, string>>)[key] ?? key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

// Strings that contain inline HTML (e.g. <strong>…</strong>, <br>).
// UI must render these as structured nodes, never via innerHTML.
export const HTML_KEYS: ReadonlySet<string> = new Set([
  "cpSheet.warn",
  "import.desc",
  "delete.desc",
  "secretLock.desc",
  "importPw.desc",
  "empty.noResults",
  "empty.noFav",
]);