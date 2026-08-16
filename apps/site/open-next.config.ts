import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext turns the Next.js build into a Cloudflare Worker, keeping SSR,
 * middleware and ISR — the reason SETUP.md §5a rules out a plain `next export`
 * for the public site even though the bundled dashboard uses one.
 *
 * The incremental cache override is intentionally left at its default (in-worker
 * memory). Switching to `r2IncrementalCache` requires creating an R2 bucket and
 * binding it as NEXT_INC_CACHE_R2_BUCKET first, so it is a deployment decision
 * rather than a build-time one.
 *
 * Because that default cache dies with the isolate, anything that needs to
 * survive a cold start cannot rely on ISR to hold it — which is why the
 * testimonials keep their own copy in KV. See src/lib/testimonials.ts.
 */
export default defineCloudflareConfig();
