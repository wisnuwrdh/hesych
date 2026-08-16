// Device identity helpers (client-only).

import { STORAGE_KEYS } from "./constants";

function randomHex(nBytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(nBytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEYS.deviceId);
  if (!id) {
    id = randomHex(16);
    localStorage.setItem(STORAGE_KEYS.deviceId, id);
  }
  return id;
}

/** Mirrors legacy getAutoDeviceName(): brand/model from the user agent. */
export function getDeviceName(userAgent?: string): string {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  let brand = "";
  if (/iPhone/i.test(ua)) brand = "iPhone";
  else if (/Android/i.test(ua)) {
    const m = ua.match(/; ([\w ]+?) Build\//i);
    brand = m ? m[1] : "Android";
  } else if (/Windows/i.test(ua)) brand = "Windows";
  else if (/Mac OS X/i.test(ua)) brand = "Mac";
  else if (/Linux/i.test(ua)) brand = "Linux";
  return brand || "Unknown Device";
}