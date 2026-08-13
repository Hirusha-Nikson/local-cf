import type { StudioMode } from "@local-cf/core/types";

/**
 * The sidecar's `env`.
 *
 * Binding variables are dynamic — they are whatever the user's wrangler config
 * declared, mirrored onto us by the CLI — so they arrive through the index
 * signature and are narrowed at lookup time in `bindings.ts`.
 */
export interface Env {
  LOCAL_CF_MODE: StudioMode;
  LOCAL_CF_HAS_USER_WORKER: boolean;
  /** When true every mutating route is refused — see `readOnlyGuard`. */
  LOCAL_CF_READ_ONLY: boolean;

  /** Escape hatch to the Node process (filesystem, logs, snapshots, audit). */
  BRIDGE: Fetcher;

  /** Present only in Mode A. Everything outside /__local-cf is forwarded here. */
  USER_WORKER?: Fetcher;

  /** Mode C credentials. */
  LOCAL_CF_ACCOUNT_ID?: string;
  LOCAL_CF_API_TOKEN?: string;

  [key: string]: unknown;
}

export interface Vars {
  requestId: string;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
