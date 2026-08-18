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
    /*
     * Referenced from `public/` with plain, unhashed paths.
     *
     * The icons in `src/app` are metadata file routes and Next serves them at
     * a cache-busted `?<hash>` URL that changes whenever the file does. A
     * manifest is fetched and cached by the OS separately from the page, so
     * pointing it at those would leave installed launchers holding a URL that
     * no longer resolves. These two are ordinary static assets instead.
     *
     * 192 and 512 are the pair Android asks for: the first for the launcher
     * icon, the second for the splash screen.
     */
    icons: [
      { src: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
