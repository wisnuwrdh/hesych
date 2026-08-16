"use client";

import { useSyncExternalStore } from "react";
import { VaultApp } from "./VaultApp";

const emptySubscribe = () => () => {};

/**
 * Client-only mount gate. The vault touches localStorage/sessionStorage (and
 * WebCrypto key derivation on unlock) which do not exist during Next.js SSR
 * prerendering, so the whole subtree is mounted exclusively in the browser.
 */
export function AppEntrance() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return <VaultApp />;
}