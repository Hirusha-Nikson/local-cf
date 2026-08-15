import { build } from "esbuild";

/**
 * Bundle the sidecar into a single ESM module.
 *
 * The CLI reads the output as a string and hands it to Miniflare as
 * `workers[0].script`, so it must be self-contained.
 */
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/sidecar.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "browser", "import", "default"],
  minify: false,
  sourcemap: false,
  // Hono and friends are MIT, which requires their copyright notice to travel
  // with substantial portions of the code. esbuild drops comments by default,
  // so collect the licence headers at the end of the bundle instead.
  legalComments: "eof",
  logLevel: "info",
});
