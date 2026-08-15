import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import rehypeSlug from "rehype-slug";

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

const withMDX = createMDX({
  options: {
    /*
     * Gives every heading a stable `id`, which buys three things at once:
     * deep links into the docs, anchor buttons rendered by the heading
     * components in mdx-components.tsx, and the ids the table of contents
     * scroll-spies against. Done at build time, so it costs no client bytes.
     */
    rehypePlugins: [rehypeSlug],
  },
});

export default withMDX(nextConfig);
