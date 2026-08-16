import { execFile } from "node:child_process";
import { readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/**
 * Build the route manifest the sitemap is generated from.
 *
 * Same reasoning as build-search-index.mjs, learned the hard way: the site is
 * deployed to Cloudflare Workers by OpenNext, where there is no filesystem to
 * walk and no `git` binary to shell out to. Doing either inside `sitemap.ts`
 * built fine and even reported `○ Static` under `next build`, then returned a
 * 500 on the deployed Worker — OpenNext invokes the function at request time,
 * where both are gone.
 *
 * So the walk and the `git log` happen here, at build time, and ship as a
 * committed JSON module that `sitemap.ts` simply imports.
 */

const run = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..", "src", "app");
const OUT = join(HERE, "..", "src", "lib", "routes.json");

/** Route files Next treats as a page. Layouts and templates are not routes. */
const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx|md)$/;

/**
 * Segments that exist on disk but not in the URL, or that must never be listed.
 *
 * - `(group)`  route groups; organisational, contribute nothing to the path
 * - `@slot`    parallel routes; rendered into a layout, not addressable
 * - `_private` opted out of routing by Next's own convention
 * - `[param]`  dynamic; cannot be enumerated without knowing the data
 * - `api`      returns JSON, has no business in a sitemap
 */
function segmentKind(segment) {
  if (segment.startsWith("(") && segment.endsWith(")")) return "omit";
  if (segment.startsWith("@")) return "skip";
  if (segment.startsWith("_")) return "skip";
  if (segment.includes("[")) return "skip";
  if (segment === "api") return "skip";
  return "keep";
}

async function findRoutes(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (segmentKind(entry.name) === "skip") continue;
      await findRoutes(full, acc);
      continue;
    }

    if (!PAGE_FILE.test(entry.name)) continue;

    const segments = relative(APP, dir)
      .split(sep)
      .filter((segment) => segment !== "" && segmentKind(segment) === "keep");

    acc.push({ route: `/${segments.join("/")}`.replace(/\/$/, "") || "/", file: full });
  }

  return acc;
}

/**
 * When this page's content last changed.
 *
 * The git commit date, not the file's mtime: CI clones fresh, so every mtime is
 * the checkout time and every page would claim to have changed on the day of
 * the build. Google discards `lastmod` it finds untrustworthy, so a wrong date
 * is worse than none — hence the null when git cannot answer.
 *
 * Requires full history. `.github/workflows/deploy-site.yml` sets
 * `fetch-depth: 0` for exactly this reason; under the default depth-1 clone git
 * attributes every file to the boundary commit and all dates come back equal.
 */
async function lastModified(file) {
  try {
    const { stdout } = await run("git", ["log", "-1", "--format=%cI", "--", file]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

const found = await findRoutes(APP);

const routes = (
  await Promise.all(
    found.map(async ({ route, file }) => ({
      route,
      lastModified: await lastModified(file),
    })),
  )
).sort((a, b) => a.route.localeCompare(b.route));

await writeFile(OUT, `${JSON.stringify(routes, null, 2)}\n`, "utf8");

const dated = routes.filter((entry) => entry.lastModified !== null).length;
process.stdout.write(
  `  routes -> src/lib/routes.json (${routes.length} routes, ${dated} dated)\n`,
);
