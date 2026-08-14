import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

/** Type-only view of the module; the value is resolved at runtime below. */
type MiniflareNamespace = typeof import("miniflare");

/**
 * The parts of the `miniflare` module we actually construct at runtime.
 *
 * `Log` is here because Miniflare validates its `log` option with
 * `z.instanceof(Log)`. A `Log` subclass built from a *different* copy of
 * miniflare fails that check, so the base class has to come from whichever
 * copy we ended up loading — see `createStudioLog`.
 */
export interface MiniflareModule {
  Miniflare: MiniflareNamespace["Miniflare"];
  Log: MiniflareNamespace["Log"];
  LogLevel: MiniflareNamespace["LogLevel"];
}

export interface ResolvedRuntime {
  module: MiniflareModule;
  /** Whose copy of miniflare we loaded. */
  source: "project" | "bundled";
  miniflareVersion: string | undefined;
  /** The workerd the loaded miniflare will spawn. */
  workerdVersion: string | undefined;
  /**
   * The workerd the *project's* own `wrangler dev` spawns, when we could find
   * it. Equal to `workerdVersion` whenever `source` is "project".
   */
  projectWorkerdVersion: string | undefined;
}

function readVersion(manifestPath: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string }).version;
  } catch {
    return undefined;
  }
}

/** The workerd a given package (miniflare, wrangler) resolves for itself. */
function workerdVersionFrom(manifestPath: string): string | undefined {
  try {
    return readVersion(createRequire(manifestPath).resolve("workerd/package.json"));
  } catch {
    return undefined;
  }
}

/**
 * Compare workerd versions (`1.20260730.1`) numerically, segment by segment.
 *
 * Returns >0 when `a` is newer. Missing or unparseable versions compare equal,
 * so an unknown version can never trigger a warning on its own.
 */
export function compareVersions(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const one = left[index] ?? 0;
    const two = right[index] ?? 0;
    if (Number.isNaN(one) || Number.isNaN(two)) return 0;
    if (one !== two) return one - two;
  }
  return 0;
}

/**
 * Load miniflare, preferring the copy the *project* already depends on.
 *
 * This is the same reasoning as `bundleWithWrangler`, applied to the runtime
 * instead of the bundler. The persist directory under `.wrangler/state` is
 * SQLite written by workerd, and workerd migrates those files in place as it
 * gains versions. Open a project's state with a workerd newer than the one its
 * own wrangler ships, and that wrangler can stop being able to start at all —
 * `std::terminate() called with no exception`, before a single request. Loading
 * the project's miniflare means the exact same workerd, so sharing the
 * directory is safe by construction rather than by luck.
 *
 * miniflare is CommonJS and declares no `exports` map, so `require` reaches
 * both the module and its manifest directly.
 */
export function resolveRuntime(projectRoot: string): ResolvedRuntime {
  const bundled = createRequire(import.meta.url);
  const fromProject = createRequire(join(resolve(projectRoot), "package.json"));

  try {
    const manifestPath = fromProject.resolve("miniflare/package.json");
    const module = fromProject("miniflare") as MiniflareModule;
    // A miniflare too old to expose these would break in confusing ways later.
    if (typeof module.Miniflare === "function" && typeof module.Log === "function") {
      const workerdVersion = workerdVersionFrom(manifestPath);
      return {
        module,
        source: "project",
        miniflareVersion: readVersion(manifestPath),
        workerdVersion,
        projectWorkerdVersion: workerdVersion,
      };
    }
  } catch {
    // No miniflare in the project (or an unloadable one) — fall through.
  }

  const manifestPath = bundled.resolve("miniflare/package.json");
  return {
    module: bundled("miniflare") as MiniflareModule,
    source: "bundled",
    miniflareVersion: readVersion(manifestPath),
    workerdVersion: workerdVersionFrom(manifestPath),
    projectWorkerdVersion: projectWorkerdVersion(projectRoot),
  };
}

/**
 * What workerd the project's own dev server runs, without loading miniflare.
 *
 * Under pnpm's strict layout `workerd` is not resolvable from the project root
 * even though wrangler depends on it, so go through wrangler's manifest.
 */
function projectWorkerdVersion(projectRoot: string): string | undefined {
  const fromProject = createRequire(join(resolve(projectRoot), "package.json"));
  for (const specifier of ["workerd/package.json", "wrangler/package.json"]) {
    try {
      const manifestPath = fromProject.resolve(specifier);
      const version =
        specifier === "workerd/package.json"
          ? readVersion(manifestPath)
          : workerdVersionFrom(manifestPath);
      if (version) return version;
    } catch {
      // Try the next one.
    }
  }
  return undefined;
}

/**
 * Whether opening the project's persist directory with this runtime risks
 * leaving state its own wrangler cannot read back.
 *
 * Only a *newer* workerd is a problem: it is the one that migrates files
 * forward. An older one either reads them or fails loudly on its own.
 */
export function runtimeMismatch(runtime: ResolvedRuntime): string | undefined {
  if (runtime.source === "project") return undefined;
  if (compareVersions(runtime.workerdVersion, runtime.projectWorkerdVersion) <= 0) {
    return undefined;
  }
  return (
    `local-cf's runtime (workerd ${runtime.workerdVersion}) is newer than your project's ` +
    `(workerd ${runtime.projectWorkerdVersion}). Writing .wrangler/state with it can migrate ` +
    `those SQLite files in place and stop your own \`wrangler dev\` from starting. ` +
    `Install a matching miniflare, or use --persist-to to keep local-cf's state separate.`
  );
}
