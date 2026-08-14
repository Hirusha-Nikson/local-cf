#!/usr/bin/env node
import { spawn } from "node:child_process";
import { DEFAULT_HOST, DEFAULT_PORT } from "@local-cf/core";
import type { StudioMode } from "@local-cf/core";
import { Command, Option } from "commander";
import pc from "picocolors";
import { Studio, VERSION } from "./studio.js";

interface CliOptions {
  port: string;
  host: string;
  env?: string;
  config?: string;
  persistTo?: string;
  watch: boolean;
  quiet: boolean;
  open: boolean;
  backup: boolean;
  allowWrite: boolean;
  accountId?: string;
  apiToken?: string;
}

const MODE_LABEL: Record<StudioMode, string> = {
  own: "dev (Mode A — shared runtime)",
  attach: "attach (Mode B — shared persist directory)",
  remote: "remote (Mode C — Cloudflare REST API)",
};

/**
 * Startup failures that mean "your worker needs wrangler's bundler", as
 * opposed to a config mistake the user can fix themselves.
 */
function isNodeCompatError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /No such module "node:|Could not resolve "|nodejs_compat/.test(message);
}

/** workerd failing to open the persist directory, rather than a config mistake. */
function isRuntimeStartError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /std::terminate|Workers runtime failed to start/.test(message);
}

function openBrowser(url: string): void {
  const command =
    process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

function banner(studio: Studio): void {
  const meta = studio.meta();
  const counts = new Map<string, number>();
  for (const binding of meta.bindings) {
    counts.set(binding.kind, (counts.get(binding.kind) ?? 0) + 1);
  }

  const summary =
    [...counts.entries()]
      .filter(([kind]) => kind !== "var")
      .map(([kind, count]) => `${count} ${kind}`)
      .join(", ") || "no storage bindings";

  process.stdout.write(
    [
      "",
      `  ${pc.bold(pc.cyan("local-cf"))} ${pc.dim(`v${VERSION}`)}`,
      `  ${pc.dim("mode")}      ${MODE_LABEL[meta.mode]}`,
      `  ${pc.dim("access")}    ${
        studio.readOnly
          ? `${pc.yellow("read-only")} ${pc.dim("— another dev server owns this state")}`
          : pc.green("read/write")
      }`,
      `  ${pc.dim("worker")}    ${meta.workerName}`,
      ...(studio.bundler
        ? [
            `  ${pc.dim("bundler")}   ${
              studio.bundler === "wrangler"
                ? `${pc.green("wrangler")} ${pc.dim("(your project's)")}`
                : `${pc.yellow("esbuild")} ${pc.dim("(built-in — install wrangler for full node compat)")}`
            }`,
          ]
        : []),
      `  ${pc.dim("runtime")}   ${
        studio.runtime.source === "project"
          ? `${pc.green("miniflare")} ${pc.dim(
              `${studio.runtime.miniflareVersion ?? "?"} (your project's)`,
            )}`
          : `${pc.yellow("miniflare")} ${pc.dim(
              `${studio.runtime.miniflareVersion ?? "?"} (bundled — workerd ${
                studio.runtime.workerdVersion ?? "?"
              })`,
            )}`
      }`,
      `  ${pc.dim("bindings")}  ${summary}`,
      ...(studio.stateCopy?.path
        ? [
            `  ${pc.dim(studio.readOnly ? "snapshot" : "backup")}  ${pc.dim(
              studio.stateCopy.path,
            )}`,
          ]
        : []),
      meta.mode === "remote" ? "" : `  ${pc.dim("app")}       ${pc.green(studio.url)}`,
      `  ${pc.dim("studio")}    ${pc.green(studio.dashboardUrl)}`,
      "",
      ...(studio.runtimeWarning
        ? [`  ${pc.yellow("!")} ${pc.yellow(studio.runtimeWarning)}`, ""]
        : []),
      ...meta.warnings.map((warning) => `  ${pc.yellow("!")} ${warning}`),
      meta.warnings.length > 0 ? "" : "",
    ]
      .filter((line) => line !== "" || true)
      .join("\n"),
  );
}

async function run(mode: StudioMode, options: CliOptions): Promise<void> {
  const accountId = options.accountId ?? process.env["CLOUDFLARE_ACCOUNT_ID"];
  const apiToken = options.apiToken ?? process.env["CLOUDFLARE_API_TOKEN"];

  if (mode === "remote" && (!accountId || !apiToken)) {
    process.stderr.write(
      pc.red(
        "\n  Remote mode needs Cloudflare credentials.\n" +
          "  Pass --account-id and --api-token, or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.\n\n" +
          "  The token needs D1 Edit, Workers KV Storage Edit and Workers R2 Storage Edit.\n\n",
      ),
    );
    process.exitCode = 1;
    return;
  }

  const studio = await Studio.start({
    cwd: process.cwd(),
    mode,
    port: Number.parseInt(options.port, 10),
    host: options.host,
    watch: options.watch,
    quiet: options.quiet,
    allowWrite: options.allowWrite,
    noBackup: options.backup === false,
    ...(options.env ? { environment: options.env } : {}),
    ...(options.config ? { configPath: options.config } : {}),
    ...(options.persistTo ? { persistTo: options.persistTo } : {}),
    ...(accountId ? { accountId } : {}),
    ...(apiToken ? { apiToken } : {}),
  });

  banner(studio);
  if (options.open) openBrowser(studio.dashboardUrl);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(pc.dim("\n  Shutting down...\n"));
    void studio.dispose().finally(() => process.exit(0));
  };
  /**
   * SIGBREAK is Ctrl+Break on Windows, and SIGHUP fires when the terminal that
   * owns us closes. Both used to kill the process outright, which left the
   * persist directory's SQLite files open mid-write.
   */
  process.on("SIGBREAK", shutdown);
  process.on("SIGHUP", shutdown);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function withCommonOptions(command: Command): Command {
  return command
    .option("-p, --port <port>", "port to listen on", String(DEFAULT_PORT))
    .option("--host <host>", "host to bind to", DEFAULT_HOST)
    .option("-e, --env <environment>", "wrangler environment to use")
    .option("-c, --config <path>", "path to wrangler.toml / wrangler.jsonc")
    .option("--persist-to <path>", "override the persist directory")
    .option("--no-watch", "do not rebuild the worker on file changes")
    .option("-q, --quiet", "suppress worker logs in the terminal", false)
    .option("--open", "open the dashboard in your browser", false)
    .option("--no-backup", "do not copy the persist directory before opening it")
    .option(
      "--allow-write",
      "allow writes while attached — only when the other dev server is stopped",
      false,
    );
}

const program = new Command();

program
  .name("local-cf")
  .description(
    "A local-first studio for Cloudflare Workers.\n" +
      "Browse and edit the exact D1/KV/R2/Durable Objects/Queues your worker is using.",
  )
  .version(VERSION);

withCommonOptions(
  program
    .command("dev")
    .description("run your worker and the studio in one runtime, read/write (Mode A)"),
).action((options: CliOptions) => run("own", options));

/**
 * The default.
 *
 * Attaching cannot execute the user's worker, so it never needs to bundle it —
 * which makes it the command most likely to just work. It is read-only unless
 * asked otherwise, so the first thing a new user runs cannot damage the
 * project's local state.
 */
withCommonOptions(
  program
    .command("attach", { isDefault: true })
    .description(
      "browse the persist directory of a dev server you do not control, read-only (Mode B)",
    ),
).action((options: CliOptions) => run("attach", options));

withCommonOptions(program.command("remote").description("browse real Cloudflare resources (Mode C)"))
  .addOption(new Option("--account-id <id>", "Cloudflare account id").env("CLOUDFLARE_ACCOUNT_ID"))
  .addOption(new Option("--api-token <token>", "Cloudflare API token").env("CLOUDFLARE_API_TOKEN"))
  .action((options: CliOptions) => run("remote", options));

program.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(`\n  ${pc.red("error")} ${error instanceof Error ? error.message : String(error)}\n\n`);
  if (isRuntimeStartError(error)) {
    process.stderr.write(
      `  ${pc.dim("workerd aborts like this when a SQLite file in the persist directory\n" +
        "  cannot be read. If a previous run left it inconsistent, restore from\n" +
        "  .local-cf/backups/, or delete .wrangler/state to start clean.")}\n\n`,
    );
  }
  if (isNodeCompatError(error)) {
    process.stderr.write(
      `  ${pc.dim("This worker needs part of wrangler's bundler that local-cf does not\n" +
        "  reimplement. Until it does, browse the same data read-only with:")}\n\n` +
        `    ${pc.cyan("npx wrangler dev")}     ${pc.dim("# terminal 1")}\n` +
        `    ${pc.cyan("npx local-cf")}         ${pc.dim("# terminal 2")}\n\n`,
    );
  }
  /**
   * `process.exitCode` alone is not enough: a failed boot can leave workerd
   * handles on the event loop, and the CLI then sits there looking hung. The
   * error is already reported, so leave deliberately.
   */
  process.exit(1);
});
