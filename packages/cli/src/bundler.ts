import { build } from "esbuild";

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
    // With nodejs_compat, workerd provides these at runtime — leaving them
    // external keeps the bundle honest instead of shimming them badly.
    external: options.nodeCompat ? ["node:*", "cloudflare:*"] : ["cloudflare:*"],
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
