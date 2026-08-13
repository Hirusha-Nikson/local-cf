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
import { bundleWithWrangler, bundleWorker } from "./bundler.js";
import { LogBuffer, StudioLog } from "./log-buffer.js";
import { backupPersistState, snapshotPersistState } from "./state-backup.js";
import type { CopyOutcome } from "./state-backup.js";

/**
 * Injected from package.json at build time by build.mjs, so `--version`, the
 * startup banner and StudioMeta can never drift from the published version.
 */
declare const __LOCAL_CF_VERSION__: string;

export const VERSION = __LOCAL_CF_VERSION__;

/** How long a shutdown may spend closing the runtime before we stop waiting. */
const DISPOSE_TIMEOUT_MS = 5_000;

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
  /** Opt back into writes in attach mode, once the other dev server is stopped. */
  allowWrite?: boolean;
  /** Skip the pre-flight copy of the persist directory. */
  noBackup?: boolean;
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
            note: "Attached to a point-in-time copy of the dev server's persist directory, taken when local-cf started. Restart local-cf to refresh it.",
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
  /**
   * Attach mode shares a persist directory with a dev server we do not control,
   * so it refuses writes unless the user states that server is stopped.
   */
  readonly readOnly: boolean;
  /** The snapshot we attached to, or the backup taken before writing. */
  stateCopy: CopyOutcome | undefined;
  /** Which bundler produced the running worker, for the banner. */
  bundler: "wrangler" | "esbuild" | undefined;

  private constructor(config: NormalizedWranglerConfig, private readonly settings: StudioOptions) {
    this.config = config;
    this.mode = settings.mode;
    this.persistRoot = persistPaths(config.projectRoot, settings.persistTo).root;
    this.readOnly = settings.mode === "attach" && !settings.allowWrite;
  }

  static async start(settings: StudioOptions): Promise<Studio> {
    const config = settings.configPath
      ? parseWranglerConfig(settings.configPath, {
          ...(settings.environment ? { environment: settings.environment } : {}),
        })
      : loadWranglerConfig(settings.cwd, {
          ...(settings.environment ? { environment: settings.environment } : {}),
        });

    /**
     * Decide what this run is allowed to open before anything opens it.
     *
     * Attach defaults to a copy: the original persist directory belongs to a
     * dev server we do not control, and simply starting a runtime against it
     * writes SQLite sidecar files that its workerd may not be able to read.
     */
    const stateDir = settings.persistTo ?? resolve(config.projectRoot, ".wrangler", "state");
    let effective = settings;
    let copy: CopyOutcome | undefined;

    if (settings.mode === "attach" && !settings.allowWrite) {
      copy = await snapshotPersistState(stateDir, config.projectRoot);
      if (copy.path) effective = { ...settings, persistTo: copy.path };
    } else if (settings.mode === "attach" && !settings.noBackup) {
      // Writing someone else's state was explicitly asked for; keep a way back.
      copy = await backupPersistState(stateDir, config.projectRoot);
    }

    const studio = new Studio(config, effective);
    studio.stateCopy = copy;

    try {
      await studio.#boot();
    } catch (error) {
      /**
       * A half-booted Miniflare still has the persist directory's SQLite files
       * open. Leaving them means stale `-wal`/`-shm` beside the user's data,
       * which a *different* workerd build (their own `wrangler dev`) can fail
       * to reconcile — so a failed start must still tear down cleanly.
       */
      await studio.dispose().catch(() => {});
      throw error;
    }
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
      /**
       * Prefer the project's own wrangler. Its bundler is the one that knows
       * which Node built-ins workerd implements and which need an `unenv`
       * polyfill — reproducing that here is what kept failing. The esbuild
       * pass stays as the fallback for projects without wrangler installed.
       */
      const viaWrangler =
        process.env["LOCAL_CF_BUNDLER"] === "esbuild"
          ? undefined
          : await bundleWithWrangler({
              projectRoot: this.config.projectRoot,
              configPath: this.config.configPath,
              ...(this.settings.environment ? { environment: this.settings.environment } : {}),
            });

      if (viaWrangler) {
        this.logs.push("info", "studio", "Bundled the worker with the project's wrangler.");
      } else {
        this.logs.push(
          "info",
          "studio",
          "Bundled the worker with the built-in esbuild pass (no usable wrangler found).",
        );
      }

      const bundle =
        viaWrangler ??
        (await bundleWorker(this.config.main, {
          nodeCompat: this.config.compatibilityFlags.some((flag) =>
            flag.startsWith("nodejs_compat"),
          ),
        }));
      userScript = bundle.code;
      userScriptPath = this.config.main;
      this.bundler = viaWrangler ? "wrangler" : "esbuild";
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
        readOnly: this.readOnly,
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

  /**
   * Release the runtime and, with it, every SQLite handle under the persist
   * directory. Bounded: a dispose that hangs must not leave the process alive
   * holding those files open, so we give it a deadline and move on.
   */
  async dispose(): Promise<void> {
    this.#watcher?.close();
    this.#watcher = undefined;
    await Promise.race([
      this.stop(),
      new Promise<void>((resolve) => setTimeout(resolve, DISPOSE_TIMEOUT_MS).unref()),
    ]);
  }
}
