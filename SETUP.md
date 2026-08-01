# Local-CF — Architecture & Setup Notes

A local-first studio for Cloudflare Workers, in the spirit of localflare.dev
(see `workflow.md`), built with: **TypeScript, Next.js, Cloudflare Workers,
Hono, Node.js, Tailwind**.

This is a planning document, not implemented yet.

---

## 1. The core trick: sharing bindings, not mocking them

Localflare's dashboard doesn't talk to a copy of your data — it talks to the
exact same D1/KV/R2/DO instances your worker uses, because its "sidecar"
worker runs in the same runtime process as your app. Two different
mechanisms are needed depending on who owns the dev process:

### Mode A — We own the dev process (`npx local-cf`)

Do **not** shell out to the `wrangler dev` CLI as a subprocess. Instead use
**Miniflare's programmatic API** directly and boot one `Miniflare` instance
with a `workers: []` array containing two entries:

```ts
import { Miniflare } from "miniflare";

const mf = new Miniflare({
  workers: [
    userWorkerConfig,    // built from the project's wrangler.toml/jsonc
    sidecarWorkerConfig, // our Hono API + static dashboard, bundled into the npm package
  ],
});
```

This is one `workerd` runtime hosting both workers. If the sidecar's config
declares bindings with the **same underlying resource identity** as the
user's worker (same `database_id`, `namespace_id`, `bucket_name`, same DO
class reference, same persist path), Miniflare wires both workers to the
literal same in-memory binding/gateway objects — not a copy synced over
disk. This is what the "SHARED BINDINGS" box in `workflow.md`'s diagram
actually means at the implementation level, and it's how Wrangler itself
implements multi-worker `wrangler dev` (service bindings, tail workers)
under the hood.

Practical implication: DO instances, in-flight Queue consumers, and any
in-memory-only state are visible to the dashboard live, not just persisted
rows.

**Binding discovery**: parse the project's `wrangler.toml` (TOML) or
`wrangler.jsonc` (JSONC) for `[[d1_databases]]`, `[[kv_namespaces]]`,
`[[r2_buckets]]`, `[[durable_objects.bindings]]`, `[[queues.producers]]` —
schema is stable and documented, so a direct parse (`smol-toml` /
`jsonc-parser`) is simpler and more robust than relying on wrangler's
non-public internals. Mirror each binding into the sidecar's generated
config so Miniflare resolves them to the same storage.

### Mode B — We don't own the dev process (`local-cf attach`)

For custom pipelines (OpenNext, Nuxt, etc.) that already run their own
Miniflare/`wrangler dev` underneath, we can't inject into that process.
`local-cf attach` instead starts its **own separate** Miniflare instance
whose D1/KV/R2 persistence options point at the *same* `.wrangler/state/v3`
directory on disk.

This is a materially different (weaker) guarantee than Mode A — worth
calling out explicitly, and worth stating as an internal architectural
principle rather than papering over:

- D1 (SQLite files), KV, and R2 (blob storage) persist to disk → shared
  correctly.
- Durable Object in-memory state and in-flight Queue messages are **not**
  necessarily visible across processes until flushed.
- Product should surface this in the UI (e.g. "attached — some live DO
  state may be delayed") rather than silently implying full parity with
  Mode A.

### Mode C — Remote (Cloud) mode

No Miniflare involved. The sidecar's Hono routes proxy to the Cloudflare
REST API (`cloudflare` npm SDK) using a stored User API token, scoped to D1
Edit / KV Edit / R2 Edit / Queues Edit. Same route shapes as local mode, so
the dashboard code path doesn't need to branch much — only the underlying
data source changes.

---

## 2. Component breakdown

| Layer | Tech | Role |
|---|---|---|
| CLI entrypoint | Node.js + TS (`commander`/`citty`) | `local-cf`, `local-cf attach`. Parses `wrangler.toml`/`jsonc`, builds Miniflare worker configs, boots the runtime. |
| Sidecar worker | **Hono**, runs inside `workerd` via Miniflare | Exposes `/__local-cf/api/*` routes: D1 query, KV CRUD, R2 object ops, DO instance inspection, Queue send/monitor. Also proxies to Cloudflare REST API in Remote mode. |
| Dashboard UI (local copy) | **Next.js** (static export) + **Tailwind** | Built once, shipped inside the npm package. No dependency on a hosted `studio.*` domain — fully offline-capable. See §5 for the separate hosted site. |
| Serving the UI | Workers **Static Assets** binding on the sidecar | The same sidecar worker serves the built dashboard directly (`/__local-cf/ui`) alongside the API — one process, one port, no separate Node HTTP server needed. |
| Typed client | Hono RPC (`hc<AppType>`) | Sidecar routes are fully typed end-to-end into the Next.js dashboard — no OpenAPI/codegen step. This is a concrete advantage Hono gives us that a raw `fetch` handler sidecar (likely what localflare.dev uses) doesn't get for free. |

---

## 3. Feature differentiators vs. localflare.dev

localflare.dev's feature map stops at D1 / KV / R2 / DO / Queues browsing
and depends on a hosted dashboard domain. Target gaps:

- **Fully offline dashboard** — static-exported Next.js UI bundled in the
  package (see §2), instead of requiring `studio.localflare.dev`.
- **Broader binding coverage** — Vectorize browser, Workers AI playground,
  Hyperdrive connection inspector, Analytics Engine, Browser Rendering.
  Each is just another Hono route module + another Miniflare binding entry
  in the sidecar config — the architecture scales to these without
  redesign.
- **D1 migrations UI** — view/apply/rollback migrations, schema diff, not
  just a raw SQL editor.
- **Import/export & seeding** — CSV/JSON import for D1/KV, fixture/seed
  scripts, snapshot + restore of local state (useful for test workflows,
  and cheap to build since Mode A/B already persist to known files).
- **Live log tailing** + real-time DO alarm/WebSocket connection
  inspection, not just static state dumps.
- **Queues DLQ view + retry controls**, beyond send/monitor.
- **Usage/cost view in Remote mode** — surface KV/D1/R2 consumption
  against Cloudflare plan limits via the REST API.
- **Audit log / undo** for writes made through the dashboard.
- **Explicit Mode A vs Mode B indicator** in the UI (see §1) — turns a
  limitation into a trust signal instead of a silent gap.

---

## 5. Deploying to Cloudflare (the product's own site)

Two separate things both get called "deploying to Cloudflare" — keep them
architecturally distinct and don't build them in the same phase:

### 5a. Public site — dashboard + docs + marketing (do this now)

This is just the product's website, and it doesn't touch the local
dev/binding-sharing trick from §1 at all. Since the site needs to cover
more than the dashboard app (docs with search/MDX, marketing pages, maybe a
blog), a plain `next export` static build is the wrong target for it — static
export can't do middleware, dynamic API routes, or ISR, which docs/marketing
pages tend to want eventually.

Use **`@opennextjs/cloudflare`** instead: it deploys a full Next.js app
(SSR, ISR, middleware included) directly onto Cloudflare Workers. Structure
as one Next.js app with route groups:

- `/` — marketing
- `/docs` — documentation (MDX)
- `/app` — the actual dashboard UI (same React components as the
  static-exported copy bundled into the npm package for local/offline use —
  share the component code, just built twice for two targets)

Nice side effect: developing this site locally means running `wrangler
dev`/OpenNext's own local dev flow — which is exactly the "custom dev
pipeline" scenario `workflow.md` describes needing **Attach Mode** for. So
the product ends up dogfooding its own Mode B during its own development.

### 5b. Deployed sidecar as a live production admin panel (later, optional)

A further idea: deploy the Hono sidecar itself as its own Worker sitting
next to a user's **production** worker, with direct bindings to their real
D1/KV/R2/DO — no REST API token needed at all, since same-account direct
bindings are strictly better than going through the Cloudflare REST API.

Deliberately deferred, because it changes the security model in a way
nothing else here does: local mode is implicitly safe because it only
listens on `localhost`. A deployed sidecar is internet-exposed, so it needs
real authn/authz (e.g. Cloudflare Access, or its own token-gated auth layer)
before it can ship — treat this as its own project once the local tool (§1)
is proven, not a v1 feature.

---

## 6. Open questions to resolve before implementation

- Does Miniflare's public API support cross-worker DO namespace binding
  cleanly for arbitrary DO classes, or only via service bindings to the
  defining worker? Needs a spike.
- How to bundle the user's worker (esbuild via wrangler's bundler, or our
  own) before handing it to Miniflare as `userWorkerConfig`.
- Static Assets binding limits inside Miniflare for serving a full Next.js
  export (routing, dynamic segments) — may need `output: 'export'` with
  care around client-side routing fallback.
- Package size budget once the dashboard build is bundled into the npm
  package.
- Whether dashboard React components can realistically be shared unmodified
  between the static-export build (local, §2) and the OpenNext build
  (hosted, §5a), or need a thin routing/data-fetching adapter layer.
- Auth mechanism for §5b once that phase starts — not needed for v1.
