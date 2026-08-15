import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";

/**
 * Build the docs search index.
 *
 * Emitted as a committed module rather than read at request time: the site is
 * deployed to Cloudflare Workers by OpenNext, where there is no filesystem to
 * read `.mdx` off. Generating it here means search is a plain import that gets
 * bundled, with nothing to go wrong at the edge.
 *
 * Slugs come from `github-slugger`, which is exactly what rehype-slug uses on
 * the same headings — so every result's `#anchor` is guaranteed to resolve to a
 * heading that actually exists in the rendered page.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = join(HERE, "..", "src", "app", "docs");
const OUT = join(HERE, "..", "src", "lib", "search-index.json");

/** Title of each docs route, mirroring DOC_SECTIONS in components/docs-nav.tsx. */
const PAGE_TITLES = {
  "/docs": "Introduction",
  "/docs/getting-started": "Getting started",
  "/docs/modes": "Modes A / B / C",
  "/docs/architecture": "Architecture",
};

async function findMdx(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findMdx(full)));
    else if (entry.name.endsWith(".mdx")) found.push(full);
  }
  return found;
}

/** Route for a `page.mdx`, e.g. .../docs/modes/page.mdx -> /docs/modes */
function routeFor(file) {
  const rel = relative(DOCS, file).replace(/\\/g, "/").replace(/\/?page\.mdx$/, "");
  return rel ? `/docs/${rel}` : "/docs";
}

/**
 * Strip everything that is not prose.
 *
 * Fenced blocks go first and for a specific reason: a `#` at the start of a
 * line inside a bash fence is a shell comment, and modes/page.mdx has one.
 * Removing fences before splitting on headings keeps it out of the index.
 */
function toPlainText(markdown) {
  return markdown
    .replace(/`[^`\n]*`/g, (match) => match.slice(1, -1))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const entries = [];

for (const file of (await findMdx(DOCS)).sort()) {
  const route = routeFor(file);
  const page = PAGE_TITLES[route] ?? route;
  const slugger = new GithubSlugger();

  const source = (await readFile(file, "utf8")).replace(/```[\s\S]*?```/g, "\n");

  // Split into [heading, body] pairs; text before the first heading is skipped.
  const parts = source.split(/^(#{1,3})\s+(.+)$/gm);

  for (let i = 1; i < parts.length; i += 3) {
    const level = parts[i].length;
    const rawHeading = parts[i + 1].trim();
    const heading = toPlainText(rawHeading);
    const body = toPlainText(parts[i + 2] ?? "");

    // The slugger must see every heading in order, including h1, so that its
    // duplicate-suffix counter stays in step with rehype-slug.
    const id = slugger.slug(rawHeading.replace(/`/g, ""));
    if (level === 1) continue;

    entries.push({
      path: route,
      page,
      heading,
      id,
      // Enough to rank and preview; the whole section would bloat the bundle.
      text: body.slice(0, 320),
    });
  }
}

await writeFile(OUT, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
process.stdout.write(
  `  search index -> ${relative(join(HERE, ".."), OUT)} (${entries.length} sections)\n`,
);
