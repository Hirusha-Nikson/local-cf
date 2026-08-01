import type { D1MigrationFile } from "@local-cf/core/types";
import { Hono } from "hono";
import { resolveD1 } from "../adapters/d1.js";
import type { AppEnv } from "../env.js";
import { recordAudit } from "../lib/audit.js";
import { findBinding } from "../lib/bindings.js";
import { fail } from "../lib/http.js";
import { jsonBody, pageQuery, requiredString, tableQuery } from "../lib/validate.js";

const MIGRATIONS_TABLE = "d1_migrations";

/** Statements that change data — used to decide whether to write an audit entry. */
const MUTATING = /^\s*(insert|update|delete|drop|alter|create|replace|truncate|pragma)\b/i;

const sqlBody = jsonBody((value) => ({
  sql: requiredString(value, "sql"),
  params: Array.isArray(value["params"]) ? (value["params"] as unknown[]) : [],
}));

const migrationBody = jsonBody((value) => ({ name: requiredString(value, "name") }));

function toCsv(columns: string[], rows: unknown[][]): string {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
}

export const d1Routes = new Hono<AppEnv>()
  /** Table list, with row counts, straight out of sqlite_master. */
  .get("/:binding/tables", async (c) => {
    const db = await resolveD1(c.env, c.req.param("binding"));
    const result = await db.query(
      `SELECT name, type, sql FROM sqlite_master
       WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
       ORDER BY name`,
      [],
    );
    return c.json({
      tables: result.rows.map((row) => ({
        name: String(row[0]),
        type: String(row[1]),
        sql: row[2] === null ? null : String(row[2]),
      })),
    });
  })

  /** Column metadata for one table. */
  .get("/:binding/tables/:table/columns", async (c) => {
    const db = await resolveD1(c.env, c.req.param("binding"));
    const table = c.req.param("table");
    // PRAGMA does not accept bound parameters, so the identifier is quoted.
    const result = await db.query(`PRAGMA table_info("${table.replaceAll('"', '""')}")`, []);
    return c.json({
      columns: result.rows.map((row) => ({
        cid: Number(row[0]),
        name: String(row[1]),
        type: String(row[2]),
        notNull: Boolean(row[3]),
        defaultValue: row[4],
        primaryKey: Boolean(row[5]),
      })),
    });
  })

  /** Paged browse of a single table — the common case, without writing SQL. */
  .get("/:binding/tables/:table/rows", pageQuery(500), async (c) => {
    const db = await resolveD1(c.env, c.req.param("binding"));
    const table = c.req.param("table").replaceAll('"', '""');
    const { limit, offset } = c.req.valid("query");

    const [page, total] = await Promise.all([
      db.query(`SELECT * FROM "${table}" LIMIT ?1 OFFSET ?2`, [limit, offset]),
      db.query(`SELECT COUNT(*) AS n FROM "${table}"`, []),
    ]);

    return c.json({
      columns: page.columns,
      rows: page.rows,
      total: Number(total.rows[0]?.[0] ?? 0),
      limit,
      offset,
    });
  })

  /** Arbitrary single-statement SQL from the editor. */
  .post("/:binding/query", sqlBody, async (c) => {
    const bindingName = c.req.param("binding");
    const { sql, params } = c.req.valid("json");
    const db = await resolveD1(c.env, bindingName);

    const started = Date.now();
    const result = await db.query(sql, params);
    const durationMs = Date.now() - started;

    if (MUTATING.test(sql)) {
      c.executionCtx.waitUntil(
        recordAudit(c.env, {
          action: "d1.query",
          binding: bindingName,
          detail: sql.slice(0, 500),
          undo: null,
        }),
      );
    }

    return c.json({ ...result, durationMs });
  })

  /** Multi-statement scripts (seeds, hand-written migrations). */
  .post("/:binding/exec", sqlBody, async (c) => {
    const bindingName = c.req.param("binding");
    const db = await resolveD1(c.env, bindingName);
    const result = await db.exec(c.req.valid("json").sql);
    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "d1.exec",
        binding: bindingName,
        detail: `${result.statements} statement(s)`,
        undo: null,
      }),
    );
    return c.json(result);
  })

  /** Export a table (or a query) as CSV — SETUP.md §3 import/export. */
  .get("/:binding/export", tableQuery(), async (c) => {
    const db = await resolveD1(c.env, c.req.param("binding"));
    const { table } = c.req.valid("query");
    const result = await db.query(`SELECT * FROM "${table.replaceAll('"', '""')}"`, []);
    return new Response(toCsv(result.columns, result.rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}.csv"`,
      },
    });
  })

  /**
   * Migration state = files on disk (via the bridge) joined with the
   * `d1_migrations` table wrangler maintains.
   */
  .get("/:binding/migrations", async (c) => {
    const bindingName = c.req.param("binding");
    const binding = await findBinding(c.env, "d1", bindingName);
    const db = await resolveD1(c.env, bindingName);

    const listed = await c.env.BRIDGE.fetch(
      `http://bridge/migrations?dir=${encodeURIComponent(binding.migrationsDir ?? "migrations")}`,
    );
    const files = ((await listed.json()) as { files: { name: string }[] }).files;

    let applied = new Map<string, string>();
    try {
      const rows = await db.query(`SELECT name, applied_at FROM ${MIGRATIONS_TABLE}`, []);
      applied = new Map(rows.rows.map((row) => [String(row[0]), String(row[1])]));
    } catch {
      // Table does not exist yet: nothing has been applied.
    }

    const migrations: D1MigrationFile[] = files.map((file) => ({
      name: file.name,
      applied: applied.has(file.name),
      ...(applied.has(file.name) ? { appliedAt: applied.get(file.name) } : {}),
    }));

    return c.json({ migrations, migrationsDir: binding.migrationsDir ?? "migrations" });
  })

  /** Apply one pending migration file. */
  .post("/:binding/migrations/apply", migrationBody, async (c) => {
    const bindingName = c.req.param("binding");
    const binding = await findBinding(c.env, "d1", bindingName);
    const body = c.req.valid("json");

    const dir = binding.migrationsDir ?? "migrations";
    const response = await c.env.BRIDGE.fetch(
      `http://bridge/migrations/file?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(body.name)}`,
    );
    if (!response.ok) fail(404, `Migration "${body.name}" not found in ${dir}/.`);
    const { sql } = (await response.json()) as { sql: string };

    const db = await resolveD1(c.env, bindingName);
    await db.exec(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT UNIQUE,
         applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       );`,
    );

    const alreadyApplied = await db.query(
      `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE name = ?1`,
      [body.name],
    );
    if (alreadyApplied.rowCount > 0) {
      fail(409, `Migration "${body.name}" has already been applied.`);
    }

    await db.exec(sql);
    await db.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?1)`, [body.name]);

    c.executionCtx.waitUntil(
      recordAudit(c.env, {
        action: "d1.migrate",
        binding: bindingName,
        detail: `applied ${body.name}`,
        undo: null,
      }),
    );

    return c.json({ applied: body.name });
  });
