import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Web app manifest.
 *
 * Not because local-cf wants to be an installable app — it is documentation —
 * but because Android Chrome reads `theme_color` and the icon list from here
 * when a page is pinned or shared, and without it both fall back to defaults
 * that look unfinished.
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "local-cf",
    short_name: "local-cf",
    description:
      "View and edit your local D1 tables, KV keys and R2 objects while wrangler dev runs.",
    start_url: "/",
    display: "browser",
    background_color: BRAND.ink,
    theme_color: BRAND.ink,
    icons: [
      { src: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
