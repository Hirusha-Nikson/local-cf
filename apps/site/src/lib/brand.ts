import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The local-cf mark, as a data URI, for build-time image generation.
 *
 * Read from `packages/cli/logo.png` rather than copied into this app so there
 * is one logo file in the repo and the generated icons cannot drift from it.
 * Only ever called during `next build` — Satori needs the bytes inline, and
 * the Worker has no filesystem to read them from at request time.
 *
 * Returns null rather than throwing: an icon is decorative, and a missing file
 * should degrade to the monogram fallback, not fail a deploy.
 */
export function logoDataUri(): string | null {
  try {
    // cwd during `next build` is apps/site; the logo lives two levels up.
    const file = join(process.cwd(), "..", "..", "packages", "cli", "logo.png");
    return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  } catch {
    return null;
  }
}

/* Brand values, mirrored from packages/ui/src/theme.css for generators that
 * cannot see CSS (Satori) or must be a literal (theme-color). */
export const BRAND = {
  orange: "#f6821f",
  ink: "#0b0b0b",
  paper: "#ffffff",
} as const;
