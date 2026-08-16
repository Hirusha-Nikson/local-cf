/**
 * One definition of where this site lives.
 *
 * Used by the root layout's `metadataBase`, the sitemap and robots.txt. Kept in
 * its own module because a base URL that disagrees between those three is the
 * kind of mistake that only shows up as a canonical pointing at the wrong host
 * weeks after deploy.
 */
export const SITE_URL = "https://www.local-cf.com";

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}
