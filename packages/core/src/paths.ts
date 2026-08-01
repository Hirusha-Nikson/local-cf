import { resolve } from "node:path";

/**
 * Wrangler's on-disk layout, replicated exactly.
 *
 * Mode B (`local-cf attach`) only works because we point Miniflare at the very
 * same directories `wrangler dev` uses, so these names are load-bearing — do
 * not "tidy" them.
 */
export interface PersistPaths {
  root: string;
  kv: string;
  d1: string;
  r2: string;
  durableObjects: string;
  cache: string;
  workflows: string;
}

/** `<projectRoot>/.wrangler/state/v3/...` unless a custom root is given. */
export function persistPaths(projectRoot: string, persistTo?: string): PersistPaths {
  const root = persistTo
    ? resolve(persistTo, "v3")
    : resolve(projectRoot, ".wrangler", "state", "v3");
  return {
    root,
    kv: resolve(root, "kv"),
    d1: resolve(root, "d1"),
    r2: resolve(root, "r2"),
    durableObjects: resolve(root, "do"),
    cache: resolve(root, "cache"),
    workflows: resolve(root, "workflows"),
  };
}

/** Where local-cf keeps its own state (remote tokens, snapshots, audit log). */
export function studioStatePaths(projectRoot: string) {
  const root = resolve(projectRoot, ".local-cf");
  return {
    root,
    snapshots: resolve(root, "snapshots"),
    auditLog: resolve(root, "audit.jsonl"),
    config: resolve(root, "config.json"),
  };
}
