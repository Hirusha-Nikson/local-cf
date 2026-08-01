import type { AuditEntry } from "@local-cf/core/types";
import { Hono } from "hono";
import { resolveKV } from "../adapters/kv.js";
import type { AppEnv } from "../env.js";
import { getMeta } from "../lib/bindings.js";
import { fail } from "../lib/http.js";
import { jsonBody, optionalString, sinceQuery } from "../lib/validate.js";

/** Forward a request to the Node host bridge, preserving the response. */
async function bridge(
  env: AppEnv["Bindings"],
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await env.BRIDGE.fetch(`http://bridge${path}`, init as RequestInit);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export const opsRoutes = new Hono<AppEnv>()
  .get("/meta", async (c) => c.json(await getMeta(c.env)))

  /**
   * Logs are polled rather than streamed. The worker's console output is
   * captured by Miniflare in the *Node* process, so the sidecar has to ask the
   * bridge for it; a cursor keeps that cheap.
   */
  .get("/logs", sinceQuery(), async (c) =>
    bridge(c.env, `/logs?since=${c.req.valid("query").since}`),
  )

  .get("/audit", async (c) => bridge(c.env, "/audit"))

  /** Replay the stored inverse of a dashboard write. */
  .post("/audit/:seq/undo", async (c) => {
    const seq = c.req.param("seq");
    const response = await c.env.BRIDGE.fetch(`http://bridge/audit`);
    const entries = ((await response.json()) as { entries: AuditEntry[] }).entries;
    const entry = entries.find((candidate) => String(candidate.seq) === seq);

    if (!entry) fail(404, `No audit entry #${seq}.`);
    if (!entry.undo) {
      fail(409, "This action cannot be undone.", `\`${entry.action}\` has no recorded inverse.`);
    }

    const { action, binding, payload } = entry.undo;
    if (action === "kv.put") {
      const data = payload as { key: string; value: string; encoding?: "text" | "base64"; metadata?: unknown };
      const kv = await resolveKV(c.env, binding);
      await kv.put(data.key, data.value, {
        ...(data.encoding ? { encoding: data.encoding } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      });
    } else if (action === "kv.delete") {
      const data = payload as { key: string };
      const kv = await resolveKV(c.env, binding);
      await kv.delete(data.key);
    } else {
      fail(501, `Undo for "${action}" is not implemented.`);
    }

    await c.env.BRIDGE.fetch(`http://bridge/audit/${seq}/undone`, { method: "POST" });
    return c.json({ ok: true, undone: entry.seq });
  })

  /** Snapshot / restore the whole persist directory — cheap, since it is files. */
  .get("/snapshots", async (c) => bridge(c.env, "/snapshots"))

  .post(
    "/snapshots",
    jsonBody((value) => ({ name: optionalString(value, "name") })),
    async (c) =>
      bridge(c.env, "/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c.req.valid("json")),
      }),
  )

  .post("/snapshots/:name/restore", async (c) =>
    bridge(c.env, `/snapshots/${encodeURIComponent(c.req.param("name"))}/restore`, {
      method: "POST",
    }),
  )

  .delete("/snapshots/:name", async (c) =>
    bridge(c.env, `/snapshots/${encodeURIComponent(c.req.param("name"))}`, {
      method: "DELETE",
    }),
  );
