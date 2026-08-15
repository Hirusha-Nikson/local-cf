<!--
PRs go from a `feature/**` branch into `main`.
PRs into `release` are rejected by CI unless they come from `main`.
-->

## What this changes

<!-- One or two sentences. Link the issue if there is one: "Fixes #12". -->

## Why

<!-- What problem this solves. Skip if the "what" already makes it obvious. -->

## How it was verified

<!--
There's no test suite yet, so this section carries the weight. Be concrete:
"ran `pnpm demo`, opened the KV tab, wrote a key and confirmed it survived a
restart" tells a reviewer far more than "tested locally".
-->

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] Comments explain *why* where the code isn't self-evident
- [ ] No API token, account ID or other credential in the diff
- [ ] Root `README.md` edited rather than `packages/cli/README.md` (the build copies it)
