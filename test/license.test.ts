import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  revalidateIfNeeded,
  activate,
  isActive,
  getMeta,
} from "../lib/license";
import { STORAGE_KEYS } from "../lib/constants";

const KEY = "TEST-KEY-1234";
const DAY = 24 * 60 * 60 * 1000;

function seedActive(daysAgo: number): number {
  const at = Date.now() - daysAgo * DAY;
  localStorage.setItem(STORAGE_KEYS.deviceId, "abcd1234ef567890");
  localStorage.setItem(STORAGE_KEYS.license, KEY);
  localStorage.setItem(STORAGE_KEYS.licenseVerified, "1");
  localStorage.setItem(STORAGE_KEYS.licenseAt, String(at));
  localStorage.setItem(STORAGE_KEYS.licenseEmail, "buyer@example.com");
  return at;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("revalidateIfNeeded", () => {
  it("skips entirely when not activated", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await revalidateIfNeeded();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isActive()).toBe(false);
  });

  it("skips when the last check is under 30 days", async () => {
    seedActive(1);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await revalidateIfNeeded();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isActive()).toBe(true);
  });

  it("skips when offline", async () => {
    seedActive(40);
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await revalidateIfNeeded();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isActive()).toBe(true);
  });

  it("refreshes the timestamp on successful revalidation", async () => {
    const before = seedActive(40);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ devices: [] })),
    );
    await revalidateIfNeeded();
    expect(isActive()).toBe(true);
    const after = Number(localStorage.getItem(STORAGE_KEYS.licenseAt));
    expect(after).toBeGreaterThan(before);
    expect(getMeta()?.email).toBe("buyer@example.com");
  });

  it("deactivates when the server reports revocation", async () => {
    seedActive(40);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { valid: false, error: "This license has been refunded.", revoked: true },
          403,
        ),
      ),
    );
    await revalidateIfNeeded();
    expect(isActive()).toBe(false);
    expect(getMeta()).toBe(null);
    expect(localStorage.getItem(STORAGE_KEYS.license)).toBe(null);
    expect(localStorage.getItem(STORAGE_KEYS.licenseEmail)).toBe(null);
    expect(localStorage.getItem(STORAGE_KEYS.licenseAt)).toBe(null);
  });

  it("keeps state on non-revoked failures (rate limit / misconfig)", async () => {
    const at = seedActive(40);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { valid: false, error: "Too many attempts. Try again later." },
          429,
        ),
      ),
    );
    await revalidateIfNeeded();
    expect(isActive()).toBe(true);
    expect(Number(localStorage.getItem(STORAGE_KEYS.licenseAt))).toBe(at);
  });

  it("keeps state on network errors", async () => {
    const at = seedActive(40);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await revalidateIfNeeded();
    expect(isActive()).toBe(true);
    expect(Number(localStorage.getItem(STORAGE_KEYS.licenseAt))).toBe(at);
  });
});

describe("activate", () => {
  it("persists the license on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ valid: true, email: "x@y.z" })),
    );
    const res = await activate(KEY);
    expect(res.ok).toBe(true);
    expect(isActive()).toBe(true);
    expect(getMeta()?.email).toBe("x@y.z");
  });

  it("does not persist on server-confirmed revocation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ valid: false, error: "This license has been refunded.", revoked: true }),
      ),
    );
    const res = await activate(KEY);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("This license has been refunded.");
    expect(isActive()).toBe(false);
  });

  it("does not persist on device limit and surfaces the device list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          valid: false,
          error: "Device limit reached. Maximum 3 devices allowed. Remove a device first.",
          deviceLimitReached: true,
          devices: [{ device_id: "a", device_name: "Mac", activated_at: 1 }],
        }),
      ),
    );
    const res = await activate(KEY);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.deviceLimitReached).toBe(true);
      expect(res.devices?.[0].device_name).toBe("Mac");
    }
    expect(isActive()).toBe(false);
  });
});
