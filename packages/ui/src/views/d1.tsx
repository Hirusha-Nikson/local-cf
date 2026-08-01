"use client";

import type { D1MigrationFile } from "@local-cf/core/types";
import { useEffect, useState } from "react";
import { unwrap } from "../api";
import {
  BindingList,
  Button,
  Card,
  DataTable,
  Empty,
  ErrorNote,
  Spinner,
  Tag,
  Textarea,
} from "../components/primitives";
import { useAction, useAsync } from "../hooks";
import { useBindings, useStudio } from "../studio-context";

interface TableInfo {
  name: string;
  type: string;
  sql: string | null;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  durationMs: number;
}

type Panel = "browse" | "query" | "migrations";

export function D1View() {
  const { client, baseUrl } = useStudio();
  const bindings = useBindings("d1");
  const [binding, setBinding] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("browse");

  useEffect(() => {
    if (!binding && bindings[0]) setBinding(bindings[0].binding);
  }, [bindings, binding]);

  if (bindings.length === 0) {
    return <Empty>No D1 databases are declared in your wrangler config.</Empty>;
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-200 md:border-b-0 md:border-r dark:border-zinc-800">
        <BindingList
          bindings={bindings}
          selected={binding}
          onSelect={(next) => setBinding(next)}
          describe={(item) => item.databaseName}
        />
      </aside>

      <div className="min-w-0 space-y-4 p-4">
        <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          {(["browse", "query", "migrations"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPanel(item)}
              className={
                panel === item
                  ? "border-b-2 border-orange-500 px-3 py-2 text-sm font-medium text-orange-600 dark:text-orange-400"
                  : "border-b-2 border-transparent px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }
            >
              {item === "browse" ? "Tables" : item === "query" ? "SQL editor" : "Migrations"}
            </button>
          ))}
        </nav>

        {binding && panel === "browse" && (
          <TableBrowser key={`${binding}-browse`} binding={binding} baseUrl={baseUrl} client={client} />
        )}
        {binding && panel === "query" && <SqlEditor key={`${binding}-sql`} binding={binding} client={client} />}
        {binding && panel === "migrations" && (
          <Migrations key={`${binding}-mig`} binding={binding} client={client} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TableBrowser({
  binding,
  baseUrl,
  client,
}: {
  binding: string;
  baseUrl: string;
  client: ReturnType<typeof useStudio>["client"];
}) {
  const [table, setTable] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const pageSize = 50;

  const tables = useAsync(
    async () =>
      unwrap<{ tables: TableInfo[] }>(
        await client.d1[":binding"].tables.$get({ param: { binding } }),
      ),
    [binding],
  );

  const rows = useAsync(async () => {
    if (!table) return null;
    return unwrap<{ columns: string[]; rows: unknown[][]; total: number }>(
      await client.d1[":binding"].tables[":table"].rows.$get({
        param: { binding, table },
        query: { limit: String(pageSize), offset: String(offset) },
      }),
    );
  }, [binding, table, offset]);

  useEffect(() => {
    if (!table && tables.data?.tables[0]) setTable(tables.data.tables[0].name);
  }, [tables.data, table]);

  if (tables.loading) return <Empty>Loading tables…</Empty>;
  if (tables.error) return <ErrorNote title="Could not list tables" detail={tables.error} />;
  if (!tables.data || tables.data.tables.length === 0) {
    return <Empty>This database has no tables yet. Apply a migration to create some.</Empty>;
  }

  const total = rows.data?.total ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tables.data.tables.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => {
              setTable(item.name);
              setOffset(0);
            }}
            className={
              item.name === table
                ? "rounded-md bg-orange-500/10 px-2.5 py-1 font-mono text-xs text-orange-700 dark:text-orange-400"
                : "rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }
          >
            {item.name}
          </button>
        ))}
      </div>

      {table && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <span className="font-mono">{table}</span>
              <Tag>{total} rows</Tag>
            </span>
          }
          actions={
            <>
              <a
                href={`${baseUrl}/d1/${encodeURIComponent(binding)}/export?table=${encodeURIComponent(table)}`}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Export CSV
              </a>
              <Button
                variant="ghost"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                disabled={offset + pageSize >= total}
                onClick={() => setOffset(offset + pageSize)}
              >
                Next
              </Button>
            </>
          }
        >
          {rows.error ? (
            <div className="p-4">
              <ErrorNote title="Query failed" detail={rows.error} />
            </div>
          ) : rows.loading ? (
            <Empty>Loading rows…</Empty>
          ) : (
            <DataTable
              columns={rows.data?.columns ?? []}
              rows={rows.data?.rows ?? []}
              emptyMessage="This table is empty."
            />
          )}
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SqlEditor({
  binding,
  client,
}: {
  binding: string;
  client: ReturnType<typeof useStudio>["client"];
}) {
  const [sql, setSql] = useState("SELECT name FROM sqlite_master WHERE type = 'table';");
  const [result, setResult] = useState<QueryResult | null>(null);

  const run = useAction(async () => {
    const response = await client.d1[":binding"].query.$post({
      param: { binding },
      json: { sql, params: [] },
    });
    setResult(await unwrap<QueryResult>(response));
  });

  return (
    <div className="space-y-3">
      <Card
        title="SQL"
        actions={
          <Button variant="primary" disabled={run.pending} onClick={() => run.run()}>
            {run.pending ? <Spinner /> : null}
            Run
          </Button>
        }
      >
        <div className="p-3">
          <Textarea
            rows={7}
            value={sql}
            spellCheck={false}
            onChange={(event) => setSql(event.target.value)}
            onKeyDown={(event) => {
              // Ctrl/Cmd+Enter is the near-universal "execute" chord in SQL tools.
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") run.run();
            }}
          />
          <p className="mt-2 text-xs text-zinc-500">
            One statement per run. Use the Migrations tab for multi-statement scripts.
            Press <kbd className="font-mono">Ctrl/⌘ + Enter</kbd> to execute.
          </p>
        </div>
      </Card>

      {run.error && <ErrorNote title="Query failed" detail={run.error} />}

      {result && (
        <Card
          title="Result"
          actions={
            <Tag>
              {result.rowCount} row{result.rowCount === 1 ? "" : "s"} · {result.durationMs}ms
            </Tag>
          }
        >
          <DataTable
            columns={result.columns}
            rows={result.rows}
            emptyMessage="Statement executed; no rows returned."
          />
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Migrations({
  binding,
  client,
}: {
  binding: string;
  client: ReturnType<typeof useStudio>["client"];
}) {
  const state = useAsync(
    async () =>
      unwrap<{ migrations: D1MigrationFile[]; migrationsDir: string }>(
        await client.d1[":binding"].migrations.$get({ param: { binding } }),
      ),
    [binding],
  );

  const apply = useAction(async (name: string) => {
    await unwrap(
      await client.d1[":binding"].migrations.apply.$post({
        param: { binding },
        json: { name },
      }),
    );
    state.reload();
  });

  if (state.loading) return <Empty>Loading migrations…</Empty>;
  if (state.error) return <ErrorNote title="Could not read migrations" detail={state.error} />;

  const migrations = state.data?.migrations ?? [];

  return (
    <div className="space-y-3">
      {apply.error && <ErrorNote title="Migration failed" detail={apply.error} />}
      <Card
        title="Migrations"
        actions={<Tag>{state.data?.migrationsDir}/</Tag>}
      >
        {migrations.length === 0 ? (
          <Empty>
            No .sql files found in {state.data?.migrationsDir}/. Create one to get started.
          </Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {migrations.map((migration) => (
              <li
                key={migration.name}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={
                      migration.applied
                        ? "size-2 rounded-full bg-emerald-500"
                        : "size-2 rounded-full bg-zinc-300 dark:bg-zinc-600"
                    }
                  />
                  <span className="font-mono text-sm">{migration.name}</span>
                </span>
                <span className="flex items-center gap-3">
                  {migration.applied ? (
                    <span className="text-xs text-zinc-500">applied {migration.appliedAt}</span>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={apply.pending}
                      onClick={() => apply.run(migration.name)}
                    >
                      Apply
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
