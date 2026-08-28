// POST /api/verify-license - license activation + device registry (max 3).
// 1:1 port of the legacy Vercel function (api/verify-license.js), with
// Supabase → D1 and Upstash → D1-backed rate limiter (in-memory fallback).

import { NextResponse } from "next/server";
import { d1Configured, d1Query } from "../../../lib/d1";

const MAX_DEVICES = 3;
const KEY_RE = /^[A-Za-z0-9-]{4,64}$/;
const DEVICE_ID_RE = /^[0-9a-f]{8,64}$/i;

const ALLOWED_ORIGINS = new Set([
  "https://hesych.pages.dev",
  "https://hesych.com",
  "https://www.hesych.com",
  "http://localhost:3000",
]);

interface DeviceRow {
  device_id: string;
  device_name: string;
  activated_at: number;
}

interface GumroadResult {
  valid: boolean;
  error?: string;
  email?: string;
  // True only when Gumroad authoritatively rejects the key (refunded,
  // chargebacked, disabled, deleted) - never on transient/server errors.
  revoked?: boolean;
}

// ── Rate limiter: 10 requests / 15 minutes / IP ──
// Authoritative count lives in D1 (atomic UPSERT), so it survives isolate
// restarts and is shared across PoDs. Falls back to the legacy in-memory
// limiter while D1 is unreachable or the rate_limits table is missing.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 10;

const memoryHits = new Map<string, { count: number; windowStart: number }>();

function memoryRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = memoryHits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    memoryHits.set(ip, { count: 1, windowStart: now });
    if (memoryHits.size > 10_000) {
      for (const [k, v] of memoryHits) if (now - v.windowStart > WINDOW_MS) memoryHits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_HITS;
}

async function isRateLimited(ip: string, now: number): Promise<boolean> {
  try {
    const rows = await d1Query<{ count: number }>(
      `INSERT INTO rate_limits (ip, count, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(ip) DO UPDATE SET
         count = CASE WHEN excluded.window_start - rate_limits.window_start > ?
                      THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN excluded.window_start - rate_limits.window_start > ?
                             THEN excluded.window_start ELSE rate_limits.window_start END
       RETURNING count`,
      [ip, now, WINDOW_MS, WINDOW_MS],
    );
    // Housekeeping: occasionally drop windows that expired long ago.
    if (Math.random() < 0.02) {
      void d1Query("DELETE FROM rate_limits WHERE window_start < ?", [
        now - 2 * WINDOW_MS,
      ]).catch(() => {});
    }
    return (rows[0]?.count ?? 1) > MAX_HITS;
  } catch {
    return memoryRateLimited(ip);
  }
}

function autoDeviceName(req: Request): string {
  const ua = req.headers.get("user-agent") || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android Phone" : "Android Tablet";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux PC";
  return "Unknown Device";
}

async function verifyGumroadKey(licenseKey: string): Promise<GumroadResult> {
  const productId = process.env.GUMROAD_PRODUCT_ID;
  if (!productId) {
    console.error("GUMROAD_PRODUCT_ID env var not set");
    return { valid: false, error: "Server misconfiguration" };
  }
  try {
    const body = new URLSearchParams();
    body.append("product_id", productId);
    body.append("license_key", licenseKey);
    body.append("increment_uses_count", "false");
    const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as {
      success?: boolean;
      purchase?: { email?: string; test?: boolean; refunded?: boolean; chargebacked?: boolean };
    };
    if (!data.success) return { valid: false, revoked: true };
    if (data.purchase?.test)
      return { valid: false, error: "Test purchases are not valid.", revoked: true };
    if (data.purchase?.refunded)
      return { valid: false, error: "This license has been refunded.", revoked: true };
    if (data.purchase?.chargebacked) return { valid: false, revoked: true };
    return { valid: true, email: data.purchase?.email ?? undefined };
  } catch (err) {
    console.error("Gumroad license verification error:", err);
    return { valid: false, error: "Verification failed" };
  }
}

export async function POST(req: Request) {
  // Origin allowlist (legacy M1 fix).
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const now = Date.now();
  if (await isRateLimited(ip, now)) {
    return NextResponse.json(
      { valid: false, error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: { license?: unknown; deviceId?: unknown; deviceName?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid JSON" }, { status: 400 });
  }

  const license = typeof body.license === "string" ? body.license.trim() : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!KEY_RE.test(license)) {
    return NextResponse.json({ valid: false, error: "Invalid license format" }, { status: 400 });
  }
  if (!d1Configured()) {
    return NextResponse.json({ valid: false, error: "Server misconfiguration" }, { status: 500 });
  }

  const getDevices = () =>
    d1Query<DeviceRow>(
      "SELECT device_id, device_name, activated_at FROM license_devices WHERE license_key = ? ORDER BY activated_at ASC",
      [license],
    );

  // ── list devices (only for an already-registered device) ──
  if (action === "list") {
    // Pemilik key berhak melihat daftar device-nya - termasuk dari device
    // ke-4 yang belum terdaftar (agar bisa remove satu lalu aktivasi).
    if (!DEVICE_ID_RE.test(deviceId)) {
      return NextResponse.json({ error: "Missing or invalid deviceId" }, { status: 400 });
    }
    const gum = await verifyGumroadKey(license);
    if (!gum.valid) return NextResponse.json(gum, { status: 403 });
    const devices = await getDevices();
    return NextResponse.json({ devices });
  }

  // ── remove a device (Gumroad validity still enforced) ──
  if (action === "remove") {
    const removeId = (body as { removeDeviceId?: unknown }).removeDeviceId;
    if (typeof removeId !== "string" || !DEVICE_ID_RE.test(removeId)) {
      return NextResponse.json({ error: "Missing or invalid removeDeviceId" }, { status: 400 });
    }
    if (!DEVICE_ID_RE.test(deviceId)) {
      return NextResponse.json({ error: "Missing or invalid deviceId" }, { status: 400 });
    }
    const gum = await verifyGumroadKey(license);
    if (!gum.valid) return NextResponse.json(gum, { status: 403 });
    await d1Query(
      "DELETE FROM license_devices WHERE license_key = ? AND device_id = ?",
      [license, removeId],
    );
    return NextResponse.json({ success: true });
  }

  // ── default: verify + activate device ──
  if (!DEVICE_ID_RE.test(deviceId)) {
    return NextResponse.json(
      { valid: false, error: "Missing or invalid device ID" },
      { status: 400 },
    );
  }

  const gum = await verifyGumroadKey(license);
  if (!gum.valid) return NextResponse.json(gum);

  const devices = await getDevices();
  if (devices.some((d) => d.device_id === deviceId)) {
    return NextResponse.json({ valid: true, email: gum.email });
  }

  if (devices.length >= MAX_DEVICES) {
    return NextResponse.json({
      valid: false,
      error: `Device limit reached. Maximum ${MAX_DEVICES} devices allowed. Remove a device first.`,
      deviceLimitReached: true,
      devices,
    });
  }

  const rawName = typeof body.deviceName === "string" ? body.deviceName : "";
  const safeName =
    rawName.slice(0, 64).replace(/[^\w\s(). -]/g, "").trim() || autoDeviceName(req);

  await d1Query(
    "INSERT INTO license_devices (license_key, device_id, device_name, activated_at) VALUES (?, ?, ?, ?)",
    [license, deviceId, safeName, Date.now()],
  );
  return NextResponse.json({ valid: true, email: gum.email });
}
