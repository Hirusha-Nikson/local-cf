import { dirname, resolve } from "node:path";
import type { Json, MiniflareOptions, Request as MiniflareRequest, WorkerOptions } from "miniflare";
import { persistPaths } from "./paths.js";
import type { NormalizedWranglerConfig, StudioMode } from "./types.js";

/**
 * Everything in this file exists to serve one idea from SETUP.md §1:
 *
 *   The sidecar must declare bindings with the *same underlying resource
 *   identity* as the user's worker (same database_id / namespace_id /
 *   bucket_name / DO class, same persist path). When it does, Miniflare hands
 *   both workers the same gateway objects instead of two copies.
 *
 * So `mirrorBindings()` below deliberately copies identifiers verbatim.
 */

/**
 * Node-side handler exposed to the sidecar as a service binding.
 *
 * Miniflare hands us its own undici-based Request/Response classes rather than
 * the global ones, hence the explicit import.
 */
export type BridgeHandler = (
  request: MiniflareRequest,
) => Promise<Response> | Response;

export interface BuildOptions {
  config: NormalizedWranglerConfig;
  mode: StudioMode;
  /** Bundled sidecar worker source (ESM). */
  sidecarScript: string;
  /** Bundled user worker source (ESM). Omitted in attach/remote mode. */
  userScript?: string;
  /** Used by Miniflare to resolve relative module paths in the user bundle. */
  userScriptPath?: string;
  /** Escape hatch to the Node process: filesystem, logs, snapshots. */
  bridge: BridgeHandler;
  port: number;
  host?: string;
  persistTo?: string;
  /** Extra plain-text vars handed to the sidecar only. */
  sidecarVars?: Record<string, string>;
  inspectorPort?: number;
  /**
   * Refuse every mutating API route.
   *
   * Set in attach mode, where another dev server owns the same persist
   * directory: two workerd processes writing one set of SQLite files is not a
   * supported configuration and has corrupted real projects.
   */
  readOnly?: boolean;
}

export const SIDECAR_WORKER_NAME = "__local-cf-sidecar";

/**
 * Copy the user's binding declarations onto another worker's options.
 *
 * `includeDurableObjects` is false in attach mode: there is no user worker in
 * our runtime, so there is no class for a DO binding to point at.
 */
function mirrorBindings(
  config: NormalizedWranglerConfig,
  options: { durableObjectScriptName?: string },
): Pick<
  WorkerOptions,
  "kvNamespaces" | "d1Databases" | "r2Buckets" | "durableObjects" | "queueProducers"
> {
  const kvNamespaces: Record<string, string> = {};
  for (const binding of config.kv) kvNamespaces[binding.binding] = binding.namespaceId;

  const d1Databases: Record<string, string> = {};
  for (const binding of config.d1) d1Databases[binding.binding] = binding.databaseId;

  const r2Buckets: Record<string, string> = {};
  for (const binding of config.r2) r2Buckets[binding.binding] = binding.bucketName;

  const queueProducers: Record<string, string> = {};
  for (const binding of config.queueProducers) {
    queueProducers[binding.binding] = binding.queueName;
  }

  const durableObjects: WorkerOptions["durableObjects"] = {};
  if (options.durableObjectScriptName !== undefined) {
    for (const binding of config.durableObjects) {
      durableObjects![binding.binding] = {
        className: binding.className,
        // Point at the worker that actually defines the class. This is the
        // cross-worker DO namespace binding SETUP.md §6 flagged as needing a
        // spike — Miniflare supports it directly via `scriptName`.
        scriptName: binding.scriptName ?? options.durableObjectScriptName,
        ...(binding.useSQLite ? { useSQLite: true } : {}),
      };
    }
  }

  return { kvNamespaces, d1Databases, r2Buckets, durableObjects, queueProducers };
}

/** The user's worker, exactly as their wrangler config describes it. */
export function buildUserWorkerOptions(
  config: NormalizedWranglerConfig,
  script: string,
  scriptPath?: string,
): WorkerOptions {
  const durableObjects: WorkerOptions["durableObjects"] = {};
  for (const binding of config.durableObjects) {
    durableObjects[binding.binding] = {
      className: binding.className,
      ...(binding.scriptName ? { scriptName: binding.scriptName } : {}),
      ...(binding.useSQLite ? { useSQLite: true } : {}),
    };
  }

  const mirrored = mirrorBindings(config, {});

  const queueConsumers: Record<string, { maxBatchSize?: number; deadLetterQueue?: string }> = {};
  for (const consumer of config.queueConsumers) {
    queueConsumers[consumer.queueName] = {
      ...(consumer.maxBatchSize !== undefined ? { maxBatchSize: consumer.maxBatchSize } : {}),
      ...(consumer.deadLetterQueue ? { deadLetterQueue: consumer.deadLetterQueue } : {}),
    };
  }

  /**
   * One explicit module rather than `modules: true`.
   *
   * `modules: true` makes Miniflare walk the script itself to collect its
   * dependencies, and that collector rejects any `import()` whose specifier it
   * cannot resolve statically. The script we hand it is already a
   * self-contained esbuild bundle, so there is nothing left to collect — a
   * dynamic specifier surviving inside it belongs to a bundled dependency and
   * must reach workerd untouched instead of failing the whole startup.
   */
  const modulePath = resolve(scriptPath ?? resolve(config.projectRoot, "worker.js"));

  return {
    name: config.name,
    modules: [{ type: "ESModule", path: modulePath, contents: script }],
    modulesRoot: dirname(modulePath),
    ...(config.compatibilityDate ? { compatibilityDate: config.compatibilityDate } : {}),
    compatibilityFlags: config.compatibilityFlags,
    bindings: config.vars as Record<string, Json>,
    kvNamespaces: mirrored.kvNamespaces,
    d1Databases: mirrored.d1Databases,
    r2Buckets: mirrored.r2Buckets,
    queueProducers: mirrored.queueProducers,
    queueConsumers,
    durableObjects,
  };
}

/**
 * The sidecar. It is the *entry* worker (workers[0]) so that a single port can
 * serve both the dashboard and the user's app: anything outside `/__local-cf`
 * is forwarded to the user worker over a service binding.
 */
export function buildSidecarWorkerOptions(options: BuildOptions): WorkerOptions {
  const { config, mode, sidecarScript, bridge, userScript } = options;

  // In attach/remote mode there is no user worker in this runtime, so DO
  // bindings have nothing to point at — see SETUP.md §1, Mode B caveats.
  const hasUserWorker = mode === "own" && userScript !== undefined;

  const mirrored =
    mode === "remote"
      ? {
          kvNamespaces: {},
          d1Databases: {},
          r2Buckets: {},
          durableObjects: {},
          queueProducers: {},
        }
      : mirrorBindings(config, {
          ...(hasUserWorker ? { durableObjectScriptName: config.name } : {}),
        });

  const serviceBindings: WorkerOptions["serviceBindings"] = {
    // Node escape hatch: filesystem, logs, snapshots, audit log.
    BRIDGE: (request: MiniflareRequest) => bridge(request) as never,
  };
  if (hasUserWorker) {
    serviceBindings["USER_WORKER"] = config.name;
  }

  return {
    name: SIDECAR_WORKER_NAME,
    modules: true,
    script: sidecarScript,
    compatibilityDate: "2024-11-01",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      LOCAL_CF_MODE: mode,
      LOCAL_CF_HAS_USER_WORKER: hasUserWorker,
      LOCAL_CF_READ_ONLY: options.readOnly ?? false,
      ...(options.sidecarVars ?? {}),
    } satisfies Record<string, Json>,
    serviceBindings,
    kvNamespaces: mirrored.kvNamespaces,
    d1Databases: mirrored.d1Databases,
    r2Buckets: mirrored.r2Buckets,
    queueProducers: mirrored.queueProducers,
    durableObjects: mirrored.durableObjects,
  };
}

/** Assemble the single Miniflare instance that hosts both workers. */
export function buildMiniflareOptions(options: BuildOptions): MiniflareOptions {
  const paths = persistPaths(options.config.projectRoot, options.persistTo);

  const workers: WorkerOptions[] = [buildSidecarWorkerOptions(options)];
  if (options.mode === "own" && options.userScript !== undefined) {
    workers.push(
      buildUserWorkerOptions(options.config, options.userScript, options.userScriptPath),
    );
  }

  return {
    port: options.port,
    host: options.host ?? "127.0.0.1",
    ...(options.inspectorPort !== undefined ? { inspectorPort: options.inspectorPort } : {}),
    // Identical persist paths are half of the shared-identity trick; the other
    // half is the identical binding ids in mirrorBindings().
    kvPersist: paths.kv,
    d1Persist: paths.d1,
    r2Persist: paths.r2,
    cachePersist: paths.cache,
    durableObjectsPersist: paths.durableObjects,
    workflowsPersist: paths.workflows,
    workers,
  };
}
