import { STUDIO_API_PREFIX, STUDIO_PREFIX, STUDIO_UI_PREFIX } from "@local-cf/core/constants";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./env.js";
import { d1Routes } from "./routes/d1.js";
import { doRoutes } from "./routes/durable-objects.js";
import { kvRoutes } from "./routes/kv.js";
import { opsRoutes } from "./routes/ops.js";
import { queueRoutes } from "./routes/queues.js";
import { r2Routes } from "./routes/r2.js";

/**
 * The API surface, mounted relative to `/__local-cf/api`.
 *
 * Exported as a type so the dashboard gets `hc<ApiType>` end-to-end typing with
 * no OpenAPI or codegen step — the concrete Hono payoff called out in
 * SETUP.md §2.
 */
/**
 * Methods that cannot change anything on disk.
 *
 * `POST /d1/:binding/query` is the SQL editor's *read* path and is exempted
 * here, then checked statement-by-statement inside the route itself — a SELECT
 * has to keep working in read-only mode or the studio stops being a browser.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const READ_PATH_EXCEPTIONS = [/\/d1\/[^/]+\/query$/];

const readOnlyGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.env.LOCAL_CF_READ_ONLY) return next();
  if (SAFE_METHODS.has(c.req.method)) return next();
  if (READ_PATH_EXCEPTIONS.some((pattern) => pattern.test(new URL(c.req.url).pathname))) {
    return next();
  }

  return c.json(
    {
      error: "local-cf is read-only in attach mode.",
      detail:
        "Another dev server owns this persist directory. Two runtimes writing " +
        "the same SQLite files can corrupt them, so writes are refused here. " +
        "Run `local-cf dev` to edit, or `local-cf --allow-write` if that dev " +
        "server is stopped.",
    },
    403,
  );
});

const api = new Hono<AppEnv>()
  .use("*", readOnlyGuard)
  .route("/", opsRoutes)
  .route("/d1", d1Routes)
  .route("/kv", kvRoutes)
  .route("/r2", r2Routes)
  .route("/do", doRoutes)
  .route("/queues", queueRoutes);

export type ApiType = typeof api;

const app = new Hono<AppEnv>();

// Same-origin in normal use; this only matters when the dashboard is being
// developed with `next dev` on another port.
app.use(`${STUDIO_PREFIX}/*`, cors({ origin: (origin) => origin, credentials: true }));

app.route(STUDIO_API_PREFIX, api);

app.get(STUDIO_PREFIX, (c) => c.redirect(`${STUDIO_UI_PREFIX}/`));
app.get(`${STUDIO_PREFIX}/`, (c) => c.redirect(`${STUDIO_UI_PREFIX}/`));

/**
 * The dashboard's static export is read off disk by the Node bridge rather than
 * bundled into this worker, which keeps the worker script small and sidesteps
 * the Static Assets routing limits flagged in SETUP.md §6.
 */
app.get(`${STUDIO_UI_PREFIX}/*`, async (c) => {
  const path = new URL(c.req.url).pathname.slice(STUDIO_UI_PREFIX.length) || "/";
  const response = await c.env.BRIDGE.fetch(`http://bridge/ui${path}`);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});

/**
 * Everything else belongs to the user's worker. Forwarding here is what lets a
 * single port serve both the app and the studio.
 */
app.all("*", async (c) => {
  if (!c.env.USER_WORKER) {
    return c.json(
      {
        error: "No worker is attached to this local-cf instance.",
        detail:
          c.env.LOCAL_CF_MODE === "attach"
            ? "You are in attach mode: your app is served by its own dev server. The studio lives at /__local-cf/ui/."
            : "Remote mode proxies the Cloudflare API only. The studio lives at /__local-cf/ui/.",
      },
      404,
    );
  }
  return c.env.USER_WORKER.fetch(c.req.raw);
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    const response = error.getResponse();
    if (response) return response;
  }
  const message = error instanceof Error ? error.message : String(error);
  return c.json({ error: "Unhandled error in local-cf sidecar.", detail: message }, 500);
});

export default app;
