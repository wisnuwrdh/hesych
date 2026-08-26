// WebAuthn platform layer - clean-room design (replaces deleted lib/bio.ts).
//
// Hesych uses the WebAuthn PRF extension (HMAC-Secret) to derive a stable
// secret per credential. That secret becomes the KEK that unwraps the
// biometric-wrapped DEK. Requirements:
//   - Platform authenticator (Touch/Face/PIN) - userVerification: required
//   - Browser support for the prf extension (Chromium 118+, Safari 17+)
//
// Credentials are bound per browser + per domain (WebAuthn spec). Each
// browser registers its own credential; multiple can coexist.

const enc = new TextEncoder();

export interface RegisterResult {
  ok: boolean;
  canceled?: boolean;
  errorName?: string;
  /** base64url credential id */
  credId?: string;
  prfSupported?: boolean;
}

export interface AssertionResult {
  ok: boolean;
  canceled?: boolean;
  errorName?: string;
  /** base64url credential id yang dipakai authenticator */
  credId?: string;
  /** keluaran PRF (32 byte) untuk derivasi kunci unwrap */
  prfOutput?: Uint8Array<ArrayBuffer>;
}

export function isPlatformSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return Promise.resolve(false);
  }
  return (
    (
      window.PublicKeyCredential as {
        isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
      }
    ).isUserVerifyingPlatformAuthenticatorAvailable?.() ?? Promise.resolve(false)
  ).catch(() => false);
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomChallenge(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** Registrasi kredensial platform dengan permintaan ekstensi PRF. */
export async function registerCredential(
  appName: string,
): Promise<RegisterResult> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { ok: false, errorName: "unsupported" };
  }
  try {
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: appName, id: location.hostname },
        user: {
          id: userId,
          name: `hesych-${Date.now()}`,
          displayName: "Hesych Vault",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        timeout: 60_000,
        extensions: { prf: {} },
      },
    })) as PublicKeyCredential | null;
    if (!cred) return { ok: false, errorName: "not-created" };

    const clientExt = (
      cred as unknown as {
        getClientExtensionResults: () => { prf?: { enabled?: boolean } };
      }
    ).getClientExtensionResults();
    const prfSupported = Boolean(clientExt?.prf?.enabled);

    return {
      ok: true,
      credId: b64url(cred.rawId),
      prfSupported,
    };
  } catch (e) {
    const err = e as { name?: string };
    return {
      ok: false,
      canceled: err.name === "NotAllowedError",
      errorName: err.name,
    };
  }
}

export interface GetOptions {
  /** daftar credId (base64url) yang terdaftar untuk vault ini */
  credIds: string[];
  /** minta keluaran PRF (wajib untuk jalur biometrik) */
  requestPrf: boolean;
}

function urlToBuf(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = "===".slice((b64url.length + 3) % 4);
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Minta assertion + keluaran PRF dari kredensial terdaftar. */
export async function getCredentialAssertion(
  opts: GetOptions,
): Promise<AssertionResult> {
  try {
    const allow = opts.credIds.map((id) => ({
      id: urlToBuf(id),
      type: "public-key" as const,
    }));
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: allow,
        userVerification: "required",
        timeout: 60_000,
        ...(opts.requestPrf
          ? {
              extensions: {
                prf: { eval: { first: enc.encode("hesych-bio-wrap-v1") } },
              },
            }
          : {}),
      },
    })) as PublicKeyCredential | null;
    if (!assertion) return { ok: false, errorName: "no-assertion" };

    let prfOutput: Uint8Array<ArrayBuffer> | undefined;
    if (opts.requestPrf) {
      const clientExt = (
        assertion as unknown as {
          getClientExtensionResults: () => {
            prf?: { results?: { first?: ArrayBuffer } };
          };
        }
      ).getClientExtensionResults();
      const first = clientExt?.prf?.results?.first;
      if (first) prfOutput = new Uint8Array(first) as Uint8Array<ArrayBuffer>;
    }

    return {
      ok: true,
      credId: b64url(assertion.rawId),
      prfOutput,
    };
  } catch (e) {
    const err = e as { name?: string };
    return {
      ok: false,
      canceled: err.name === "NotAllowedError",
      errorName: err.name,
    };
  }
}
