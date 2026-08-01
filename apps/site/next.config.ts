import createMDX from "@next/mdx";
import type { NextConfig } from "next";

/**
 * The public site: marketing, docs and a hosted copy of the dashboard.
 *
 * Unlike the bundled dashboard this is a full Next.js app (SSR + middleware +
 * ISR available), deployed to Workers by OpenNext — see SETUP.md §5a for why
 * static export is the wrong target here.
 */
const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactStrictMode: true,
  // The dashboard components live in a source-only workspace package.
  transpilePackages: ["@local-cf/ui"],
  eslint: { ignoreDuringBuilds: true },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
