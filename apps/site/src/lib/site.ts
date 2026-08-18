/**
 * One definition of where this site lives.
 *
 * Used by the root layout's `metadataBase`, the sitemap and robots.txt. Kept in
 * its own module because a base URL that disagrees between those three is the
 * kind of mistake that only shows up as a canonical pointing at the wrong host
 * weeks after deploy.
 */
export const SITE_URL = "https://www.local-cf.com";

/**
 * The one-line description of the whole product.
 *
 * Written for the results page, not for us. "local-first studio" is how we
 * describe local-cf; it is not what anyone types into a search box. The words
 * people actually use for this problem are the product names (D1, KV, R2) and
 * the tools they already run (wrangler, Miniflare), so those lead here. Kept
 * under ~155 characters, which is roughly where Google starts truncating.
 *
 * Lives here rather than in the root layout because the JSON-LD graph needs the
 * same sentence, and a description that disagrees with the meta tag is exactly
 * the sort of mismatch structured-data validators flag.
 */
export const SITE_DESCRIPTION =
  "View and edit your local D1 tables, KV keys and R2 objects while wrangler dev runs. A local dashboard for Cloudflare Workers — offline, no account needed.";

/** Where the source lives — used by the footer, the docs and the JSON-LD. */
export const GITHUB_URL = "https://github.com/Hirusha-Nikson/local-cf";

/** The published package, which is how almost everyone actually gets it. */
export const NPM_URL = "https://www.npmjs.com/package/local-cf";

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}
