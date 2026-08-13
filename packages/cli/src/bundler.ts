import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";
import type { Plugin } from "esbuild";

/**
 * Matches a Node built-in with or without the `node:` prefix, e.g. `path`,
 * `node:path`, `fs/promises`. `platform: "neutral"` gives esbuild no built-in
 * module list of its own, so we have to recognise them ourselves — otherwise a
 * CJS dependency doing `require("path")` looks like a missing npm package.
 */
const BUILTIN_SPECIFIER = new RegExp(
  `^(?:node:)?(?:${builtinModules
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})$`,
);

/**
 * With nodejs_compat, workerd supplies these at runtime, so they stay external
 * and get normalised to the `node:` prefix that workerd always accepts.
 * Without the flag, a built-in import cannot work at runtime no matter how we
 * bundle it — so fail with the fix rather than esbuild's "Could not resolve".
 */
function nodeBuiltins(nodeCompat: boolean): Plugin {
  /** Marks our own re-entrant resolve so the hook doesn't recurse forever. */
  const PASSTHROUGH = "local-cf:builtin-passthrough";

  return {
    name: "local-cf-node-builtins",
    setup(build) {
      build.onResolve({ filter: BUILTIN_SPECIFIER }, async (args) => {
        if (args.pluginData === PASSTHROUGH) return null;

        // Many built-in names are also real npm packages (buffer, events,
        // punycode, process, util…). An installed package of that name is the
        // one the user's lockfile pinned, so it wins over the built-in —
        // `node:`-prefixed specifiers can never be an npm package, so skip.
        if (!args.path.startsWith("node:")) {
          const resolved = await build.resolve(args.path, {
            kind: args.kind,
            importer: args.importer,
            resolveDir: args.resolveDir,
            pluginData: PASSTHROUGH,
          });
          if (resolved.errors.length === 0) return resolved;
        }

        if (nodeCompat) {
          return {
            path: args.path.startsWith("node:")
              ? args.path
              : `node:${args.path}`,
            external: true,
          };
        }
        return {
          errors: [
            {
              text:
                `"${args.path}" is a Node.js built-in, but this worker does not ` +
                `enable the nodejs_compat compatibility flag.`,
              notes: [
                {
                  text:
                    'Add "nodejs_compat" to compatibility_flags in your wrangler ' +
                    `config, or remove the dependency that imports "${args.path}".`,
                },
              ],
            },
          ],
        };
      });
    },
  };
}

/**
 * Bundle the user's worker entrypoint into one ESM module for Miniflare.
 *
 * SETUP.md §6 asked whether to reuse wrangler's bundler or bring our own.
 * Our own, deliberately: wrangler's bundler is not a public API, and a plain
 * esbuild pass with workerd's resolution conditions covers the module graph
 * that a Worker can legally contain anyway.
 */
export interface BundleResult {
  code: string;
  /** Absolute paths of every file that went into the bundle — used for watching. */
  dependencies: string[];
}

export interface WranglerBundleOptions {
  projectRoot: string;
  configPath?: string;
  environment?: string;
}

/**
 * The `wrangler` the *project* depends on, not one of ours.
 *
 * Matching the project's own toolchain is the whole point: its bundler already
 * knows the Node-compat matrix (`unenv` polyfills for the built-ins workerd
 * does not implement), which is the part local-cf's plain esbuild pass cannot
 * reproduce and the reason workers failed with `No such module "node:os"`.
 */
function findWranglerBin(projectRoot: string): string | undefined {
  try {
    const require = createRequire(join(resolve(projectRoot), "package.json"));
    const manifestPath = require.resolve("wrangler/package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.["wrangler"];
    return bin ? resolve(dirname(manifestPath), bin) : undefined;
  } catch {
    return undefined;
  }
}

function runWrangler(bin: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd,
      stdio: "ignore",
      // Dry runs never contact the API; make sure nothing prompts for auth.
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" },
    });
    child.on("error", () => resolvePromise(-1));
    child.on("close", (code) => resolvePromise(code ?? -1));
  });
}

/**
 * Bundle through `wrangler deploy --dry-run`, which runs wrangler's real
 * bundler and writes the result to disk without deploying or authenticating.
 *
 * Returns undefined when the project has no wrangler, when the dry run fails,
 * or when it emits a shape we cannot hand to Miniflare as one module — every
 * such case falls back to the built-in esbuild pass rather than failing.
 */
export async function bundleWithWrangler(
  options: WranglerBundleOptions,
): Promise<BundleResult | undefined> {
  const bin = findWranglerBin(options.projectRoot);
  if (!bin) return undefined;

  const outdir = await mkdtemp(join(tmpdir(), "local-cf-bundle-"));
  try {
    const args = ["deploy", "--dry-run", "--outdir", outdir];
    if (options.configPath) args.push("--config", options.configPath);
    if (options.environment) args.push("--env", options.environment);

    if ((await runWrangler(bin, args, options.projectRoot)) !== 0) return undefined;

    const emitted = await readdir(outdir);
    const scripts = emitted.filter((name) => name.endsWith(".js"));
    // More than one module means wasm/text side-modules we would have to wire
    // up individually; the esbuild path already inlines those.
    if (scripts.length !== 1) return undefined;

    return {
      code: await readFile(join(outdir, scripts[0] as string), "utf8"),
      dependencies: [],
    };
  } catch {
    return undefined;
  } finally {
    await rm(outdir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function bundleWorker(
  entryPoint: string,
  options: { minify?: boolean; nodeCompat?: boolean } = {},
): Promise<BundleResult> {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    conditions: ["workerd", "worker", "browser", "import", "default"],
    external: ["cloudflare:*"],
    plugins: [nodeBuiltins(options.nodeCompat ?? false)],
    minify: options.minify ?? false,
    sourcemap: false,
    logLevel: "silent",
    loader: {
      ".html": "text",
      ".txt": "text",
      ".sql": "text",
      // No `.wasm` loader: emitting a separate module needs an output path, and
      // we build in memory. Workers importing .wasm are not supported yet.
    },
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error(`esbuild produced no output for ${entryPoint}.`);
  }

  return {
    code: output.text,
    dependencies: Object.keys(result.metafile?.inputs ?? {}),
  };
}
