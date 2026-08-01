import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext turns the Next.js build into a Cloudflare Worker, keeping SSR,
 * middleware and ISR — the reason SETUP.md §5a rules out a plain `next export`
 * for the public site even though the bundled dashboard uses one.
 *
 * The incremental cache override is intentionally left at its default (in-worker
 * memory). Switching to `r2IncrementalCache` requires creating an R2 bucket
 * first, so it is a deployment decision, not a build-time one — see
 * docs/PUBLISHING.md.
 */
export default defineCloudflareConfig();
