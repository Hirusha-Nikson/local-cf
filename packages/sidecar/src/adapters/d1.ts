import type { Env } from "../env.js";
import { findBinding, isRemote, liveBinding } from "../lib/bindings.js";
import { fail } from "../lib/http.js";
import { cfFetch, remoteCredentials } from "../lib/remote.js";
import { splitSqlStatements } from "../lib/sql.js";

export interface D1QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  meta: Record<string, unknown>;
}

export interface D1Adapter {
  /** A single statement, optionally parameterised. */
  query(sql: string, params: unknown[]): Promise<D1QueryResult>;
  /** A multi-statement script (migrations, seed files). */
  exec(sql: string): Promise<{ statements: number }>;
}

/**
 * D1 returns rows as objects. We reshape to columns + tuples so the grid can
 * render consistently and preserve column order. When a statement returns no
 * rows there is nothing to derive column names from — that is reported as an
 * empty column list rather than guessed at.
 */
function reshape(results: Record<string, unknown>[], meta: unknown): D1QueryResult {
  const first = results[0];
  const columns = first ? Object.keys(first) : [];
  return {
    columns,
    rows: results.map((row) => columns.map((column) => row[column])),
    rowCount: results.length,
    meta: (meta as Record<string, unknown> | undefined) ?? {},
  };
}

function localAdapter(env: Env, bindingName: string): D1Adapter {
  const db = liveBinding<D1Database>(env, bindingName, "D1");
  return {
    async query(sql, params) {
      const statement = params.length > 0
        ? db.prepare(sql).bind(...params)
        : db.prepare(sql);
      const result = await statement.all();
      if (!result.success) {
        fail(400, "Query failed.", JSON.stringify(result.error ?? result.meta));
      }
      return reshape(result.results as Record<string, unknown>[], result.meta);
    },
    async exec(sql) {
      /*
       * Not `db.exec()`: that API requires every statement on its own line,
       * which no hand-written migration satisfies. Splitting ourselves and
       * batching also makes the whole script atomic.
       */
      const statements = splitSqlStatements(sql);
      if (statements.length === 0) return { statements: 0 };
      await db.batch(statements.map((statement) => db.prepare(statement)));
      return { statements: statements.length };
    },
  };
}

interface RemoteD1Response {
  results: Record<string, unknown>[];
  meta: Record<string, unknown>;
  success: boolean;
}

function remoteAdapter(env: Env, databaseId: string): D1Adapter {
  const creds = remoteCredentials(env);
  const path = `/accounts/${creds.accountId}/d1/database/${databaseId}/query`;

  const run = async (sql: string, params: unknown[]) => {
    const body = await cfFetch<RemoteD1Response[]>(creds, path, {
      method: "POST",
      body: JSON.stringify({ sql, params: params.map(String) }),
    });
    return body.result;
  };

  return {
    async query(sql, params) {
      const parts = await run(sql, params);
      const last = parts[parts.length - 1];
      if (!last) return { columns: [], rows: [], rowCount: 0, meta: {} };
      return reshape(last.results ?? [], last.meta);
    },
    async exec(sql) {
      const parts = await run(sql, []);
      return { statements: parts.length };
    },
  };
}

/** Same route code, two data sources — the Mode C requirement from SETUP.md §1. */
export async function resolveD1(env: Env, bindingName: string): Promise<D1Adapter> {
  const binding = await findBinding(env, "d1", bindingName);
  return isRemote(env)
    ? remoteAdapter(env, binding.databaseId)
    : localAdapter(env, bindingName);
}
