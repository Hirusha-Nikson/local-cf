import { getTestimonials, readRefreshToken, refreshTestimonials } from "@/lib/testimonials";

/**
 * Read model for the published testimonials.
 *
 * The homepage renders them on the server and does not call this route. It
 * exists for two other jobs: checking what the Worker currently believes
 * without waiting for a page render, and forcing the KV copy to refresh the
 * moment an editor ticks the approved box instead of at the next interval.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const wantsRefresh = new URL(request.url).searchParams.has("refresh");

  if (!wantsRefresh) {
    return json({ testimonials: await getTestimonials() });
  }

  // Refreshing reaches out to Google, so it is gated. Without a gate the
  // endpoint would be a free way for anyone to generate traffic against the
  // published sheet until Google starts rate-limiting us.
  const expected = readRefreshToken();
  if (!expected) {
    return json({ error: "Refresh is not configured on this deployment." }, 501);
  }

  /*
   * Header only, never a query parameter.
   *
   * `observability` is enabled on this Worker, so request URLs are written to
   * Cloudflare Workers Logs — a `?token=` form would put the secret into log
   * retention, and into browser history and any proxy along the way. Offering
   * the insecure option at all makes it the one people reach for.
   */
  const supplied = request.headers.get("x-testimonials-refresh-token") ?? "";

  if (!timingSafeEqual(supplied, expected)) {
    return json({ error: "Invalid refresh token." }, 401);
  }

  return json({ testimonials: await refreshTestimonials({ force: true }), refreshed: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The homepage is the cached surface; this route should always answer
      // with what the Worker knows right now.
      "cache-control": "no-store",
    },
  });
}

/**
 * Compares two secrets without leaking their common prefix through timing.
 *
 * Lengths are compared first and separately, which does leak the length — an
 * acceptable trade for a token we generate ourselves at a fixed size.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}
