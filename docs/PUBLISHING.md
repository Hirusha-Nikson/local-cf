# Publishing from scratch

Two independent things get published. Keep them separate — SETUP.md §5 is
explicit about not building them in the same phase.

1. **The npm package** (`local-cf`) — the CLI plus the bundled offline dashboard
2. **The public site** (`apps/site`) — marketing, docs and the hosted dashboard,
   deployed to Cloudflare Workers via OpenNext

> Nothing below has been run. These are the steps to take when you decide to
> publish; each one is a deliberate, outward-facing action.

---

## Part 1 — Publishing `local-cf` to npm

### 1.1 One-time setup

```bash
npm adduser              # or: npm login
npm whoami               # confirm the account
```

Check the name is available (or that you own it):

```bash
npm view local-cf
```

If it is taken, rename the package in `packages/cli/package.json` — a scoped
name like `@yourorg/local-cf` is the usual fallback. Scoped packages need
`--access public` on first publish.

### 1.2 What actually ships

`packages/cli/package.json` declares `"files": ["dist", "README.md"]`, so the
tarball contains:

```
dist/bin.js        the CLI
dist/index.js      the programmatic API
dist/sidecar.js    the Hono worker bundle (copied at build time)
dist/ui/           the static dashboard export (copied at build time)
```

`miniflare` and `esbuild` are runtime dependencies, not bundled — they carry
platform-specific binaries and must resolve from `node_modules`.

### 1.3 Pre-publish checklist

```bash
pnpm install
pnpm typecheck                     # every package must be clean
pnpm build                         # core -> sidecar -> dashboard -> cli

# Confirm the dashboard really got bundled — a missing dist/ui ships a
# CLI whose dashboard route 503s.
ls packages/cli/dist/ui/index.html

# Smoke test the real artifact
cd examples/demo-worker
node ../../packages/cli/dist/bin.js dev --port 8799 --quiet
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8799/__local-cf/ui/
```

Inspect the tarball before pushing it anywhere:

```bash
cd packages/cli
npm pack --dry-run
```

Check the file list and the unpacked size. If `dist/ui` is absent, stop and
rebuild the dashboard.

### 1.4 Version and publish

```bash
cd packages/cli
npm version patch          # or minor / major
npm publish                # add --access public for a scoped name
```

Then verify from the outside:

```bash
cd /tmp && mkdir t && cd t
npx local-cf@latest --version
```

### 1.5 Notes

- `packages/core` is currently marked publishable but the CLI bundles it, so it
  does not need to be published separately. `@local-cf/sidecar`, `ui` and
  `dashboard` are all `"private": true` — they are build inputs, not products.
- Keep the version in `packages/cli/src/studio.ts` (`VERSION`) in step with
  `package.json`. It is reported by `--version` and by the studio API.

---

## Part 2 — Deploying the public site to Cloudflare

### 2.0 Windows prerequisite

The OpenNext build runs `next build` with `output: "standalone"`, which creates
**symlinks**. On Windows that fails with `EPERM: operation not permitted,
symlink` unless one of these is true:

- **Developer Mode is enabled** — Settings → System → For developers → Developer
  Mode → On. This is the fix; it needs no admin rights and no reboot.
- or you run the build from an elevated (Administrator) terminal.

macOS and Linux are unaffected. `pnpm --filter @local-cf/site build` (plain Next)
works on Windows either way — only `cf:build` needs this.

### 2.1 One-time setup

```bash
pnpm --filter @local-cf/site exec wrangler login
```

Pick a worker name in `apps/site/wrangler.jsonc` (currently `local-cf-site`).
It must be unique within your account.

### 2.2 Build

```bash
pnpm --filter @local-cf/site cf:build
```

Produces `apps/site/.open-next/` containing `worker.js` and `assets/`.

### 2.3 Preview locally in workerd

```bash
pnpm --filter @local-cf/site cf:preview
```

This runs the built worker in the real runtime rather than in Node — worth doing
before every deploy, because SSR behaviour can differ from `next dev`.

> Side note worth knowing: this local preview is itself a "custom dev pipeline"
> running its own Miniflare — exactly the case Attach Mode exists for. You can
> point `local-cf attach` at it and dogfood Mode B against your own site.

### 2.4 Deploy

```bash
pnpm --filter @local-cf/site cf:deploy
```

Your site is live at `https://local-cf-site.<your-subdomain>.workers.dev`.

### 2.5 Custom domain

In the Cloudflare dashboard: **Workers & Pages → your worker → Settings →
Domains & Routes → Add custom domain**. The DNS record is created for you if the
zone is on Cloudflare.

### 2.6 Optional: ISR caching with R2

The default incremental cache is in-worker memory, which is fine for a small
docs site. For real ISR across instances:

```bash
wrangler r2 bucket create local-cf-site-opennext-cache
```

Then in `apps/site/wrangler.jsonc` add:

```jsonc
"r2_buckets": [
  { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "local-cf-site-opennext-cache" }
],
"services": [
  { "binding": "WORKER_SELF_REFERENCE", "service": "local-cf-site" }
]
```

and switch `apps/site/open-next.config.ts` to:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
```

Both resources must exist in your account before the first deploy that
references them.

---

## Part 3 — What is deliberately not built

SETUP.md §5b describes deploying the sidecar itself next to a user's
**production** worker, with direct bindings to their real D1/KV/R2.

That is not implemented, and should not be until it has its own authn/authz
story. Local mode is implicitly safe because it only listens on `127.0.0.1`; a
deployed sidecar is internet-exposed with write access to production data. It
needs Cloudflare Access or a token-gated auth layer in front of it before it can
ship — treat it as its own project, not a flag on this one.

---

## Release checklist

- [ ] `pnpm typecheck` clean
- [ ] `pnpm build` clean, `packages/cli/dist/ui/index.html` exists
- [ ] Smoke test: `node packages/cli/dist/bin.js dev` in `examples/demo-worker`
- [ ] Dashboard loads and the D1 / KV / R2 tabs render real data
- [ ] `npm pack --dry-run` file list looks right
- [ ] `VERSION` in `studio.ts` matches `packages/cli/package.json`
- [ ] `npm publish`
- [ ] `npx local-cf@latest --version` from a clean directory
- [ ] Site: `cf:build`, `cf:preview`, then `cf:deploy`
