"use client";

// Detects a newer deployment by comparing build-info.json against the
// build timestamp baked into this bundle at build time.
import { useEffect, useState } from "react";

const BAKED = process.env.NEXT_PUBLIC_BUILD_TS ?? "";

export function useUpdateAvailable(): boolean {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!BAKED) return;
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/build-info.json", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { ts?: number };
        if (!cancelled && typeof j.ts === "number" && j.ts > Number(BAKED)) {
          setStale(true);
        }
      } catch {
        // offline / not deployed yet — ignore
      }
    }

    void check();
    const iv = setInterval(check, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      cancelled = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  return stale;
}
