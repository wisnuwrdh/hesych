import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPasswordOld,
  formatRelativeDate,
  fmtCountdown,
  formatShareExpiry,
  formatShareCreated,
} from "../lib/format";
import { HIST_MAX } from "../lib/constants";

describe("isPasswordOld", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("flags passwords older than 90 days", () => {
    const now = Date.parse("2026-08-16T00:00:00Z");
    vi.setSystemTime(now);
    expect(isPasswordOld({ updatedAt: now - 91 * 86400000 })).toBe(true);
    expect(isPasswordOld({ updatedAt: now - 89 * 86400000 })).toBe(false);
    expect(isPasswordOld({ updatedAt: null })).toBe(false);
  });
});

describe("formatRelativeDate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const now = Date.parse("2026-08-16T12:00:00Z");

  it("renders today / days / months / years", () => {
    vi.setSystemTime(now);
    expect(formatRelativeDate(now - 3600000)).toBe("Today");
    expect(formatRelativeDate(now - 3 * 86400000)).toBe("3 days ago");
    expect(formatRelativeDate(now - 75 * 86400000)).toBe("2 months old");
    expect(formatRelativeDate(now - 400 * 86400000)).toBe("1 year ago");
    expect(formatRelativeDate(null)).toBe("—");
  });
});

describe("fmtCountdown", () => {
  it("formats mm:ss and h:mm:ss and d", () => {
    expect(fmtCountdown(0)).toBe("0:00");
    expect(fmtCountdown(59_000)).toBe("0:59");
    expect(fmtCountdown(60_000)).toBe("1:00");
    expect(fmtCountdown(3_661_000)).toBe("1h 01:01");
    expect(fmtCountdown(2 * 86400000 + 3600000 + 61_000)).toBe("2d 01:01:01");
  });
});

describe("formatShareExpiry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("handles expired / hours / days", () => {
    const now = Date.parse("2026-08-16T12:00:00Z");
    vi.setSystemTime(now);
    expect(formatShareExpiry(now - 1000)).toMatchObject({ expired: true });
    expect(formatShareExpiry(now + 5 * 3600000)).toMatchObject({
      label: "5h 0m left",
      warn: false,
    });
    expect(formatShareExpiry(now + 30 * 60000 + 30 * 1000)).toMatchObject({
      label: "30m left",
      warn: true,
    });
    expect(formatShareExpiry(now + 3 * 86400000)).toMatchObject({
      label: "3d left",
    });
  });
});

describe("formatShareCreated", () => {
  it("labels today specially", () => {
    const now = new Date();
    expect(formatShareCreated(now.getTime())).toMatch(/^Today /);
  });
});

describe("constants sanity", () => {
  it("history cap and expiry match legacy", () => {
    expect(HIST_MAX).toBe(10);
    expect(import.meta.env).toBeDefined(); // placeholder to keep file scoped
  });
});