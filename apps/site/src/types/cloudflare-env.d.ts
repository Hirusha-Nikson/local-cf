import type { KVNamespace } from "@cloudflare/workers-types";

/**
 * Bindings this Worker expects at runtime.
 *
 * OpenNext exposes these through `getCloudflareContext().env`. Everything here
 * is optional on purpose: `next dev` and `next build` both run outside workerd,
 * where no binding exists, and the testimonials code is written to degrade
 * rather than throw when that is the case.
 *
 * The KV type is imported rather than pulled in through tsconfig `types`,
 * because this app also declares the DOM lib and the two sets of globals
 * collide on `Request`, `Response` and friends. Sibling packages such as
 * packages/sidecar have no DOM lib and can take the global route.
 */
declare global {
  interface CloudflareEnv {
    /** Durable last-known-good copy of the published testimonials. */
    TESTIMONIALS_KV?: KVNamespace;
    /** Google Sheets "publish to web" CSV URL for the filtered Public tab. */
    TESTIMONIALS_CSV_URL?: string;
    /** Shared secret required to force a cache-bypassing refetch. */
    TESTIMONIALS_REFRESH_TOKEN?: string;
  }
}

export {};
