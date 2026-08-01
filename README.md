# local-cf

A local-first studio for Cloudflare Workers. Browse and edit the **exact** D1
databases, KV namespaces, R2 buckets, Durable Objects and Queues your worker is
using — in the same runtime, offline, with no Cloudflare account required.

```bash
npx local-cf
```

Implements the architecture described in [SETUP.md](./SETUP.md).

---

## The idea in one paragraph

Most local tooling shows you a *copy* of your data. `local-cf` boots **one**
`workerd` runtime containing two workers — yours, and a small Hono sidecar —
and gives the sidecar bindings with the *same resource identity* as yours (same
`database_id`, `namespace_id`, `bucket_name`, same Durable Object class). Miniflare
then resolves both workers to the same underlying objects, so an un-checkpointed
Durable Object write is visible in the dashboard immediately, not after the next
flush.

## Repository layout

| Path | Package | What it is |
| --- | --- | --- |
| `packages/core` | `@local-cf/core` | Wrangler config parsing, binding types, Miniflare wiring |
| `packages/sidecar` | `@local-cf/sidecar` | The Hono worker: `/__local-cf/api/*`, runs inside `workerd` |
| `packages/ui` | `@local-cf/ui` | React components, shared by both dashboard builds |
| `packages/dashboard` | `@local-cf/dashboard` | Next.js **static export** bundled into the npm package |
| `packages/cli` | `local-cf` | The published CLI: Miniflare boot, Node bridge, bundling |
| `apps/site` | `@local-cf/site` | Public site (marketing + MDX docs + hosted dashboard), OpenNext |
| `examples/demo-worker` | — | A worker using every binding kind, for testing |

## Quick start (this repo)

```bash
pnpm install
pnpm build          # core -> sidecar -> dashboard -> cli
cd examples/demo-worker
node ../../packages/cli/dist/bin.js dev --open
```

Then open <http://127.0.0.1:8787/__local-cf/ui/>.

Full instructions: **[docs/RUNNING.md](./docs/RUNNING.md)**
Publishing to npm and Cloudflare: **[docs/PUBLISHING.md](./docs/PUBLISHING.md)**

## Modes

| Mode | Command | D1 / KV / R2 | Durable Objects & Queues |
| --- | --- | --- | --- |
| **A** shared runtime | `local-cf` | Same live objects | Live, including in-memory state |
| **B** attached | `local-cf attach` | Same files on disk | Not available across processes |
| **C** remote | `local-cf remote` | Your real Cloudflare account | No REST API equivalent |

Mode B is a genuinely weaker guarantee than Mode A, and the dashboard labels
every binding accordingly rather than implying parity.

## What works today

- **D1** — table browser with paging, SQL editor, CSV export, migration
  list/apply tracked in `d1_migrations`
- **KV** — key list with prefix filter, value editor (UTF-8 and base64), TTL,
  JSON import/export
- **R2** — object listing, upload, download, delete
- **Durable Objects** — name→id resolution and live request inspection
- **Queues** — send single messages, consumer/DLQ config view
- **Logs** — polled tail of worker `console.*` output
- **Snapshots** — copy and restore the whole persist directory
- **Audit log** — every dashboard write recorded, with undo where an inverse exists

Detected but not yet browsable (shown in the UI as such): Vectorize, Workers AI,
Hyperdrive, Analytics Engine.

## Known limitations

- Workers importing `.wasm` modules are not bundled yet.
- Durable Object *storage* cannot be read directly — the runtime exposes no API
  for it. The DO view talks to instances instead; give your class a `/debug`
  route and it becomes browsable.
- Queue depth and DLQ contents are not observable from another worker.
- `next build` for `apps/site` requires Windows Developer Mode (symlinks) when
  producing the OpenNext standalone output — see docs/PUBLISHING.md.

## License

MIT
