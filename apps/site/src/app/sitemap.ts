import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * The sitemap, discovered from the filesystem rather than hand-listed.
 *
 * A hand-written array is the version that goes stale: a page gets added, the
 * list does not, and nothing fails — the page is simply never submitted. So
 * this walks `src/app` for route files and derives the URLs, which means adding
 * a `page.mdx` anywhere is all it takes to appear here.
 *
 * `force-static` is not decorative. This module uses `node:fs`, and the site is
 * deployed to Workers by OpenNext where there is no filesystem to read — so the
 * work has to happen at build time and ship as a prerendered asset. Verify with
 * `next build`: the route must be listed as ○ (Static), never ƒ (Dynamic).
 */
export const dynamic = "force-static";

/** Route files Next treats as a page. Layouts and templates are not routes. */
const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx|md)$/;

const APP_DIR = join(process.cwd(), "src", "app");

/**
 * Segments that exist on disk but not in the URL, or that must never be listed.
 *
 * - `(group)`  route groups; organisational, contribute nothing to the path
 * - `@slot`    parallel routes; rendered into a layout, not addressable
 * - `_private` opted out of routing by Next's own convention
 * - `[param]`  dynamic; cannot be enumerated without knowing the data
 * - `api`      returns JSON, has no business in a sitemap
 */
function segmentKind(segment: string): "skip" | "omit" | "keep" {
  if (segment.startsWith("(") && segment.endsWith(")")) return "omit";
  if (segment.startsWith("@")) return "skip";
  if (segment.startsWith("_")) return "skip";
  if (segment.includes("[")) return "skip";
  if (segment === "api") return "skip";
  return "keep";
}

function findRoutes(dir: string, acc: { route: string; file: string }[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (segmentKind(entry.name) === "skip") continue;
      findRoutes(full, acc);
      continue;
    }

    if (!PAGE_FILE.test(entry.name)) continue;

    const segments = relative(APP_DIR, dir)
      .split(sep)
      .filter((segment) => segment !== "" && segmentKind(segment) === "keep");

    acc.push({ route: `/${segments.join("/")}`.replace(/\/$/, "") || "/", file: full });
  }

  return acc;
}

/**
 * When this page's content last changed.
 *
 * Deliberately the git commit date and not the file's mtime: a CI runner clones
 * the repo fresh, so every mtime is the checkout time and every page would
 * claim to have changed on the day of the build. Google discards `lastmod` it
 * finds untrustworthy, so a wrong date is worse than none — hence the undefined
 * fallback when git is unavailable.
 */
function lastModified(file: string): Date | undefined {
  try {
    const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return iso ? new Date(iso) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Relative weight within the site. Google treats `priority` as a hint at most,
 * but it costs nothing and states the intended shape: the landing page first,
 * then the docs people arrive for, then everything else.
 */
function priorityFor(route: string): number {
  if (route === "/") return 1;
  if (route === "/docs") return 0.9;
  if (route.startsWith("/docs/")) return 0.8;
  if (route === "/privacy") return 0.3;
  return 0.5;
}

function changeFrequency(route: string): "weekly" | "monthly" | "yearly" {
  if (route === "/" || route.startsWith("/docs")) return "weekly";
  if (route === "/privacy") return "yearly";
  return "monthly";
}

export default function sitemap(): MetadataRoute.Sitemap {
  return findRoutes(APP_DIR)
    .sort((a, b) => a.route.localeCompare(b.route))
    .map(({ route, file }) => {
      const changed = lastModified(file);
      return {
        url: absoluteUrl(route),
        ...(changed ? { lastModified: changed } : {}),
        changeFrequency: changeFrequency(route),
        priority: priorityFor(route),
      };
    });
}
