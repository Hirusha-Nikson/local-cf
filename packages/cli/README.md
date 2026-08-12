<div align="left">
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=14&duration=3000&pause=1000&color=FF780F&background=D5640D37&center=true&vCenter=true&repeat=false&width=124&height=38&lines=npx+local-cf" alt="Typing SVG" /></a>
</div>

# local-cf

A local-first studio for Cloudflare Workers. Browse and edit the **exact** D1
databases, KV namespaces, R2 buckets, Durable Objects and Queues your worker
is using — in the same runtime, offline, with no Cloudflare account required.

```bash
npx local-cf
```


Run that from a directory with a `wrangler.toml` / `wrangler.jsonc`, then open
the dashboard URL it prints.

## Why

Most local tooling shows you a *copy* of your data. `local-cf` boots **one**
`workerd` runtime containing two workers — yours, and a small Hono sidecar —
and gives the sidecar bindings with the *same resource identity* as yours
(same `database_id`, `namespace_id`, `bucket_name`, same Durable Object
class). Miniflare resolves both workers to the same underlying objects, so an
un-checkpointed Durable Object write is visible in the dashboard immediately,
not after the next flush.

## Commands

| Command | What it does |
| --- | --- |
| `local-cf` / `local-cf dev` | Run your worker and the studio in one runtime (Mode A) |
| `local-cf attach` | Attach to a dev server you don't control, over its persist directory (Mode B) |
| `local-cf remote` | Browse real Cloudflare resources via the API (Mode C) |

Common options (`dev` / `attach` / `remote`):

| Option | Description |
| --- | --- |
| `-p, --port <port>` | Port to listen on |
| `--host <host>` | Host to bind to |
| `-e, --env <environment>` | Wrangler environment to use |
| `-c, --config <path>` | Path to `wrangler.toml` / `wrangler.jsonc` |
| `--persist-to <path>` | Override the persist directory |
| `--no-watch` | Do not rebuild the worker on file changes |
| `-q, --quiet` | Suppress worker logs in the terminal |
| `--open` | Open the dashboard in your browser |

`remote` also takes `--account-id` / `--api-token` (or the
`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` env vars).

Mode B is a genuinely weaker guarantee than Mode A — no live Durable Object
or Queue state, just what's on disk — and the dashboard labels bindings
accordingly rather than implying parity.

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

Detected but not yet browsable (shown in the UI as such): Vectorize, Workers
AI, Hyperdrive, Analytics Engine.

## Known limitations

- Workers importing `.wasm` modules are not bundled yet.
- Durable Object *storage* cannot be read directly — the runtime exposes no
  API for it. The DO view talks to instances instead; give your class a
  `/debug` route and it becomes browsable.
- Queue depth and DLQ contents are not observable from another worker.

## Links

- Source & full docs: <https://github.com/Hirusha-Nikson/local-cf>
- Issues: <https://github.com/Hirusha-Nikson/local-cf/issues>

## License

MIT
