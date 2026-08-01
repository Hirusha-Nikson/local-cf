import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/**
 * Find the built dashboard.
 *
 * Published packages ship it at `dist/ui`; inside this repo it is still in the
 * dashboard workspace, so both are checked. `LOCAL_CF_UI_DIR` wins over both,
 * which is what makes `next dev` against a live sidecar possible.
 */
export function findUiDirectory(): string | null {
  const override = process.env["LOCAL_CF_UI_DIR"];
  if (override && existsSync(override)) return resolve(override);

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Packaged: packages/cli/dist/ui
    resolve(here, "ui"),
    resolve(here, "..", "dist", "ui"),
    // Workspace development
    resolve(here, "..", "..", "dashboard", "out"),
    resolve(here, "..", "..", "..", "dashboard", "out"),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) return candidate;
  }
  return null;
}

export interface StaticAsset {
  body: Buffer;
  contentType: string;
}

/**
 * Resolve a request path inside the static export.
 *
 * Next.js `output: "export"` with `trailingSlash: true` emits `page/index.html`,
 * so `/d1/`, `/d1` and `/d1/index.html` all have to land on the same file.
 */
export async function readStaticAsset(
  root: string,
  requestPath: string,
): Promise<StaticAsset | null> {
  const clean = decodeURIComponent(requestPath.split("?")[0] ?? "").replace(/^\/+/, "");

  const candidates =
    clean === "" || clean.endsWith("/")
      ? [`${clean}index.html`]
      : [clean, `${clean}/index.html`, `${clean}.html`];

  for (const candidate of candidates) {
    const absolute = resolve(root, candidate);
    // Reject anything that escapes the export directory.
    const rel = relative(root, absolute);
    if (rel.startsWith("..") || rel.startsWith(sep) || rel === "") continue;
    if (!existsSync(absolute)) continue;

    try {
      const body = await readFile(absolute);
      return {
        body,
        contentType: MIME_TYPES[extname(absolute).toLowerCase()] ?? "application/octet-stream",
      };
    } catch {
      continue;
    }
  }

  return null;
}
