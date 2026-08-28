import type { NextConfig } from "next";

// Baked into the client bundle at build time; compared against
// build-info.json by the version-check hook to detect new deployments.
process.env.NEXT_PUBLIC_BUILD_TS = String(Date.now());

const nextConfig: NextConfig = {
  // The vault uses plain <img> tags (no next/image), so the sharp native
  // module is dead weight — excluding it keeps the OpenNext server bundle
  // free of unresolvable `.node` binaries on adapter 1.14.x.
  images: { unoptimized: true },
  // Documents must always revalidate: Pages keeps every deployment's assets
  // addressable, so a long CDN/browser cache would pin users to stale HTML.
  // Security headers harden the delivery of the password-manager frontend:
  // 'unsafe-inline' in script/style-src is required by Next.js inline
  // bootstrap and React style attributes — external injection is still
  // blocked. If the OpenNext adapter drops headers() for SSR routes,
  // fall back to a Pages-native public/_headers file.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.pwnedpasswords.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self'; upgrade-insecure-requests",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
