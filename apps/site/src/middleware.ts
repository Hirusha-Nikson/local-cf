import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";

/**
 * Keep every host that is not the canonical one out of the index.
 *
 * Staging serves the same build as production from a different hostname, which
 * makes it a complete duplicate of the site — and at times a better-working one,
 * since it is always ahead of `release`. `robots.txt` cannot help: it is a
 * static file baked into the build, identical in both environments, and it
 * already has to say `Allow: /` for production.
 *
 * The canonical tag on each page points at www, but a canonical is a hint that
 * Google is free to ignore, and it routinely does when the duplicate is
 * reachable and responds well. `X-Robots-Tag: noindex` is a directive rather
 * than a hint, so it is the one that actually settles it.
 *
 * Decided per request on the Host header rather than at build time on an env
 * var, because the deploy workflow builds once and the same artefact could be
 * pushed to either environment. Anything host-shaped — staging, a workers.dev
 * subdomain, a preview alias — is therefore covered without being enumerated.
 */
const CANONICAL_HOST = new URL(SITE_URL).host;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  /*
   * The Host header, not `nextUrl.host`. Behind Cloudflare's proxy the parsed
   * URL can carry the internal origin rather than the name the visitor typed,
   * and getting this backwards would noindex production — a silent, total loss
   * of search presence, and the failure mode worth being paranoid about.
   */
  const host = request.headers.get("host");

  if (host && host !== CANONICAL_HOST) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  /*
   * Skip the immutable build output. Those URLs are never indexed on their own
   * and are the bulk of the requests, so there is no reason to wake middleware
   * for them.
   */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
