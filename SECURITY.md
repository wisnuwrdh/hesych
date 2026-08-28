# Security Policy

Hesych is a local-first password manager: the vault is encrypted on your
device with keys derived from your master password, and no vault data is ever
sent to a server. This document explains how the security model works, what
is in scope for reports, and how to reach us.

## Supported versions

Only the latest release deployed from `main` (hesych.com / hesych.pages.dev)
is supported. Since the app is a PWA with an in-app update banner, users are
expected to be on the current version.

## Threat model (summary)

| Adversary | Mitigation |
|---|---|
| Stolen browser data / device | Vault rows and metadata are AES-256-GCM encrypted at rest; the DEK is wrapped with a key stretched from the master password (Argon2id, envelope v2; legacy PBKDF2 vaults upgrade transparently on unlock). No master password = no decryption. |
| Malicious or spoofed server | The vault never leaves the device; there are no data endpoints. Only outbound calls: HIBP range API (5-char hash prefix, k-anonymity) and license verification. |
| Offline guessing of a stolen vault | Argon2id (m=64 MiB, t=3, p=1) / PBKDF2-SHA256 (600k) make brute-force expensive; the master password remains the primary control — the local attempt-lockout is UX defense-in-depth, not a security boundary. |
| Share-link recipient / attacker | Shared payloads are AES-256-GCM encrypted in the URL fragment (never sent to any server), keyed by PBKDF2 of a user-chosen passphrase, with an expiry enforced client-side. |
| Malicious JavaScript injected into the page | Mitigated in depth by CSP, frame-ancestors 'none', no third-party JS, self-hosted fonts/assets, and dependency integrity review. Note: for any web app, the served code is part of the trust base — this is inherent to web delivery. |

## Reporting a vulnerability

- Email: **hi@hesych.com**
- We acknowledge reports within **48 hours** and aim to provide a fix or
  mitigation plan within 7 days for critical issues.
- Please include reproduction steps and, if possible, a proof of concept.
- Please do not test against accounts or license keys you do not own.

## Scope

**In scope**

- The web app served at hesych.com (vault, share links, license flow, API routes)
- The cryptographic design and its implementation (`lib/`)
- The PWA/service-worker behavior

**Out of scope**

- Malware, keyloggers, or compromised devices (outside the browser trust base)
- Brute-forcing a stolen vault with a weak master password (see threat model —
  the master password is the primary control)
- Spam or abuse of license activation endpoints (rate-limited, monetization
  only — never touches vault data)
- Social engineering of Gumroad / Cloudflare / email providers

## Safe harbor

We will not pursue legal action against good-faith research that respects
this policy, avoids privacy violations and service degradation, and gives us
a reasonable time to remediate before public disclosure.

## Disclosure

We coordinate disclosure with reporters: details are published after a fix
ships. Security fixes are noted in commit history and, for material issues,
in the app's update banner.

© 2026 Hesych. All rights reserved.
