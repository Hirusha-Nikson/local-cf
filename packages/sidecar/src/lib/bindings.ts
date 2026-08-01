import type { AnyBinding, StudioMeta } from "@local-cf/core/types";
import type { Env } from "../env.js";
import { fail } from "./http.js";

/**
 * The CLI parsed the wrangler config and owns the authoritative binding list,
 * so the sidecar asks the bridge for it rather than re-parsing anything.
 * Cached per isolate — the config cannot change without a restart.
 */
let metaCache: StudioMeta | undefined;

export async function getMeta(env: Env): Promise<StudioMeta> {
  if (metaCache) return metaCache;
  const response = await env.BRIDGE.fetch("http://bridge/meta");
  if (!response.ok) {
    fail(503, "Could not reach the local-cf host bridge.", await response.text());
  }
  metaCache = (await response.json()) as StudioMeta;
  return metaCache;
}

export async function findBinding<K extends AnyBinding["kind"]>(
  env: Env,
  kind: K,
  name: string,
): Promise<Extract<AnyBinding, { kind: K }>> {
  const meta = await getMeta(env);
  const match = meta.bindings.find((b) => b.kind === kind && b.binding === name);
  if (!match) {
    fail(404, `No ${kind} binding named "${name}" in your wrangler config.`);
  }
  return match as Extract<AnyBinding, { kind: K }>;
}

/**
 * Pull a live binding object off `env`.
 *
 * In Mode A this is the *same* object the user's worker holds, because the CLI
 * mirrored the binding ids — see SETUP.md §1.
 */
export function liveBinding<T>(env: Env, name: string, kind: string): T {
  const value = env[name];
  if (value === undefined || value === null) {
    fail(
      503,
      `Binding "${name}" is declared but not available in this runtime.`,
      `This usually means local-cf is running in attach mode, where ${kind} bindings cannot be re-created.`,
    );
  }
  return value as T;
}

export function isRemote(env: Env): boolean {
  return env.LOCAL_CF_MODE === "remote";
}
