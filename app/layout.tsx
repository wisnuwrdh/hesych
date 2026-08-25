import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hesych.com"),
  title: "Hesych - Local-First Password Manager, $9.99 Lifetime",
  description:
    "Hesych is a local-first password manager with AES-256-GCM encryption. Zero-knowledge, no subscription, one-time payment of $9.99. Your passwords never leave your device.",
  applicationName: "Hesych",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Hesych — Local-First Password Manager, $9.99 Lifetime",
    description:
      "AES-256-GCM encrypted password manager. One-time payment $9.99. No subscription, no cloud, your data never leaves your device.",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hesych — Local-First Password Manager, $9.99 Lifetime",
    description:
      "AES-256-GCM encrypted password manager. One-time payment $9.99. No subscription, no cloud.",
    images: ["/og-image.png"],
  },
};

// Register the PWA service worker (production only).
function SWRegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `if('serviceWorker' in navigator && location.protocol==='https:'){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
      }}
    />
  );
}

// Apply persisted theme before first paint to avoid a flash of the wrong theme.
function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{var t=localStorage.getItem('hesych_theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}`,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <SWRegister />
        <ThemeScript />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}