import { validator } from "hono/validator";
import { fail } from "./http.js";

/**
 * Query validators.
 *
 * These exist as much for typing as for safety: a validated target is what puts
 * query parameters into the `hc<ApiType>` client's signature, so the dashboard
 * gets compile-time errors on a typo instead of a silent `undefined` at
 * runtime. Reading straight off `new URL(...)` would type-check but tell the
 * client nothing.
 */

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function boundedInt(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/** `?prefix=&cursor=&limit=` — KV and R2 listings. */
export function listQuery(maxLimit: number) {
  return validator("query", (value) => ({
    prefix: first(value["prefix"]),
    cursor: first(value["cursor"]),
    delimiter: first(value["delimiter"]),
    limit: boundedInt(first(value["limit"]), 100, maxLimit),
  }));
}

/** `?key=` — a required object/entry key. */
export function keyQuery() {
  return validator("query", (value) => {
    const key = first(value["key"]);
    if (key === undefined || key === "") {
      fail(400, 'Missing required query parameter "key".');
    }
    return { key };
  });
}

/** `?limit=&offset=` — table paging. */
export function pageQuery(maxLimit: number) {
  return validator("query", (value) => {
    const offset = Number.parseInt(first(value["offset"]) ?? "0", 10);
    return {
      limit: boundedInt(first(value["limit"]), 50, maxLimit),
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    };
  });
}

/** `?table=` — a required table name. */
export function tableQuery() {
  return validator("query", (value) => {
    const table = first(value["table"]);
    if (table === undefined || table === "") {
      fail(400, 'Missing required query parameter "table".');
    }
    return { table };
  });
}

/**
 * A JSON body validator.
 *
 * As with the query validators, this does double duty: it rejects malformed
 * bodies at the edge *and* it is what puts `json:` into the typed client's
 * argument shape. A route without one cannot be called with a body through
 * `hc<ApiType>` at all.
 */
export function jsonBody<T>(parse: (value: Record<string, unknown>) => T) {
  return validator("json", (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(400, "Request body must be a JSON object.");
    }
    return parse(value as Record<string, unknown>);
  });
}

/** Require a non-empty string field. */
export function requiredString(
  value: Record<string, unknown>,
  field: string,
): string {
  const candidate = value[field];
  if (typeof candidate !== "string" || candidate.trim() === "") {
    fail(400, `Request body must include a non-empty \`${field}\` string.`);
  }
  return candidate;
}

export function optionalString(
  value: Record<string, unknown>,
  field: string,
): string | undefined {
  const candidate = value[field];
  return typeof candidate === "string" && candidate !== "" ? candidate : undefined;
}

export function optionalNumber(
  value: Record<string, unknown>,
  field: string,
): number | undefined {
  const candidate = value[field];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined;
}

/** `?since=` — the log tail cursor. */
export function sinceQuery() {
  return validator("query", (value) => {
    const since = Number.parseInt(first(value["since"]) ?? "0", 10);
    return { since: Number.isFinite(since) && since > 0 ? since : 0 };
  });
}
