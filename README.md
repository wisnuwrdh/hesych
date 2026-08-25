# 🔐 Hesych — Local-First Password Manager

> Zero-knowledge · AES-256-GCM · Works offline · One-time payment ($9.99 lifetime) · No subscription

**Hesych** is a local-first password manager PWA. Your vault never touches a server: everything is encrypted and stored on *your* device using WebCrypto. No accounts, no telemetry on your data, no cloud unless *you* bring your own.

**Live:** [hesych.com](https://hesych.com) · Mirror: [hesych.pages.dev](https://hesych.pages.dev)

---

## ✨ Features

### Free
- 🔒 Unlimited items with AES-256-GCM encryption (PBKDF2-SHA256, 600k iterations)
- 📶 100% offline — no internet needed to open your vault
- 🗂️ Categories, favorites, tags, search & advanced filters
- 🔑 Password generator + passphrase mode (+ bulk mode)
- ⏱️ Built-in TOTP 2FA codes with countdown
- 🚨 Breach checking via Have I Been Pwned (**k-anonymity** — your password never leaves the device unhashed)
- 📤 Encrypted backup export/import (master-password or custom-passphrase mode)
- 💾 Local auto-backup — encrypted snapshot to a folder you choose (FS Access API)
- 🌗 Dark / light theme, installable PWA
- 🔍 Secret Lock — temporarily hide sensitive secrets ("digital detox" timer)

### Premium ($9.99 lifetime)
- ❤️ Vault Health Score — weak/reused/old/breached audit with fix flow
- 🕘 Per-item password history
- 🎨 Custom fields (text/password entries per item)

---

## 🛡️ Security model

| Layer | Detail |
|---|---|
| Encryption | AES-256-GCM; key derived from master password via PBKDF2-SHA256 ×600,000 |
| Storage | IndexedDB (`VaultDB`), rows encrypted at rest; metadata encrypted since schema v6 |
| Verifier | Encrypted "vault OK" marker — the server-equivalent check happens **on device** |
| Network | Data endpoints: **none**. Only outbound calls: HIBP range API (5-char hash prefix) and license activation |
| Biometrics | WebAuthn platform authenticator wraps/unlocks per browser+device; credential never leaves the device |
| Trade-off | Forget your master password = data unrecoverable. No backdoor by design |

> Clearing site data intentionally wipes biometric registration and (with full wipe) the vault itself — always keep an encrypted export somewhere safe.

---

## 🧱 Tech stack

- **Next.js 16** App Router (webpack) + **React 19** + TypeScript strict
- **Tailwind CSS 4**, custom legacy-parity design tokens
- **Vitest** (63 tests) · ESLint 9
- **Cloudflare Pages** via `@opennextjs/cloudflare` (Direct Upload through GitHub Actions)
- **Cloudflare D1** — license device registry (max 3 devices/key)
- **Gumroad** — payment + license key issuance, verified server-side proxy

```
app/            Next.js routes (landing, /app vault, /share viewer, legal, api/)
app/app/vault/  Vault UI components (lock screen, shell, sheets, cards…)
lib/            Core logic: crypto, db, auth, bio, breach, share, health,
                backup, localbackup, license, totp, i18n…
scripts/        Owner utilities: d1-schema.sql, gen-license.mjs (legacy),
                pages-postbuild.mjs
test/           Vitest suites (crypto/db/vault/auth/share/totp/…)
```

---

## 🚀 Getting started

```bash
npm install          # Chromium desktop recommended for full features
npm run dev          # http://localhost:3000
npm test             # 63 tests
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

> Some features (biometrics, local auto-backup folder picker) require a
> Chromium-based browser and a secure context (HTTPS or localhost).

---

## ☁️ Deployment (Cloudflare Pages)

Deployed via GitHub Actions → Direct Upload (bypasses Pages' pinned wrangler,
which miscompiles OpenNext ≥1.19 workers — see workers-sdk#14389).

1. Create a **D1 database** and run [`scripts/d1-schema.sql`](scripts/d1-schema.sql) in its console
2. Create a **Gumroad product** with *license key generation* enabled
3. Set these **Production environment variables** on the Pages project:

| Variable | Purpose |
|---|---|
| `GUMROAD_PRODUCT_ID` | Gumroad product used for license verification |
| `CF_ACCOUNT_ID` | Cloudflare account |
| `D1_DATABASE_ID` | License registry database |
| `CF_D1_API_TOKEN` | API token with D1 Edit permission |

4. Deploy — either push to `main` (Actions workflow `.github/workflows/deploy-pages.yml`)
   or run locally:

```bash
npx opennextjs-cloudflare build
npx wrangler@latest pages deploy .open-next --project-name=hesych --branch=main
```

---

## 💳 Licensing

Buyers receive a license key by email after purchase → enter it in the app
(menu ⋮ → *Enter License Key*) → device is registered against the D1 registry
(max **3 devices/key**, removable from *Manage License*). Verification proxies
through `/api/verify-license` so refunds/chargebacks are honored automatically.

---

## 🔑 Biometric unlock notes

- Activation: unlock vault → tap the fingerprint icon in the appbar → confirm
  the WebAuthn prompt (device screen-lock required)
- Credentials are **per browser + per domain** — activate separately in each
  browser you use
- Clearing site data removes the registration (and, on full wipe, the vault) —
  keep encrypted backups

---

## 🗺️ Roadmap / Known issues

- [ ] [#1](https://github.com/wisnuwrdh/hesych/issues/1) — Biometric unlock affordance on lock screen when supported-but-not-enabled
- [ ] Multi-device cloud sync (encrypted snapshot merge; D1 `vault_sync` foundation planned)
- [ ] Google Drive auto-backup (pending scope decision on Google's restricted-scope verification)
- [ ] Content cluster: feature deep-dives & comparisons

---

## 📮 Contact

Questions about security or licensing: [hi@hesych.com](mailto:hi@hesych.com)

---

© 2026 Hesych. All rights reserved.
