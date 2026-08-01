/**
 * Dependency-free constants.
 *
 * Kept in their own module (and their own package export) so the sidecar can
 * import them inside workerd without dragging `node:fs` / `node:path` along
 * from the rest of core.
 */

/** The URL prefix everything local-cf serves lives under. */
export const STUDIO_PREFIX = "/__local-cf";
export const STUDIO_API_PREFIX = `${STUDIO_PREFIX}/api`;
export const STUDIO_UI_PREFIX = `${STUDIO_PREFIX}/ui`;

export const DEFAULT_PORT = 8787;
export const DEFAULT_HOST = "127.0.0.1";
