import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/site";

/**
 * Generates /robots.txt at build time.
 *
 * A `robots.ts` rather than a file in `public/`: this way the sitemap URL is
 * derived from the same constant the rest of the metadata uses, so it cannot
 * drift to a stale host, and Next serves it at the canonical path for us.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /*
         * `/api/` returns JSON with `cache-control: no-store` and nothing worth
         * indexing. Disallowing it is not a security control — the route is
         * still public, it is just noise in an index.
         */
        disallow: ["/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
