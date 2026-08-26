import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Vault - Hesych",
  robots: { index: false, follow: false },
};

export default function ShareLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
