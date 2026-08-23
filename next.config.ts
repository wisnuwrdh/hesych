import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The vault uses plain <img> tags (no next/image), so the sharp native
  // module is dead weight — excluding it keeps the OpenNext server bundle
  // free of unresolvable `.node` binaries on adapter 1.14.x.
  images: { unoptimized: true },
};

export default nextConfig;
