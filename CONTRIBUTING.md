# Contributing to local-cf

Thanks for taking the time. This is a small project, so the process is light —
please read the two rules under [Branches](#branches) before opening a PR, since
they are enforced by CI.

## Getting set up

You need **Node ≥ 20.11** and **pnpm 10** (the version is pinned in the root
`packageManager` field; [Corepack](https://nodejs.org/api/corepack.html) will
pick it up automatically).

```bash
git clone https://github.com/Hirusha-Nikson/local-cf.git
cd local-cf
pnpm install
pnpm build
```

`SETUP.md` has the longer version if something goes wrong.

### Trying your changes

The `examples/demo-worker` project exercises every binding kind the CLI
understands — D1, KV, R2, Durable Objects and Queues — and is the fastest way to
see a change working end to end:

```bash
pnpm demo
```

`docs/RUNNING.md` covers the individual modes.

## The build order matters

The packages are not independent, and building them out of order produces
confusing type errors:

1. **`@local-cf/core`** — shared types, `wrangler.jsonc` parsing, Miniflare
   wiring. Everything depends on this.
2. **`@local-cf/sidecar`** — the Hono worker that runs inside `workerd`. Emits
   both a bundle and the `.d.ts` files that `@local-cf/ui` imports, so it must
   be built before any typecheck of the UI.
3. **`@local-cf/dashboard`** — the offline Next.js dashboard, statically
   exported into the CLI's `dist/ui`.
4. **`local-cf`** (`packages/cli`) — the published package. Its build copies the
   sidecar bundle and the dashboard export in as data.

`pnpm build` from the root does all of this in the right order. Reach for the
individual `pnpm --filter` commands only when you know why.

## Before you open a PR

```bash
pnpm typecheck
pnpm build
```

CI runs exactly these, so a green local run should mean a green PR.

There is no linter and no test suite yet. Until there is, please describe how
you verified the change in the PR body — "ran `pnpm demo`, opened the D1 tab,
edited a row and confirmed it persisted" is genuinely useful.

## Branches

Two rules, both enforced:

- **Work on a `feature/**` branch and open the PR against `main`.** CI runs on
  pushes to `main` and `feature/**`, and on every PR.
- **Never open a PR directly against `release`.** That branch is the production
  deploy trigger for the website, and a workflow rejects any PR into it that
  does not come from `main`.

## Style

There is no automated formatter, so please match the surrounding code. A few
conventions worth knowing:

- **Comments explain *why*, not *what*.** The existing comments in
  `packages/cli/build.mjs` are the house style: they exist because the reader
  would otherwise reasonably wonder why the code is written that way.
- TypeScript throughout, ESM only, `.js` extensions on relative imports.
- Don't hand-edit `packages/cli/README.md` or `packages/cli/LICENSE` — both are
  copied from the repo root by the build. Edit the root files.

## Licence

By contributing, you agree that your contributions are licensed under the
[MIT Licence](LICENSE) that covers this project. There's no CLA to sign.
