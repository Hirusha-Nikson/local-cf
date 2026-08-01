import { existsSync } from "node:fs";
import { watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import {
  buildMiniflareOptions,
  collectBindings,
  loadWranglerConfig,
  parseWranglerConfig,
  persistPaths,
} from "@local-cf/core";
import type {
  AnyBinding,
  NormalizedWranglerConfig,
  StudioMeta,
  StudioMode,
} from "@local-cf/core";
import { Miniflare, LogLevel } from "miniflare";
import type { MiniflareOptions, Request as MiniflareRequest } from "miniflare";
import { createBridge } from "./bridge.js";
import { bundleWorker } from "./bundler.js";
import { LogBuffer, StudioLog } from "./log-buffer.js";

export const VERSION = "0.1.0";

export interface StudioOptions {
  cwd: string;
  mode: StudioMode;
  port: number;
  host?: string;
  /** Named wrangler environment. */
  environment?: string;
  /** Explicit wrangler config path (attach mode points at another project). */
  configPath?: string;
  persistTo?: string;
  quiet?: boolean;
  watch?: boolean;
  accountId?: string;
  apiToken?: string;
}

/**
 * Adjust each binding's fidelity for the mode we are running in.
 *
 * SETUP.md §1 is explicit that Mode B is a weaker guarantee and that the
 * product should say so rather than imply parity. This is where that honesty
 * gets encoded, and the dashboard renders it verbatim.
 */
function applyFidelity(bindings: AnyBinding[], mode: StudioMode): AnyBinding[] {
  return bindings.map((binding): AnyBinding => {
    if (mode === "own") return binding;

    // Vars are read straight out of the config file, so they are equally
    // accurate in every mode — degrading them would be a false warning.
    if (binding.kind === "var") return binding;

    if (mode === "attach") {
      switch (binding.kind) {
        case "d1":
        case "kv":
        case "r2":
          return {
            ...binding,
            fidelity: "disk",
            note: "Attached: reads the same files on disk. Writes made by the running dev server may not appear until it flushes.",
          };
        case "durable_object":
          return {
            ...binding,
            fidelity: "unsupported",
            note: "Durable Object state lives in another process in attach mode. Run `local-cf dev` for live access.",
          };
        case "queue_producer":
        case "queue_consumer":
          return {
            ...binding,
            fidelity: "unsupported",
            note: "In-flight queue messages are not shared across processes.",
          };
        default:
          return { ...binding, fidelity: "unsupported" };
      }
    }

    // Remote
    switch (binding.kind) {
      case "d1":
      case "kv":
      case "r2":
        return { ...binding, fidelity: "remote" };
      default:
        return {
          ...binding,
          fidelity: "unsupported",
          note: "No Cloudflare REST API equivalent for this binding.",
        };
    }
  });
}

async function readSidecarBundle(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Packaged alongside the CLI bundle.
    resolve(here, "sidecar.js"),
    // Workspace development.
    resolve(here, "..", "..", "sidecar", "dist", "sidecar.js"),
    resolve(here, "..", "..", "..", "sidecar", "dist", "sidecar.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFile(candidate, "utf8");
  }
  throw new Error(
    "Could not find the built sidecar worker. Run `pnpm --filter @local-cf/sidecar build`.",
  );
}

export class Studio {
  #miniflare: Miniflare | undefined;
  #options: MiniflareOptions | undefined;
  #watcher: ReturnType<typeof watch> | undefined;

  readonly config: NormalizedWranglerConfig;
  readonly mode: StudioMode;
  readonly logs = new LogBuffer();
  readonly persistRoot: string;
  readonly startedAt = new Date().toISOString();

  private constructor(config: NormalizedWranglerConfig, private readonly settings: StudioOptions) {
    this.config = config;
    this.mode = settings.mode;
    this.persistRoot = persistPaths(config.projectRoot, settings.persistTo).root;
  }

  static async start(settings: StudioOptions): Promise<Studio> {
    const config = settings.configPath
      ? parseWranglerConfig(settings.configPath, {
          ...(settings.environment ? { environment: settings.environment } : {}),
        })
      : loadWranglerConfig(settings.cwd, {
          ...(settings.environment ? { environment: settings.environment } : {}),
        });

    const studio = new Studio(config, settings);
    await studio.#boot();
    if (settings.watch && settings.mode === "own") studio.#startWatching();
    return studio;
  }

  meta(): StudioMeta {
    return {
      version: VERSION,
      mode: this.mode,
      workerName: this.config.name,
      configPath: this.config.configPath,
      persistRoot: this.mode === "remote" ? null : this.persistRoot,
      bindings: applyFidelity(collectBindings(this.config), this.mode),
      warnings: this.config.warnings,
      startedAt: this.startedAt,
    };
  }

  get url(): string {
    const host = this.settings.host ?? "127.0.0.1";
    return `http://${host}:${this.settings.port}`;
  }

  get dashboardUrl(): string {
    return `${this.url}/__local-cf/ui/`;
  }

  async #buildOptions(): Promise<MiniflareOptions> {
    const sidecarScript = await readSidecarBundle();

    let userScript: string | undefined;
    let userScriptPath: string | undefined;

    if (this.mode === "own") {
      if (!this.config.main) {
        throw new Error(
          `Your wrangler config has no \`main\` entrypoint, so there is no worker to run.\n` +
            `Use \`local-cf attach\` if another dev server owns the process.`,
        );
      }
      const bundle = await bundleWorker(this.config.main, {
        nodeCompat: this.config.compatibilityFlags.some((flag) =>
          flag.startsWith("nodejs_compat"),
        ),
      });
      userScript = bundle.code;
      userScriptPath = this.config.main;
    }

    const bridge = createBridge({
      meta: () => this.meta(),
      logs: this.logs,
      projectRoot: this.config.projectRoot,
      persistRoot: this.persistRoot,
      stop: () => this.stop(),
      start: () => this.start(),
    });

    const sidecarVars: Record<string, string> = {};
    if (this.settings.accountId) sidecarVars["LOCAL_CF_ACCOUNT_ID"] = this.settings.accountId;
    if (this.settings.apiToken) sidecarVars["LOCAL_CF_API_TOKEN"] = this.settings.apiToken;

    return {
      ...buildMiniflareOptions({
        config: this.config,
        mode: this.mode,
        sidecarScript,
        ...(userScript !== undefined ? { userScript } : {}),
        ...(userScriptPath !== undefined ? { userScriptPath } : {}),
        bridge: (request: MiniflareRequest) => bridge(request as unknown as Request),
        port: this.settings.port,
        ...(this.settings.host ? { host: this.settings.host } : {}),
        ...(this.settings.persistTo ? { persistTo: this.settings.persistTo } : {}),
        sidecarVars,
      }),
      log: new StudioLog(this.logs, LogLevel.INFO, this.settings.quiet ?? false),
    };
  }

  async #boot(): Promise<void> {
    this.#options = await this.#buildOptions();
    this.#miniflare = new Miniflare(this.#options);
    await this.#miniflare.ready;
    this.logs.push("info", "studio", `local-cf ready in ${this.mode} mode at ${this.url}`);
  }

  /**
   * Shut the runtime down and release its file handles.
   *
   * Separate from `start()` because snapshot restore has to do work *between*
   * the two: SQLite files stay locked while workerd is alive, so the copy can
   * only happen in the gap.
   */
  async stop(): Promise<void> {
    if (!this.#miniflare) return;
    await this.#miniflare.dispose();
    this.#miniflare = undefined;
  }

  async start(): Promise<void> {
    if (this.#miniflare) return;
    await this.#boot();
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /** Rebuild the user's worker and hot-swap it without dropping local state. */
  async reload(): Promise<void> {
    if (!this.#miniflare) return;
    this.#options = await this.#buildOptions();
    await this.#miniflare.setOptions(this.#options);
    this.logs.push("info", "studio", "Worker reloaded.");
  }

  #startWatching(): void {
    if (!this.config.main) return;

    /*
     * Watch the entrypoint's own directory, not the project root. Rooting the
     * watch higher means every D1/KV write under `.wrangler/state` looks like a
     * source change, and the worker rebuilds in a loop.
     */
    const watchRoot = dirname(this.config.main);
    const ignored = /(^|[\\/])(node_modules|\.wrangler|\.local-cf|\.next|dist|out)([\\/]|$)/;
    let timer: NodeJS.Timeout | undefined;

    try {
      this.#watcher = watch(watchRoot, { recursive: true }, (_event, filename) => {
        if (typeof filename === "string" && ignored.test(filename)) return;
        clearTimeout(timer);
        // Editors write in bursts; one rebuild per burst is enough.
        timer = setTimeout(() => {
          void this.reload().catch((error: unknown) => {
            this.logs.push(
              "error",
              "studio",
              `Reload failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        }, 150);
      });
    } catch {
      this.logs.push("warn", "studio", "File watching is unavailable on this platform.");
    }
  }

  async dispose(): Promise<void> {
    this.#watcher?.close();
    await this.stop();
  }
}
