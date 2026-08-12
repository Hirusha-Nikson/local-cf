import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { build } from "esbuild";

const SIDECAR_BUNDLE = "../sidecar/dist/sidecar.js";
const DASHBOARD_EXPORT = "../dashboard/out";

const { version } = JSON.parse(await readFile("package.json", "utf8"));

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

/**
 * Bundle the Node side. Miniflare and esbuild stay external — they carry
 * platform-specific binaries and must be resolved from node_modules at runtime.
 */
await build({
  entryPoints: ["src/bin.ts", "src/index.ts"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  // esbuild's node default is ["main", "module"], which picks jsonc-parser's
  // UMD build — its dynamic `require`s cannot survive an ESM bundle.
  mainFields: ["module", "main"],
  external: ["miniflare", "esbuild", "commander", "picocolors"],
  // Single source of truth for the version: package.json. src/studio.ts
  // declares this identifier rather than hardcoding a string.
  define: { __LOCAL_CF_VERSION__: JSON.stringify(version) },
  // No `banner` here: esbuild preserves the hashbang already on src/bin.ts,
  // and adding another produces a syntax error on line 2.
  logLevel: "info",
});

/**
 * The sidecar and the dashboard are *data* to the CLI: it reads them off disk
 * and hands them to Miniflare, so they are copied rather than bundled.
 */
if (!existsSync(SIDECAR_BUNDLE)) {
  throw new Error(
    `Missing ${SIDECAR_BUNDLE}. Build the sidecar first: pnpm --filter @local-cf/sidecar build`,
  );
}
await cp(SIDECAR_BUNDLE, "dist/sidecar.js");

if (existsSync(DASHBOARD_EXPORT)) {
  await cp(DASHBOARD_EXPORT, "dist/ui", { recursive: true });
  console.log("  bundled dashboard -> dist/ui");
} else {
  console.warn(
    `  ! ${DASHBOARD_EXPORT} not found — the CLI will run but the dashboard will 503.\n` +
      "    Build it with: pnpm --filter @local-cf/dashboard build",
  );
}
