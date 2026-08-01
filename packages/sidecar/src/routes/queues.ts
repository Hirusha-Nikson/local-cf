import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { recordAudit } from "../lib/audit.js";
import { findBinding, getMeta, isRemote, liveBinding } from "../lib/bindings.js";
import { fail } from "../lib/http.js";
import { jsonBody, optionalNumber } from "../lib/validate.js";

const sendBody = jsonBody((value) => {
  if (value["message"] === undefined) fail(400, "Request body must include a `message`.");
  return { message: value["message"], delaySeconds: optionalNumber(value, "delaySeconds") };
});

const batchBody = jsonBody((value) => {
  const messages = value["messages"];
  if (!Array.isArray(messages) || messages.length === 0) {
    fail(400, "Request body must include a non-empty `messages` array.");
  }
  return { messages: messages as unknown[] };
});

function producer(env: AppEnv["Bindings"], bindingName: string) {
  if (isRemote(env)) {
    fail(501, "Sending to queues is not supported in remote mode yet.");
  }
  return liveBinding<Queue>(env, bindingName, "Queue");
}

export const queueRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const meta = await getMeta(c.env);
    return c.json({
      producers: meta.bindings.filter((binding) => binding.kind === "queue_producer"),
      consumers: meta.bindings.filter((binding) => binding.kind === "queue_consumer"),
    });
  })

  .post("/:binding/send", sendBody, async (c) => {
    const bindingName = c.req.param("binding");
    await findBinding(c.env, "queue_producer", bindingName);
    const body = c.req.valid("json");

    const queue = producer(c.env, bindingName);
    await queue.send(body.message, {
      ...(body.delaySeconds !== undefined ? { delaySeconds: body.delaySeconds } : {}),
    });

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "queue.send",
        binding: bindingName,
        detail: JSON.stringify(body.message).slice(0, 300),
        undo: null,
      }),
    );

    return c.json({ ok: true });
  })

  .post("/:binding/sendBatch", batchBody, async (c) => {
    const bindingName = c.req.param("binding");
    await findBinding(c.env, "queue_producer", bindingName);
    const { messages } = c.req.valid("json");

    const queue = producer(c.env, bindingName);
    await queue.sendBatch(messages.map((message) => ({ body: message })));

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "queue.sendBatch",
        binding: bindingName,
        detail: `${messages.length} message(s)`,
        undo: null,
      }),
    );

    return c.json({ ok: true, sent: messages.length });
  });
