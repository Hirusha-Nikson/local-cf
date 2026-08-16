import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseCsv } from "./csv";
import type { Testimonial } from "./testimonial-display";

/**
 * Testimonials come from a Google Form whose responses land in a Sheet. A
 * second tab holds only the rows an editor has ticked as approved, and that
 * tab alone is published to the web as CSV. Approving a row is the whole
 * publish step — no commit, no deploy.
 *
 * The cost of that convenience is a hard dependency on a URL nobody here
 * controls. Google's publish-to-web endpoint 404s intermittently, and when it
 * does the correct behaviour is to keep showing the testimonials we last saw
 * rather than to render an empty section. That is what the KV layer is for.
 *
 * It matters more here than it would elsewhere: open-next.config.ts leaves the
 * incremental cache at its in-worker-memory default, so Next's own ISR cache
 * dies with the isolate and cannot be relied on to hold a last-known-good copy
 * across a cold start.
 */

export type { Testimonial } from "./testimonial-display";

/** What we store in KV: the payload plus when we last heard from Google. */
type CacheEnvelope = {
  fetchedAt: number;
  testimonials: Testimonial[];
};

const KV_KEY = "testimonials:published";

/** How long a KV copy is served before we ask Google for a fresher one. */
const REFRESH_AFTER_MS = 15 * 60 * 1000;

/** Google is normally quick; a slow upstream must not hold a render open. */
const FETCH_TIMEOUT_MS = 5_000;

const MAX_ITEMS = 24;
const MAX_NAME_LENGTH = 80;
const MAX_ROLE_LENGTH = 120;
/** Matches the form's own limit, which is what sizes the carousel. */
const MAX_QUOTE_LENGTH = 400;

/** GitHub's own rule: alphanumeric or single hyphens, max 39, no edge hyphen. */
const GITHUB_HANDLE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Gravatar accepts an MD5 or, preferably, a SHA-256 of the address. */
const GRAVATAR_HASH = /^(?:[a-f\d]{32}|[a-f\d]{64})$/i;

/**
 * The floor beneath both Google and KV, used on a cold isolate that has never
 * reached either.
 *
 * Left empty deliberately. Seeding it with invented quotes would ship
 * fabricated endorsements attributed to people who never said them, so this
 * should only ever be filled by pasting in testimonials that were genuinely
 * submitted and approved. Until then an empty list simply means the section
 * does not render, which is the honest outcome.
 */
export const FALLBACK_TESTIMONIALS: Testimonial[] = [];

/**
 * Reads the published testimonials, preferring fresh data but never failing.
 *
 * Order of preference: a recent KV copy, then a live fetch, then a stale KV
 * copy, then the committed fallback.
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  const env = readEnv();
  const cached = await readCache(env.TESTIMONIALS_KV);

  if (cached && Date.now() - cached.fetchedAt < REFRESH_AFTER_MS) {
    return cached.testimonials;
  }

  return refreshTestimonials({ cached });
}

/**
 * Fetches from Google and updates KV, falling back to `cached` on any failure.
 *
 * Exported so the route handler can force a refresh without duplicating the
 * failure handling.
 */
export async function refreshTestimonials({
  cached,
  force = false,
}: {
  cached?: CacheEnvelope | null;
  /** Bypass Next's fetch cache. Only the refresh endpoint should ask for this. */
  force?: boolean;
} = {}): Promise<Testimonial[]> {
  const env = readEnv();
  const url = env.TESTIMONIALS_CSV_URL;

  // An unconfigured deployment is a normal state (a fresh clone, a preview
  // branch), not an error worth throwing over.
  if (!url) return cached?.testimonials ?? FALLBACK_TESTIMONIALS;

  const previous = cached === undefined ? await readCache(env.TESTIMONIALS_KV) : cached;

  try {
    const response = await fetch(url, {
      /*
       * `no-store` would be the honest description of what this does — KV
       * decides freshness, so a second cache in front of it is redundant. But
       * an uncached fetch during a render opts the whole route into dynamic
       * rendering, which costs the homepage its cached HTML and re-renders it
       * on every request. Matching Next's window to the KV window keeps the
       * page static and leaves the two caches agreeing rather than competing.
       */
      ...(force
        ? { cache: "no-store" as const }
        : { next: { revalidate: REFRESH_AFTER_MS / 1000 } }),
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Testimonials CSV responded ${response.status}`);
    }

    const testimonials = toTestimonials(parseCsv(await response.text()));

    // An empty result is ambiguous — it could mean "nothing approved yet" or
    // it could mean Google served us an error page that happened to parse.
    // Keeping the previous copy is the safer reading of the two.
    if (testimonials.length === 0 && previous && previous.testimonials.length > 0) {
      return previous.testimonials;
    }

    await writeCache(env.TESTIMONIALS_KV, { fetchedAt: Date.now(), testimonials });
    return testimonials;
  } catch (error) {
    console.error("[testimonials] refresh failed, serving last known good", error);
    return previous?.testimonials ?? FALLBACK_TESTIMONIALS;
  }
}

/**
 * Turns CSV rows into testimonials.
 *
 * Tolerates the sheet having a header row or not, since which one you get
 * depends on whether the FILTER formula was written to preserve headers.
 */
function toTestimonials(rows: string[][]): Testimonial[] {
  const firstRow = rows[0];
  if (!firstRow) return [];

  const columns = resolveColumns(firstRow);
  const body = columns.hasHeader ? rows.slice(1) : rows;

  const testimonials: Testimonial[] = [];

  for (const row of body) {
    const quote = stripWrappingQuotes(clean(row[columns.quote], MAX_QUOTE_LENGTH));
    const name = clean(row[columns.name], MAX_NAME_LENGTH);

    // A row with no quote or no attribution is not publishable, whatever else
    // it contains. This also drops the `#N/A` that a FILTER with no matches
    // emits when it has not been wrapped in IFERROR.
    if (!quote || !name || quote.startsWith("#")) continue;

    testimonials.push({
      name,
      role: clean(row[columns.role], MAX_ROLE_LENGTH),
      quote,
      github: cleanGithubHandle(row[columns.github]),
      avatarHash: cleanAvatarHash(row[columns.avatar]),
    });

    if (testimonials.length >= MAX_ITEMS) break;
  }

  return testimonials;
}

type ColumnMap = {
  hasHeader: boolean;
  name: number;
  role: number;
  quote: number;
  github: number;
  avatar: number;
};

/** The column order the Public tab is documented to use. */
const DEFAULT_COLUMNS: ColumnMap = {
  hasHeader: false,
  name: 0,
  role: 1,
  quote: 2,
  github: 3,
  avatar: 4,
};

/**
 * Locates each column, by header where there is one.
 *
 * Matching on headers rather than fixed positions means reordering the form
 * questions — which shifts every column in the sheet — does not silently start
 * rendering someone's role as their quote.
 */
function resolveColumns(firstRow: string[]): ColumnMap {
  const headers = firstRow.map((cell) => cell.trim().toLowerCase());
  const find = (...names: string[]) => headers.findIndex((cell) => names.includes(cell));

  const name = find("name", "your name", "full name");
  const quote = find("quote", "testimonial", "feedback", "comment");

  if (name === -1 || quote === -1) return DEFAULT_COLUMNS;

  const at = (found: number, fallback: number) => (found === -1 ? fallback : found);

  return {
    hasHeader: true,
    name,
    role: at(find("role", "title", "company", "role / company", "job title"), 1),
    quote,
    github: at(find("github", "github username", "handle"), 3),
    avatar: at(find("avatar", "gravatar", "avatar hash", "gravatar hash"), 4),
  };
}

/**
 * Reduces whatever someone typed to a bare GitHub handle, or nothing.
 *
 * This value is interpolated into a URL, so the allowlist is the security
 * boundary: anything that is not a handle — a full URL, a path traversal, a
 * query string — is discarded rather than escaped.
 */
export function cleanGithubHandle(value: string | undefined): string {
  if (!value) return "";

  const handle = value
    .trim()
    // Pasting the profile URL or an @-prefixed handle is obvious intent.
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    // Anything from the first delimiter onward is not part of the handle.
    .split(/[/?#\s]/)[0];

  return handle && GITHUB_HANDLE.test(handle) ? handle : "";
}

/** Accepts a Gravatar hash and nothing else — in particular, not an email. */
export function cleanAvatarHash(value: string | undefined): string {
  const hash = value?.trim().toLowerCase() ?? "";
  if (!hash) return "";

  if (hash.includes("@")) {
    // The whole design depends on addresses never reaching the published tab.
    // If one does, the sheet is leaking and needs fixing at the source; drop
    // it here and make the reason findable in the Worker logs.
    console.error(
      "[testimonials] avatar column contains a raw email address — the Public tab is publishing emails, fix the sheet formula",
    );
    return "";
  }

  return GRAVATAR_HASH.test(hash) ? hash : "";
}

/**
 * Removes quote marks someone wrapped around their own testimonial.
 *
 * The design puts quote marks around every quote, so a submission that already
 * has them renders as ""like this"" — which is how it looked before this
 * existed. Handles straight and curly pairs, and runs twice because people
 * occasionally do both.
 */
function stripWrappingQuotes(value: string): string {
  let result = value;

  for (let pass = 0; pass < 2; pass += 1) {
    const first = result.at(0);
    const last = result.at(-1);
    const opens = first === '"' || first === "“";
    const closes = last === '"' || last === "”";

    // Both ends, and not the same character twice in a one-character string.
    if (!opens || !closes || result.length < 2) break;

    result = result.slice(1, -1).trim();
  }

  return result;
}

/** Trims, collapses runaway whitespace and clamps length. */
function clean(value: string | undefined, maxLength: number): string {
  if (!value) return "";
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1).trimEnd()}…` : collapsed;
}

async function readCache(kv?: CloudflareEnv["TESTIMONIALS_KV"]): Promise<CacheEnvelope | null> {
  if (!kv) return null;

  try {
    const raw = await kv.get(KV_KEY, "text");
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!Array.isArray(parsed.testimonials)) return null;

    return parsed;
  } catch (error) {
    console.error("[testimonials] KV read failed", error);
    return null;
  }
}

async function writeCache(
  kv: CloudflareEnv["TESTIMONIALS_KV"],
  envelope: CacheEnvelope,
): Promise<void> {
  if (!kv) return;

  try {
    await kv.put(KV_KEY, JSON.stringify(envelope));
  } catch (error) {
    // A failed write costs freshness on the next cold start, nothing more.
    console.error("[testimonials] KV write failed", error);
  }
}

/**
 * Bindings and vars, wherever they happen to live.
 *
 * Inside workerd they come from the Cloudflare context. During `next dev` and
 * `next build` there is no such context, so the call throws and the vars fall
 * back to the process environment — which is how a `.env.local` URL works
 * locally without a Worker in the loop.
 */
function readEnv(): Partial<CloudflareEnv> {
  let env: Partial<CloudflareEnv> = {};

  try {
    env = getCloudflareContext().env as CloudflareEnv;
  } catch {
    // No Cloudflare context here; process.env below is the whole story.
  }

  return {
    ...env,
    TESTIMONIALS_CSV_URL: env.TESTIMONIALS_CSV_URL ?? process.env.TESTIMONIALS_CSV_URL,
    TESTIMONIALS_REFRESH_TOKEN:
      env.TESTIMONIALS_REFRESH_TOKEN ?? process.env.TESTIMONIALS_REFRESH_TOKEN,
  };
}

/** Exposed for the refresh endpoint, which must not read env a second way. */
export function readRefreshToken(): string | undefined {
  return readEnv().TESTIMONIALS_REFRESH_TOKEN;
}
