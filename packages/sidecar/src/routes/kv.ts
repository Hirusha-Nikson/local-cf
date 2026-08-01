import { Hono } from "hono";
import { resolveKV } from "../adapters/kv.js";
import type { AppEnv } from "../env.js";
import { recordAudit } from "../lib/audit.js";
import { fail } from "../lib/http.js";
import {
  jsonBody,
  keyQuery,
  listQuery,
  optionalNumber,
  requiredString,
} from "../lib/validate.js";

const putBody = jsonBody((value) => ({
  key: requiredString(value, "key"),
  value: typeof value["value"] === "string" ? value["value"] : fail(400, "`value` must be a string (base64 for binary)."),
  encoding: value["encoding"] === "base64" ? ("base64" as const) : ("text" as const),
  expirationTtl: optionalNumber(value, "expirationTtl"),
  metadata: value["metadata"],
}));

const importBody = jsonBody((value) => {
  if (!Array.isArray(value["entries"])) {
    fail(400, "Request body must include an `entries` array of {key, value}.");
  }
  return { entries: value["entries"] as { key?: unknown; value?: unknown; metadata?: unknown }[] };
});

export const kvRoutes = new Hono<AppEnv>()
  .get("/:binding/keys", listQuery(1000), async (c) => {
    const { prefix, cursor, limit } = c.req.valid("query");
    const kv = await resolveKV(c.env, c.req.param("binding"));
    return c.json(await kv.list(prefix, cursor, limit));
  })

  .get("/:binding/value", keyQuery(), async (c) => {
    const kv = await resolveKV(c.env, c.req.param("binding"));
    return c.json(await kv.get(c.req.valid("query").key));
  })

  .put("/:binding/value", putBody, async (c) => {
    const bindingName = c.req.param("binding");
    const body = c.req.valid("json");
    const kv = await resolveKV(c.env, bindingName);

    // Capture the prior value so the write can be undone from the audit log.
    const previous = await kv.get(body.key);

    await kv.put(body.key, body.value, {
      ...(body.expirationTtl !== undefined ? { expirationTtl: body.expirationTtl } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      encoding: body.encoding,
    });

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "kv.put",
        binding: bindingName,
        detail: `key=${body.key}`,
        undo:
          previous.value === null
            ? { action: "kv.delete", binding: bindingName, payload: { key: body.key } }
            : {
                action: "kv.put",
                binding: bindingName,
                payload: {
                  key: body.key,
                  value: previous.value,
                  encoding: previous.encoding,
                  metadata: previous.metadata,
                },
              },
      }),
    );

    return c.json({ ok: true });
  })

  .delete("/:binding/value", keyQuery(), async (c) => {
    const bindingName = c.req.param("binding");
    const { key } = c.req.valid("query");
    const kv = await resolveKV(c.env, bindingName);
    const previous = await kv.get(key);
    await kv.delete(key);

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "kv.delete",
        binding: bindingName,
        detail: `key=${key}`,
        undo:
          previous.value === null
            ? null
            : {
                action: "kv.put",
                binding: bindingName,
                payload: {
                  key,
                  value: previous.value,
                  encoding: previous.encoding,
                  metadata: previous.metadata,
                },
              },
      }),
    );

    return c.json({ ok: true });
  })

  /** Bulk JSON import — SETUP.md §3 seeding/import-export. */
  .post("/:binding/import", importBody, async (c) => {
    const bindingName = c.req.param("binding");
    const { entries } = c.req.valid("json");
    const kv = await resolveKV(c.env, bindingName);

    let written = 0;
    for (const entry of entries) {
      if (typeof entry.key !== "string" || typeof entry.value !== "string") continue;
      await kv.put(entry.key, entry.value, {
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      });
      written += 1;
    }

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "kv.import",
        binding: bindingName,
        detail: `${written} key(s)`,
        undo: null,
      }),
    );

    return c.json({ written, skipped: entries.length - written });
  })

  /** Whole-namespace JSON export. */
  .get("/:binding/export", async (c) => {
    const bindingName = c.req.param("binding");
    const kv = await resolveKV(c.env, bindingName);

    const entries: { key: string; value: string | null; encoding: string; metadata?: unknown }[] = [];
    let cursor: string | undefined;
    do {
      const page = await kv.list(undefined, cursor, 1000);
      for (const key of page.keys) {
        const value = await kv.get(key.name);
        entries.push({
          key: key.name,
          value: value.value,
          encoding: value.encoding,
          ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
        });
      }
      cursor = page.listComplete ? undefined : page.cursor;
    } while (cursor);

    return new Response(JSON.stringify({ binding: bindingName, entries }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${bindingName}.json"`,
      },
    });
  });
