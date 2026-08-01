import type { NextConfig } from "next";

/**
 * The offline dashboard bundled into the npm package.
 *
 * `output: "export"` is what makes local-cf work with no hosted domain at all
 * (SETUP.md §2/§3) — the whole UI is static files the sidecar serves from disk.
 * `basePath` matches the URL the sidecar mounts it at so asset links resolve.
 */
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/__local-cf/ui",
  trailingSlash: true,
  reactStrictMode: true,
  // Shared source-only workspace package; Next must compile its TSX.
  transpilePackages: ["@local-cf/ui"],
  images: {
    // No image optimiser exists in a static export served by workerd.
    unoptimized: true,
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
