import { build } from "esbuild";
import type { Plugin } from "esbuild";
import { builtinModules } from "node:module";

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
