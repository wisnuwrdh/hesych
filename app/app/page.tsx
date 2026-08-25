import { AppEntrance } from "./vault/Entrance";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Vault — Hesych",
  robots: { index: false, follow: true },
};
import "../app.css";

export default function AppRoutePage() {
  return <AppEntrance />;
}