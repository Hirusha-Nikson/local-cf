import { Hono } from "hono";
import { resolveR2 } from "../adapters/r2.js";
import type { AppEnv } from "../env.js";
import { recordAudit } from "../lib/audit.js";
import { keyQuery, listQuery } from "../lib/validate.js";

export const r2Routes = new Hono<AppEnv>()
  .get("/:binding/objects", listQuery(1000), async (c) => {
    const { prefix, cursor, delimiter, limit } = c.req.valid("query");
    const bucket = await resolveR2(c.env, c.req.param("binding"));
    return c.json(
      await bucket.list({
        ...(prefix ? { prefix } : {}),
        ...(cursor ? { cursor } : {}),
        ...(delimiter ? { delimiter } : {}),
        limit,
      }),
    );
  })

  /** Streams the object body straight through — no buffering in the sidecar. */
  .get("/:binding/object", keyQuery(), async (c) => {
    const bucket = await resolveR2(c.env, c.req.param("binding"));
    const { key } = c.req.valid("query");
    const response = await bucket.get(key);
    const headers = new Headers(response.headers);
    headers.set("Content-Disposition", `attachment; filename="${key.split("/").pop() ?? key}"`);
    return new Response(response.body, { status: response.status, headers });
  })

  .put("/:binding/object", keyQuery(), async (c) => {
    const bindingName = c.req.param("binding");
    const { key } = c.req.valid("query");
    const bucket = await resolveR2(c.env, bindingName);
    const body = await c.req.arrayBuffer();
    await bucket.put(key, body, c.req.header("content-type") ?? undefined);

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "r2.put",
        binding: bindingName,
        detail: `key=${key} (${body.byteLength} bytes)`,
        undo: null,
      }),
    );

    return c.json({ ok: true, key, size: body.byteLength });
  })

  .delete("/:binding/object", keyQuery(), async (c) => {
    const bindingName = c.req.param("binding");
    const { key } = c.req.valid("query");
    const bucket = await resolveR2(c.env, bindingName);
    await bucket.delete(key);

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "r2.delete",
        binding: bindingName,
        detail: `key=${key}`,
        // R2 bodies are too large to stash for undo; deletion is final.
        undo: null,
      }),
    );

    return c.json({ ok: true });
  });
