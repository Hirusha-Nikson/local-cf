# Running local-cf from scratch

Step-by-step, from a fresh clone to a working studio.

---

## 0. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | ≥ 20.11 (22 recommended) | `node --version` |
| pnpm | ≥ 10 | `pnpm --version` |

If you do not have pnpm: `npm install -g pnpm`.

Nothing else is required. No Cloudflare account, no `wrangler login`, no network
access after install — modes A and B are entirely local.

---

## 1. Install dependencies

```bash
cd local-cf
pnpm install
```

This installs `workerd` (the real Cloudflare runtime) and platform-specific
`esbuild` binaries, which is why the first install takes ~30s.

---

## 2. Build the packages

```bash
pnpm build
```

Order matters and is handled for you by pnpm's topological ordering:

1. `@local-cf/core` — `tsc` → `dist/`
2. `@local-cf/sidecar` — esbuild → one self-contained ESM worker bundle
3. `@local-cf/dashboard` — `next build` → static export in `out/`
4. `local-cf` — esbuild → `dist/bin.js`, and **copies** the sidecar bundle to
   `dist/sidecar.js` and the dashboard export to `dist/ui/`

If you build only the CLI, it will warn that `dist/ui` is missing and the
dashboard route will return 503. Build the dashboard first.

Verify:

```bash
ls packages/cli/dist    # bin.js  index.js  sidecar.js  ui/
```

---

## 3. Run it against the demo worker

```bash
cd examples/demo-worker
node ../../packages/cli/dist/bin.js dev --open
```

You should see:

```
  local-cf v0.1.0
  mode      dev (Mode A — shared runtime)
  worker    demo-worker
  bindings  1 d1, 1 kv, 1 r2, 1 durable_object, 1 queue_producer, 1 queue_consumer
  app       http://127.0.0.1:8787
  studio    http://127.0.0.1:8787/__local-cf/ui/
```

One port serves both: everything outside `/__local-cf` is forwarded to your
worker.

### Prove the bindings really are shared

```bash
# 1. Apply migrations through the studio API
curl -X POST http://127.0.0.1:8787/__local-cf/api/d1/DB/migrations/apply \
  -H 'Content-Type: application/json' -d '{"name":"0001_create_posts.sql"}'
curl -X POST http://127.0.0.1:8787/__local-cf/api/d1/DB/migrations/apply \
  -H 'Content-Type: application/json' -d '{"name":"0002_seed_posts.sql"}'

# 2. Read them back through the *worker*
curl http://127.0.0.1:8787/posts

# 3. Bump a Durable Object via the worker, then inspect it via the studio
curl http://127.0.0.1:8787/counter
curl -X POST http://127.0.0.1:8787/__local-cf/api/do/COUNTER/fetch \
  -H 'Content-Type: application/json' -d '{"name":"global","path":"/debug"}'
```

Step 3 is the interesting one: the studio reaches the same live Durable Object
instance the worker just mutated, in-memory state included.

---

## 4. Run it against your own worker

```bash
cd /path/to/your-worker      # must contain wrangler.toml or wrangler.jsonc
npx local-cf                 # once published
# or, from this repo:
node /path/to/local-cf/packages/cli/dist/bin.js dev
```

### Options

```
-p, --port <port>        port to listen on            (default 8787)
    --host <host>        host to bind to              (default 127.0.0.1)
-e, --env <environment>  wrangler environment to use
-c, --config <path>      explicit wrangler config path
    --persist-to <path>  override the persist directory
    --no-watch           do not rebuild on file changes
-q, --quiet              keep worker logs out of the terminal
    --open               open the dashboard in your browser
```

### Requirements on your wrangler config

- `main` must point at your worker entrypoint (Mode A only).
- Give every D1 database an explicit `database_id`. Local storage identity is
  derived from it, so without one the studio may open a different database than
  your worker. local-cf warns when it is missing.

---

## 5. Attach mode — when something else owns the dev server

If you already run `wrangler dev`, OpenNext, Nuxt or a custom Miniflare harness,
local-cf cannot inject itself into that process. Run it beside them instead:

```bash
# terminal 1 — your existing dev server, unchanged
npm run dev

# terminal 2 — the studio, on a different port
local-cf attach --port 8788
```

Open <http://127.0.0.1:8788/__local-cf/ui/>. Your app stays where it was; attach
mode serves only the studio.

**What you give up:** D1, KV and R2 are shared through the persist directory, so
a write is visible once the other process flushes it. Durable Object memory and
in-flight queue messages are not shared at all. Every binding in the UI is
labelled `on disk` or `unavailable` accordingly.

---

## 6. Remote mode — your real Cloudflare account

```bash
export CLOUDFLARE_ACCOUNT_ID=xxxxxxxx
export CLOUDFLARE_API_TOKEN=xxxxxxxx
local-cf remote
```

Create the token at **My Profile → API Tokens → Create Token** with:

- D1 → Edit
- Workers KV Storage → Edit
- Workers R2 Storage → Edit

The token stays in the Node process and is never sent to the browser. Durable
Objects and Queues are not browsable in this mode — no REST API exposes them.

---

## 7. Developing the project itself

```bash
# Dashboard with hot reload, pointed at a running studio
pnpm dev:dashboard          # http://localhost:3100

# In another terminal, run the studio and tell it to use the dev server's build
LOCAL_CF_UI_DIR=/path/to/packages/dashboard/out node packages/cli/dist/bin.js dev
```

CORS is already permitted for the studio API, so the Next dev server on :3100
can talk to the sidecar on :8787.

```bash
pnpm dev:site               # the public site, http://localhost:3000
pnpm typecheck              # every package
```

After changing the sidecar or core, rebuild before restarting the CLI:

```bash
pnpm --filter @local-cf/sidecar build && pnpm --filter local-cf build
```

---

## Troubleshooting

**"Could not find the built sidecar worker"**
Run `pnpm --filter @local-cf/sidecar build`.

**Dashboard returns 503 "Dashboard not built"**
Run `pnpm --filter @local-cf/dashboard build`, then rebuild the CLI so it copies
the export into `dist/ui`.

**"No wrangler.toml / wrangler.json(c) found"**
You are not in a worker directory. Pass `--config /path/to/wrangler.jsonc`.

**Port already in use**
Pass `--port`. On Windows, find the holder with
`Get-NetTCPConnection -LocalPort 8787 -State Listen`.

**Durable Object routes return 503 in attach mode**
Expected — see §5. Use `local-cf dev` for live Durable Object access.
