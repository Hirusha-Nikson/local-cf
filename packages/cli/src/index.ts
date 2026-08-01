/**
 * Programmatic entrypoint.
 *
 * `local-cf` is a CLI first, but the same Studio class is usable from a script
 * or a test harness — which is how the snapshot/restore workflow in SETUP.md §3
 * is meant to be driven from CI.
 */
export { Studio, VERSION } from "./studio.js";
export type { StudioOptions } from "./studio.js";
export { bundleWorker } from "./bundler.js";
export type { BundleResult } from "./bundler.js";
export { LogBuffer } from "./log-buffer.js";
export type { ApiType } from "@local-cf/sidecar";
