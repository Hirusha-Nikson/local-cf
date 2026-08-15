# Security Policy

## Supported versions

`local-cf` is pre-1.0. Security fixes land on the latest published minor and are
released as a patch; older minors are not backported.

| Version | Supported |
| ------- | --------- |
| 0.3.x   | ✅        |
| < 0.3   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report privately through GitHub's
[private vulnerability reporting](https://github.com/Hirusha-Nikson/local-cf/security/advisories/new)
— that is the preferred route, since it keeps the report, the fix and the
advisory in one place. If you cannot use it, email
**hirushanikson@gmail.com** with `[local-cf security]` in the subject.

What helps:

- the version (`npx local-cf --version`) and your OS
- a minimal `wrangler.jsonc` and the command you ran
- what you expected versus what happened
- a proof of concept, if you have one

You can expect an acknowledgement within **72 hours** and an assessment within
**7 days**. If a fix is warranted I'll agree a disclosure timeline with you and
credit you in the advisory unless you'd rather stay anonymous.

## Threat model

`local-cf` is a developer tool that runs on your machine. It is designed for
local, trusted use, and a few properties are worth stating plainly.

**In scope** — please do report these:

- The dashboard or sidecar HTTP API being reachable from outside the loopback
  interface, or accepting cross-origin requests from a website you happen to
  have open.
- A Cloudflare API token or account ID being written to disk, logged, echoed to
  the terminal, or included in an error report or crash dump.
- Path traversal or arbitrary file write outside the project's `.local-cf/`
  directory, including via a crafted `wrangler.jsonc`.
- SQL injection in the D1 browser reaching beyond the local SQLite file, or any
  way the read-only remote attach mode performs a **write** against live
  Cloudflare resources.
- Arbitrary code execution triggered by opening a project — that is, by
  `wrangler.jsonc` contents or worker source that a user merely inspects.
- Dependency vulnerabilities that are actually reachable from the shipped code.

**Out of scope:**

- Anything requiring an attacker who already has local code execution or write
  access to your project directory. If they can edit your worker source, they do
  not need a bug in `local-cf`.
- `remote` mode reading live data that the supplied API token is authorised to
  read. That is the feature. Scope your token narrowly.
- The bundled dashboard being accessible to other users on a machine you are
  already sharing with them.
- Vulnerabilities in Miniflare, `workerd`, or Wrangler themselves — please take
  those to [Cloudflare](https://github.com/cloudflare/workers-sdk/security).

## Handling credentials

`remote` mode needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Two
recommendations:

1. **Use a scoped, read-only token.** Create one at
   [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
   with only the resource permissions you need. Do not use a Global API Key.
2. **Pass credentials via the environment, never a committed file.** `.env`,
   `.env.local` and `.dev.vars` are all in `.gitignore` — keep them there.

If you believe you have committed a token, revoke it in the Cloudflare dashboard
first, then worry about rewriting history.
