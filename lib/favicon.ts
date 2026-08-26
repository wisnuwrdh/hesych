// Favicon resolver - ported verbatim from legacy app.js (DOMAIN_MAP + guessDomain).
// Images are served LOCALLY from /favicons/{domain}.png (offline, zero-knowledge).
// Populate the folder once via: node scripts/fetch-favicons.mjs
// Missing files gracefully fall back to the item's initial letter.

import domainsJson from "./favicon-domains.json";

export const DOMAIN_MAP: Record<string, string> = domainsJson;

export function guessDomain(title: string): string | null {
  if (!title) return null;
  const key = title.toLowerCase().trim();
  if (DOMAIN_MAP[key]) return DOMAIN_MAP[key];
  for (const [k, v] of Object.entries(DOMAIN_MAP)) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

export function getFaviconUrl(title: string): string | null {
  const domain = guessDomain(title);
  if (!domain) return null;
  return `/favicons/${domain}.png`;
}
