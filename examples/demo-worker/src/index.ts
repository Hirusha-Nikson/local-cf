import { DurableObject } from "cloudflare:workers";

interface Env {
  GREETING: string;
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS: R2Bucket;
  COUNTER: DurableObjectNamespace<Counter>;
  JOBS: Queue<JobMessage>;
}

interface JobMessage {
  kind: string;
  payload: unknown;
}

/**
 * A SQLite-backed Durable Object.
 *
 * The `/debug` route is the convention local-cf's DO inspector relies on: the
 * runtime has no API for reading another DO's storage, so a class that wants to
 * be inspectable exposes its own endpoint.
 */
export class Counter extends DurableObject {
  async increment(by = 1): Promise<number> {
    const current = ((await this.ctx.storage.get<number>("value")) ?? 0) + by;
    await this.ctx.storage.put("value", current);
    return current;
  }

  async value(): Promise<number> {
    return (await this.ctx.storage.get<number>("value")) ?? 0;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/debug") {
      const entries = await this.ctx.storage.list();
      return Response.json({
        class: "Counter",
        storage: Object.fromEntries(entries),
        alarm: await this.ctx.storage.getAlarm(),
      });
    }

    if (url.pathname === "/increment") {
      return Response.json({ value: await this.increment() });
    }

    return Response.json({ value: await this.value() });
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        message: env.GREETING,
        try: ["/posts", "/cache/demo", "/counter", "/enqueue"],
        studio: "/__local-cf/ui/",
      });
    }

    if (url.pathname === "/posts") {
      const { results } = await env.DB.prepare(
        "SELECT id, title, body, created_at FROM posts ORDER BY id DESC LIMIT 20",
      ).all();
      return Response.json({ posts: results });
    }

    if (url.pathname.startsWith("/cache/")) {
      const key = url.pathname.slice("/cache/".length);
      if (request.method === "PUT") {
        await env.CACHE.put(key, await request.text());
        return Response.json({ ok: true, key });
      }
      const value = await env.CACHE.get(key);
      return Response.json({ key, value });
    }

    if (url.pathname === "/counter") {
      const stub = env.COUNTER.get(env.COUNTER.idFromName("global"));
      return Response.json({ value: await stub.increment() });
    }

    if (url.pathname === "/enqueue") {
      await env.JOBS.send({ kind: "demo", payload: { at: Date.now() } });
      console.log("queued a demo job");
      return Response.json({ queued: true });
    }

    if (url.pathname === "/assets") {
      const listing = await env.ASSETS.list({ limit: 20 });
      return Response.json({ objects: listing.objects.map((object) => object.key) });
    }

    return new Response("Not found", { status: 404 });
  },

  async queue(batch, _env): Promise<void> {
    for (const message of batch.messages) {
      console.log(`processing job ${message.id}:`, JSON.stringify(message.body));
      message.ack();
    }
  },
} satisfies ExportedHandler<Env, JobMessage>;
