import { describe, it, expect } from "vitest";
import {
  buildShareFragment,
  decryptShare,
  urlsafeToB64,
  shareExpiryKey,
  type SharePayload,
} from "../lib/share";

function payload(over: Partial<SharePayload> = {}): SharePayload {
  return {
    v: 1,
    iat: Date.now(),
    exp: Date.now() + 3600 * 1000,
    incl: ["pw", "user"],
    title: "GitHub",
    username: "octocat",
    password: "sup3r-s3cret!",
    notes: "",
    totp: "",
    ...over,
  };
}

describe("encrypted share links", () => {
  it("round-trips a payload through the fragment", async () => {
    const p = payload();
    const fragment = await buildShareFragment(p, "correct horse");
    expect(fragment.startsWith("s=")).toBe(true);
    const out = await decryptShare(fragment, "correct horse");
    expect(out).not.toBe("expired");
    if (out === "expired") return;
    expect(out).toEqual(p);
  });

  it("rejects a wrong passphrase", async () => {
    const fragment = await buildShareFragment(payload(), "right-pass");
    await expect(decryptShare(fragment, "wrong-pass")).rejects.toThrow();
  });

  it("flags expired shares", async () => {
    const fragment = await buildShareFragment(
      payload({ exp: Date.now() - 1000 }),
      "pw",
    );
    expect(await decryptShare(fragment, "pw")).toBe("expired");
  });

  it("urlsafeToB64 restores web-safe base64 with padding", () => {
    expect(urlsafeToB64("ab-cd_efgh")).toBe("ab+cd/efgh==");
    expect(urlsafeToB64("ab")).toBe("ab==");
    expect(urlsafeToB64("abcd")).toBe("abcd");
  });

  it("shareExpiryKey maps hours to the right label keys", () => {
    expect(shareExpiryKey(1)).toBe("share.exp1h");
    expect(shareExpiryKey(24)).toBe("share.exp24h");
    expect(shareExpiryKey(72)).toBe("share.exp72h");
    expect(shareExpiryKey(168)).toBe("share.exp7d");
    expect(shareExpiryKey(12)).toBe("share.exp24h");
  });
});