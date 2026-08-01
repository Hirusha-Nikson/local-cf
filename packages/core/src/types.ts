/**
 * Shared vocabulary for the whole project.
 *
 * These types are imported by the CLI (Node), the sidecar (workerd) and the
 * dashboard (browser), so they must stay dependency-free and structural.
 */

/** How local-cf obtained access to the bindings it is showing. */
export type StudioMode =
  /** Mode A — we own the dev process; sidecar shares the runtime with the worker. */
  | "own"
  /** Mode B — we attached to someone else's dev process over the persist directory. */
  | "attach"
  /** Mode C — no Miniflare at all; proxying the Cloudflare REST API. */
  | "remote";

export type BindingKind =
  | "d1"
  | "kv"
  | "r2"
  | "durable_object"
  | "queue_producer"
  | "queue_consumer"
  | "vectorize"
  | "ai"
  | "hyperdrive"
  | "analytics_engine"
  | "service"
  | "var";

/** Fidelity of a binding under the current mode — drives the UI trust signal. */
export type BindingFidelity =
  /** Same live objects as the worker: in-memory state included. */
  | "live"
  /** Same bytes on disk, but in-memory state may lag (Mode B). */
  | "disk"
  /** Served over the network from the real Cloudflare account (Mode C). */
  | "remote"
  /** Detected in config but not browsable yet. */
  | "unsupported";

export interface BindingBase {
  kind: BindingKind;
  /** The variable name on `env`, e.g. `DB`. */
  binding: string;
  fidelity: BindingFidelity;
  /** Human-readable reason when `fidelity === "unsupported"`. */
  note?: string;
}

export interface D1Binding extends BindingBase {
  kind: "d1";
  databaseName: string;
  databaseId: string;
  /** Relative directory holding this database's migration .sql files. */
  migrationsDir?: string;
}

export interface KVBinding extends BindingBase {
  kind: "kv";
  namespaceId: string;
}

export interface R2Binding extends BindingBase {
  kind: "r2";
  bucketName: string;
}

export interface DurableObjectBinding extends BindingBase {
  kind: "durable_object";
  className: string;
  /** Worker that defines the class; undefined means the user's own worker. */
  scriptName?: string;
  useSQLite?: boolean;
}

export interface QueueProducerBinding extends BindingBase {
  kind: "queue_producer";
  queueName: string;
}

export interface QueueConsumerBinding extends BindingBase {
  kind: "queue_consumer";
  queueName: string;
  maxBatchSize?: number;
  deadLetterQueue?: string;
}

export interface GenericBinding extends BindingBase {
  kind: "vectorize" | "ai" | "hyperdrive" | "analytics_engine" | "service" | "var";
  /** Free-form identifier: index name, dataset, service name, ... */
  target?: string;
}

export type AnyBinding =
  | D1Binding
  | KVBinding
  | R2Binding
  | DurableObjectBinding
  | QueueProducerBinding
  | QueueConsumerBinding
  | GenericBinding;

/**
 * A wrangler.toml / wrangler.jsonc reduced to just what local-cf needs.
 * Deliberately a direct parse rather than wrangler internals — see SETUP.md §1.
 */
export interface NormalizedWranglerConfig {
  /** Absolute path of the config file we parsed. */
  configPath: string;
  /** Absolute path of the directory containing it. */
  projectRoot: string;
  format: "toml" | "jsonc";
  /** The environment we resolved (`undefined` = top-level). */
  environment?: string;

  name: string;
  /** Absolute path to the worker entrypoint, if declared. */
  main?: string;
  compatibilityDate?: string;
  compatibilityFlags: string[];
  vars: Record<string, unknown>;

  d1: D1Binding[];
  kv: KVBinding[];
  r2: R2Binding[];
  durableObjects: DurableObjectBinding[];
  queueProducers: QueueProducerBinding[];
  queueConsumers: QueueConsumerBinding[];
  other: GenericBinding[];

  /** Warnings worth surfacing in the CLI/UI (unknown keys, missing ids, ...). */
  warnings: string[];
}

/** What the dashboard renders on the overview screen. */
export interface StudioMeta {
  version: string;
  mode: StudioMode;
  workerName: string;
  configPath: string | null;
  persistRoot: string | null;
  /** Present in every mode; fidelity varies. */
  bindings: AnyBinding[];
  warnings: string[];
  startedAt: string;
}

export interface LogEntry {
  seq: number;
  ts: number;
  level: "debug" | "info" | "warn" | "error";
  source: "worker" | "studio";
  message: string;
}

export interface AuditEntry {
  seq: number;
  ts: number;
  mode: StudioMode;
  /** e.g. `kv.put`, `d1.query`, `r2.delete` */
  action: string;
  binding: string;
  detail: string;
  /** Enough information to undo the write, when undo is possible. */
  undo?: { action: string; binding: string; payload: unknown } | null;
}

export interface D1MigrationFile {
  name: string;
  applied: boolean;
  appliedAt?: string;
  /** Present only when explicitly requested. */
  sql?: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}
