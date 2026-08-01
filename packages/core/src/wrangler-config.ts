import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { parse as parseToml } from "smol-toml";
import type {
  D1Binding,
  DurableObjectBinding,
  GenericBinding,
  KVBinding,
  NormalizedWranglerConfig,
  QueueConsumerBinding,
  QueueProducerBinding,
  R2Binding,
} from "./types.js";

/** Search order matches wrangler's own. */
const CONFIG_FILENAMES = [
  "wrangler.jsonc",
  "wrangler.json",
  "wrangler.toml",
] as const;

export class WranglerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WranglerConfigError";
  }
}

/** Walk up from `startDir` looking for a wrangler config. */
export function findWranglerConfig(startDir: string): string | null {
  let dir = resolve(startDir);
  // Stop at the filesystem root.
  for (;;) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = resolve(dir, filename);
      if (existsSync(candidate)) return candidate;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

type RawConfig = Record<string, unknown>;

function asRecord(value: unknown): RawConfig | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RawConfig)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Merge a named environment over the top-level config the way wrangler does:
 * bindings are *replaced* wholesale by the environment, not deep-merged.
 */
function applyEnvironment(raw: RawConfig, environment?: string): RawConfig {
  if (!environment) return raw;
  const envs = asRecord(raw["env"]);
  const target = envs && asRecord(envs[environment]);
  if (!target) {
    throw new WranglerConfigError(
      `Environment "${environment}" is not defined in the wrangler config.`,
    );
  }
  return { ...raw, ...target };
}

export interface ParseOptions {
  /** Named environment from `[env.x]` / `"env": { "x": ... }`. */
  environment?: string;
}

/** Parse a wrangler.toml / wrangler.jsonc into the shape local-cf works with. */
export function parseWranglerConfig(
  configPath: string,
  options: ParseOptions = {},
): NormalizedWranglerConfig {
  const absolute = resolve(configPath);
  if (!existsSync(absolute)) {
    throw new WranglerConfigError(`No wrangler config found at ${absolute}`);
  }

  const source = readFileSync(absolute, "utf8");
  const format: "toml" | "jsonc" = absolute.endsWith(".toml") ? "toml" : "jsonc";
  const warnings: string[] = [];

  let parsed: RawConfig;
  if (format === "toml") {
    parsed = parseToml(source) as RawConfig;
  } else {
    const errors: { error: number; offset: number; length: number }[] = [];
    parsed = parseJsonc(source, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    }) as RawConfig;
    if (errors.length > 0) {
      throw new WranglerConfigError(
        `Failed to parse ${absolute}: ${errors.length} syntax error(s), first at offset ${errors[0]!.offset}.`,
      );
    }
  }

  const raw = applyEnvironment(parsed, options.environment);
  const projectRoot = resolve(absolute, "..");

  const name = asString(raw["name"]) ?? "worker";
  const mainRelative = asString(raw["main"]);
  const main = mainRelative
    ? isAbsolute(mainRelative)
      ? mainRelative
      : resolve(projectRoot, mainRelative)
    : undefined;

  if (main && !existsSync(main)) {
    warnings.push(`main entrypoint "${mainRelative}" does not exist on disk.`);
  }

  const compatibilityFlags = asArray(raw["compatibility_flags"]).filter(
    (flag): flag is string => typeof flag === "string",
  );

  const vars = asRecord(raw["vars"]) ?? {};

  // --- D1 -----------------------------------------------------------------
  const d1: D1Binding[] = [];
  for (const entry of asArray(raw["d1_databases"])) {
    const record = asRecord(entry);
    const binding = record && asString(record["binding"]);
    if (!record || !binding) {
      warnings.push("Skipped a d1_databases entry with no `binding` name.");
      continue;
    }
    const databaseName = asString(record["database_name"]) ?? binding;
    const databaseId = asString(record["database_id"]) ?? databaseName;
    if (!asString(record["database_id"])) {
      warnings.push(
        `D1 binding "${binding}" has no database_id; falling back to "${databaseId}". ` +
          `Local storage identity is derived from this value, so add it to guarantee the ` +
          `dashboard opens the same database as your worker.`,
      );
    }
    d1.push({
      kind: "d1",
      binding,
      fidelity: "live",
      databaseName,
      databaseId,
      migrationsDir: asString(record["migrations_dir"]) ?? "migrations",
    });
  }

  // --- KV -----------------------------------------------------------------
  const kv: KVBinding[] = [];
  for (const entry of asArray(raw["kv_namespaces"])) {
    const record = asRecord(entry);
    const binding = record && asString(record["binding"]);
    if (!record || !binding) {
      warnings.push("Skipped a kv_namespaces entry with no `binding` name.");
      continue;
    }
    kv.push({
      kind: "kv",
      binding,
      fidelity: "live",
      namespaceId: asString(record["id"]) ?? binding,
    });
  }

  // --- R2 -----------------------------------------------------------------
  const r2: R2Binding[] = [];
  for (const entry of asArray(raw["r2_buckets"])) {
    const record = asRecord(entry);
    const binding = record && asString(record["binding"]);
    if (!record || !binding) {
      warnings.push("Skipped an r2_buckets entry with no `binding` name.");
      continue;
    }
    r2.push({
      kind: "r2",
      binding,
      fidelity: "live",
      bucketName: asString(record["bucket_name"]) ?? binding,
    });
  }

  // --- Durable Objects ----------------------------------------------------
  const durableObjects: DurableObjectBinding[] = [];
  const doSection = asRecord(raw["durable_objects"]);
  for (const entry of asArray(doSection?.["bindings"])) {
    const record = asRecord(entry);
    const binding = record && asString(record["name"]);
    const className = record && asString(record["class_name"]);
    if (!record || !binding || !className) {
      warnings.push(
        "Skipped a durable_objects binding missing `name` or `class_name`.",
      );
      continue;
    }
    durableObjects.push({
      kind: "durable_object",
      binding,
      fidelity: "live",
      className,
      scriptName: asString(record["script_name"]),
    });
  }

  // SQLite-backed DO classes are declared through migrations, not the binding.
  const sqliteClasses = new Set<string>();
  for (const entry of asArray(raw["migrations"])) {
    const record = asRecord(entry);
    for (const cls of asArray(record?.["new_sqlite_classes"])) {
      if (typeof cls === "string") sqliteClasses.add(cls);
    }
  }
  for (const binding of durableObjects) {
    if (sqliteClasses.has(binding.className)) binding.useSQLite = true;
  }

  // --- Queues -------------------------------------------------------------
  const queuesSection = asRecord(raw["queues"]);
  const queueProducers: QueueProducerBinding[] = [];
  for (const entry of asArray(queuesSection?.["producers"])) {
    const record = asRecord(entry);
    const binding = record && asString(record["binding"]);
    const queueName = record && asString(record["queue"]);
    if (!record || !binding || !queueName) {
      warnings.push("Skipped a queues.producers entry missing `binding` or `queue`.");
      continue;
    }
    queueProducers.push({
      kind: "queue_producer",
      binding,
      fidelity: "live",
      queueName,
    });
  }

  const queueConsumers: QueueConsumerBinding[] = [];
  for (const entry of asArray(queuesSection?.["consumers"])) {
    const record = asRecord(entry);
    const queueName = record && asString(record["queue"]);
    if (!record || !queueName) {
      warnings.push("Skipped a queues.consumers entry missing `queue`.");
      continue;
    }
    const maxBatchSize = record["max_batch_size"];
    queueConsumers.push({
      kind: "queue_consumer",
      // Consumers have no env variable; key them by queue name.
      binding: queueName,
      fidelity: "live",
      queueName,
      maxBatchSize: typeof maxBatchSize === "number" ? maxBatchSize : undefined,
      deadLetterQueue: asString(record["dead_letter_queue"]),
    });
  }

  // --- Everything else we can detect but not yet browse -------------------
  const other: GenericBinding[] = [];
  const detectOnly: {
    key: string;
    kind: GenericBinding["kind"];
    bindingKey: string;
    targetKey?: string;
    note: string;
  }[] = [
    {
      key: "vectorize",
      kind: "vectorize",
      bindingKey: "binding",
      targetKey: "index_name",
      note: "Vectorize browsing is not implemented yet.",
    },
    {
      key: "hyperdrive",
      kind: "hyperdrive",
      bindingKey: "binding",
      targetKey: "id",
      note: "Hyperdrive inspection is not implemented yet.",
    },
    {
      key: "analytics_engine_datasets",
      kind: "analytics_engine",
      bindingKey: "binding",
      targetKey: "dataset",
      note: "Analytics Engine querying is not implemented yet.",
    },
    {
      key: "services",
      kind: "service",
      bindingKey: "binding",
      targetKey: "service",
      note: "Service bindings are wired through to your worker but not browsable.",
    },
  ];

  for (const spec of detectOnly) {
    for (const entry of asArray(raw[spec.key])) {
      const record = asRecord(entry);
      const binding = record && asString(record[spec.bindingKey]);
      if (!record || !binding) continue;
      other.push({
        kind: spec.kind,
        binding,
        fidelity: "unsupported",
        target: spec.targetKey ? asString(record[spec.targetKey]) : undefined,
        note: spec.note,
      });
    }
  }

  const ai = asRecord(raw["ai"]);
  const aiBinding = ai && asString(ai["binding"]);
  if (aiBinding) {
    other.push({
      kind: "ai",
      binding: aiBinding,
      fidelity: "unsupported",
      note: "Workers AI playground is not implemented yet.",
    });
  }

  for (const [key, value] of Object.entries(vars)) {
    other.push({
      kind: "var",
      binding: key,
      fidelity: "live",
      target: typeof value === "string" ? value : JSON.stringify(value),
    });
  }

  return {
    configPath: absolute,
    projectRoot,
    format,
    environment: options.environment,
    name,
    main,
    compatibilityDate: asString(raw["compatibility_date"]),
    compatibilityFlags,
    vars,
    d1,
    kv,
    r2,
    durableObjects,
    queueProducers,
    queueConsumers,
    other,
    warnings,
  };
}

/** Convenience: locate and parse in one step. */
export function loadWranglerConfig(
  cwd: string,
  options: ParseOptions = {},
): NormalizedWranglerConfig {
  const configPath = findWranglerConfig(cwd);
  if (!configPath) {
    throw new WranglerConfigError(
      `No wrangler.toml / wrangler.json(c) found in ${resolve(cwd)} or any parent directory.`,
    );
  }
  return parseWranglerConfig(configPath, options);
}

/** Flatten a parsed config into the binding list the dashboard renders. */
export function collectBindings(config: NormalizedWranglerConfig) {
  return [
    ...config.d1,
    ...config.kv,
    ...config.r2,
    ...config.durableObjects,
    ...config.queueProducers,
    ...config.queueConsumers,
    ...config.other,
  ];
}
