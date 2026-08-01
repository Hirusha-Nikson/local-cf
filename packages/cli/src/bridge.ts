import { existsSync } from "node:fs";
import { appendFile, cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { AuditEntry, StudioMeta } from "@local-cf/core";
import { studioStatePaths } from "@local-cf/core";
import type { LogBuffer } from "./log-buffer.js";
import { findUiDirectory, readStaticAsset } from "./ui-assets.js";

/**
 * The Node half of local-cf.
 *
 * workerd cannot touch the filesystem, read Miniflare's log stream, or restart
 * the runtime — but the dashboard needs all three. Miniflare's function-form
 * service bindings let the sidecar call straight into this process with no
 * socket, port or auth story of its own.
 */
export interface BridgeContext {
  meta: () => StudioMeta;
  logs: LogBuffer;
  projectRoot: string;
  /** Directory Miniflare persists to; snapshots copy it wholesale. */
  persistRoot: string;
  /** Stop the runtime and release its file handles. */
  stop: () => Promise<void>;
  /** Boot the runtime again. */
  start: () => Promise<void>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function readAuditLog(path: string): Promise<AuditEntry[]> {
  if (!existsSync(path)) return [];
  const contents = await readFile(path, "utf8");
  const entries: AuditEntry[] = [];
  for (const line of contents.split("\n")) {
    if (line.trim() === "") continue;
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      // A partially-written final line is expected after a hard kill.
    }
  }
  return entries;
}

export function createBridge(context: BridgeContext) {
  const state = studioStatePaths(context.projectRoot);
  let auditSeq = 0;
  let uiRoot = findUiDirectory();
  let restoring = false;

  /**
   * Swap the persist directory for a snapshot.
   *
   * The runtime must be fully stopped in between: workerd keeps the SQLite
   * files open, and on Windows an open handle makes the directory undeletable
   * outright (`EBUSY`) rather than merely stale.
   */
  async function restoreSnapshot(name: string, source: string): Promise<void> {
    try {
      context.logs.push("info", "studio", `Restoring snapshot "${name}" — stopping runtime…`);
      await context.stop();

      await rm(context.persistRoot, { recursive: true, force: true });
      await cp(source, context.persistRoot, { recursive: true });

      context.logs.push("info", "studio", "Snapshot restored — starting runtime…");
      await context.start();
      context.logs.push("info", "studio", `Snapshot "${name}" restored.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      context.logs.push("error", "studio", `Snapshot restore failed: ${message}`);
      // Never leave the user with a dead port because a copy failed.
      await context.start().catch(() => undefined);
    }
  }

  return async function handleBridgeRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- Dashboard assets -------------------------------------------------
    if (path === "/ui" || path.startsWith("/ui/")) {
      if (!uiRoot) uiRoot = findUiDirectory();
      if (!uiRoot) {
        return new Response(
          "<h1>Dashboard not built</h1><p>Run <code>pnpm --filter @local-cf/dashboard build</code>, " +
            "or set <code>LOCAL_CF_UI_DIR</code> to a built export.</p>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }

      const asset = await readStaticAsset(uiRoot, path.slice("/ui".length) || "/");
      if (!asset) {
        const fallback = await readStaticAsset(uiRoot, "/");
        if (!fallback) return new Response("Not found", { status: 404 });
        return new Response(fallback.body, {
          status: 404,
          headers: { "Content-Type": fallback.contentType },
        });
      }

      return new Response(asset.body, {
        headers: {
          "Content-Type": asset.contentType,
          // The dashboard is rebuilt between runs; never let a stale copy stick.
          "Cache-Control": path.includes("/_next/static/")
            ? "public, max-age=31536000, immutable"
            : "no-store",
        },
      });
    }

    // --- Studio metadata --------------------------------------------------
    if (path === "/meta") {
      return json(context.meta());
    }

    // --- Log tail ---------------------------------------------------------
    if (path === "/logs") {
      const since = Number.parseInt(url.searchParams.get("since") ?? "0", 10);
      return json(context.logs.since(Number.isFinite(since) ? since : 0));
    }

    // --- Audit log --------------------------------------------------------
    if (path === "/audit" && request.method === "GET") {
      return json({ entries: (await readAuditLog(state.auditLog)).reverse() });
    }

    if (path === "/audit" && request.method === "POST") {
      const draft = (await request.json()) as Omit<AuditEntry, "seq" | "ts">;
      auditSeq = Math.max(auditSeq, (await readAuditLog(state.auditLog)).at(-1)?.seq ?? 0) + 1;
      const entry: AuditEntry = { ...draft, seq: auditSeq, ts: Date.now() };
      await mkdir(state.root, { recursive: true });
      await appendFile(state.auditLog, `${JSON.stringify(entry)}\n`, "utf8");
      return json({ ok: true, seq: entry.seq });
    }

    const undoneMatch = /^\/audit\/(\d+)\/undone$/.exec(path);
    if (undoneMatch && request.method === "POST") {
      await mkdir(state.root, { recursive: true });
      const entry: AuditEntry = {
        seq: (await readAuditLog(state.auditLog)).at(-1)?.seq ?? 0,
        ts: Date.now(),
        mode: context.meta().mode,
        action: "audit.undo",
        binding: "-",
        detail: `undid entry #${undoneMatch[1]}`,
        undo: null,
      };
      entry.seq += 1;
      await appendFile(state.auditLog, `${JSON.stringify(entry)}\n`, "utf8");
      return json({ ok: true });
    }

    // --- D1 migration files ----------------------------------------------
    if (path === "/migrations") {
      const dir = resolve(context.projectRoot, url.searchParams.get("dir") ?? "migrations");
      if (!existsSync(dir)) return json({ files: [] });
      const names = (await readdir(dir))
        .filter((name) => name.endsWith(".sql"))
        .sort((a, b) => a.localeCompare(b));
      return json({ files: names.map((name) => ({ name })) });
    }

    if (path === "/migrations/file") {
      const dir = resolve(context.projectRoot, url.searchParams.get("dir") ?? "migrations");
      const name = url.searchParams.get("name") ?? "";
      // Reject separators so `name` cannot climb out of the migrations dir.
      if (name === "" || /[\\/]/.test(name)) {
        return json({ error: "Invalid migration name." }, 400);
      }
      const file = resolve(dir, name);
      if (!existsSync(file)) return json({ error: "Not found." }, 404);
      return json({ name, sql: await readFile(file, "utf8") });
    }

    // --- Snapshots --------------------------------------------------------
    if (path === "/snapshots" && request.method === "GET") {
      if (!existsSync(state.snapshots)) return json({ snapshots: [] });
      const names = await readdir(state.snapshots);
      const snapshots = await Promise.all(
        names.map(async (name) => {
          const info = await stat(resolve(state.snapshots, name));
          return { name, createdAt: info.birthtime.toISOString() };
        }),
      );
      return json({ snapshots: snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    }

    if (path === "/snapshots" && request.method === "POST") {
      const body = (await request.json()) as { name?: unknown };
      const name =
        typeof body.name === "string" && body.name.trim() !== ""
          ? body.name.trim().replace(/[^A-Za-z0-9._-]/g, "-")
          : new Date().toISOString().replace(/[:.]/g, "-");

      if (!existsSync(context.persistRoot)) {
        return json({ error: "Nothing to snapshot: no local state has been written yet." }, 409);
      }

      const target = resolve(state.snapshots, name);
      await mkdir(state.snapshots, { recursive: true });
      await rm(target, { recursive: true, force: true });
      await cp(context.persistRoot, target, { recursive: true });
      return json({ ok: true, name });
    }

    const restoreMatch = /^\/snapshots\/([^/]+)\/restore$/.exec(path);
    if (restoreMatch && request.method === "POST") {
      const name = decodeURIComponent(restoreMatch[1] ?? "");
      const source = resolve(state.snapshots, name);
      if (!existsSync(source)) return json({ error: `No snapshot named "${name}".` }, 404);
      if (restoring) return json({ error: "A restore is already in progress." }, 409);

      /*
       * Answer *before* doing any of the work.
       *
       * This request is being served by the sidecar worker running inside the
       * very runtime the restore has to tear down — do it inline and the
       * response can never be delivered. So the reply goes out first and the
       * restore runs after it, with the dashboard polling /meta to notice the
       * runtime coming back.
       */
      restoring = true;
      setTimeout(() => {
        void restoreSnapshot(name, source).finally(() => {
          restoring = false;
        });
      }, 50);

      return json({
        ok: true,
        restoring: name,
        note: "The runtime is restarting. This page will reconnect in a moment.",
      });
    }

    const deleteMatch = /^\/snapshots\/([^/]+)$/.exec(path);
    if (deleteMatch && request.method === "DELETE") {
      const name = decodeURIComponent(deleteMatch[1] ?? "");
      await rm(resolve(state.snapshots, name), { recursive: true, force: true });
      return json({ ok: true });
    }

    return json({ error: `No bridge route for ${request.method} ${path}.` }, 404);
  };
}
