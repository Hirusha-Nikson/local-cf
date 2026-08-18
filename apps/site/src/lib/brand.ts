/**
 * Brand values, mirrored from packages/ui/src/theme.css for the places that
 * cannot see CSS — the web app manifest, and anything else that needs a colour
 * as a literal rather than a custom property.
 *
 * This module used to also read `packages/cli/logo.png` off disk and hand it to
 * Satori as a data URI, so the favicon, the apple icon and the OG card could be
 * generated at build time. That is gone, and the reason is worth keeping:
 * `readFileSync` resolved fine locally and returned nothing inside GitHub
 * Actions, and because a missing logo degraded to a "cf" monogram instead of
 * failing the build, a monogram shipped to production on every one of those
 * images without a single red check. All four are static files now — see
 * src/app/{favicon.ico,icon.png,icon1.png,apple-icon.png,opengraph-image.png}.
 */
export const BRAND = {
  orange: "#f6821f",
  ink: "#0b0b0b",
  paper: "#ffffff",
} as const;
