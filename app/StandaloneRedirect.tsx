"use client";

import { useEffect } from "react";

/**
 * Mirrors the legacy landing script: when installed as a PWA and opened from
 * the home screen (standalone), bounce straight into the app shell.
 */
export default function StandaloneRedirect() {
  useEffect(() => {
    const standalone = (window.navigator as { standalone?: boolean }).standalone;
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      standalone === true
    ) {
      window.location.replace("/app");
    }
  }, []);
  return null;
}