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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
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
