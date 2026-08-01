import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { findBinding, getMeta, isRemote, liveBinding } from "../lib/bindings.js";
import { fail } from "../lib/http.js";
import { jsonBody, optionalString, requiredString } from "../lib/validate.js";

const resolveBody = jsonBody((value) => ({ name: requiredString(value, "name") }));

const fetchBody = jsonBody((value) => ({
  name: optionalString(value, "name"),
  id: optionalString(value, "id"),
  path: optionalString(value, "path") ?? "/",
  method: (optionalString(value, "method") ?? "GET").toUpperCase(),
  body: optionalString(value, "body"),
  headers:
    typeof value["headers"] === "object" && value["headers"] !== null
      ? (value["headers"] as Record<string, string>)
      : {},
}));

function namespace(c: { env: AppEnv["Bindings"] }, bindingName: string) {
  if (isRemote(c.env)) {
    fail(501, "Durable Objects cannot be inspected in remote mode.", "There is no Cloudflare REST API for reading another Durable Object's storage.");
  }
  if (!c.env.LOCAL_CF_HAS_USER_WORKER) {
    fail(
      503,
      "Durable Objects are unavailable in attach mode.",
      "Attach mode shares persisted files, not the live runtime, so there is no class for a DO binding to point at. Run `local-cf dev` for full Durable Object access.",
    );
  }
  return liveBinding<DurableObjectNamespace>(c.env, bindingName, "Durable Object");
}

export const doRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const meta = await getMeta(c.env);
    return c.json({
      namespaces: meta.bindings.filter((binding) => binding.kind === "durable_object"),
      /**
       * Stated plainly rather than papered over: workerd exposes no API for
       * reading a third party Durable Object's storage. We can address
       * instances and talk to them; anything deeper needs the class to expose
       * an endpoint of its own.
       */
      capability: "addressable",
    });
  })

  /** Resolve a human-friendly name to the hex id workerd uses. */
  .post("/:binding/resolve", resolveBody, async (c) => {
    const bindingName = c.req.param("binding");
    await findBinding(c.env, "durable_object", bindingName);
    const { name } = c.req.valid("json");
    const ns = namespace(c, bindingName);
    return c.json({ name, id: ns.idFromName(name).toString() });
  })

  /**
   * Send a request to one instance. This is the inspection primitive: a DO that
   * exposes a debug route can be browsed through it, and every DO can at least
   * be probed for liveness.
   */
  .post("/:binding/fetch", fetchBody, async (c) => {
    const bindingName = c.req.param("binding");
    await findBinding(c.env, "durable_object", bindingName);
    const body = c.req.valid("json");
    const ns = namespace(c, bindingName);

    let id: DurableObjectId;
    if (body.id) {
      id = ns.idFromString(body.id);
    } else if (body.name) {
      id = ns.idFromName(body.name);
    } else {
      fail(400, "Request body must include either `name` or `id`.");
    }

    const { method, path } = body;
    const started = Date.now();
    const response = await ns.get(id).fetch(
      new Request(`https://do${path.startsWith("/") ? path : `/${path}`}`, {
        method,
        headers: new Headers(body.headers),
        ...(method === "GET" || method === "HEAD" ? {} : { body: body.body }),
      }),
    );

    const text = await response.text();
    return c.json({
      status: response.status,
      durationMs: Date.now() - started,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
    });
  });
