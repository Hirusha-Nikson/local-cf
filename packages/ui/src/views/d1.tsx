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
  SplitView,
  Spinner,
  Tabs,
  Tag,
  Textarea,
  cx,
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

const PANELS: { id: Panel; label: string }[] = [
  { id: "browse", label: "Tables" },
  { id: "query", label: "SQL editor" },
  { id: "migrations", label: "Migrations" },
];

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
    <SplitView
      sidebar={
        <BindingList
          bindings={bindings}
          selected={binding}
          onSelect={setBinding}
          describe={(item) => item.databaseName}
        />
      }
    >
      <Tabs tabs={PANELS} active={panel} onSelect={setPanel} />

      {binding && panel === "browse" && (
        <TableBrowser key={`${binding}-browse`} binding={binding} baseUrl={baseUrl} client={client} />
      )}
      {binding && panel === "query" && <SqlEditor key={`${binding}-sql`} binding={binding} client={client} />}
      {binding && panel === "migrations" && (
        <Migrations key={`${binding}-mig`} binding={binding} client={client} />
      )}
    </SplitView>
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
  const showing = rows.data?.rows.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {tables.data.tables.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => {
              setTable(item.name);
              setOffset(0);
            }}
            className={cx(
              "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              item.name === table
                ? "border-orange-300 bg-orange-50 font-medium text-orange-800 dark:border-orange-900/60 dark:bg-orange-500/10 dark:text-orange-400"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
            )}
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
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Export CSV
              </a>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                disabled={offset + pageSize >= total}
                onClick={() => setOffset(offset + pageSize)}
              >
                Next
              </Button>
            </>
          }
          footer={
            showing > 0
              ? `Rows ${offset + 1}–${offset + showing} of ${total}`
              : undefined
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
    <div className="space-y-4">
      <Card
        title="SQL"
        actions={
          <Button variant="primary" disabled={run.pending} onClick={() => run.run()}>
            {run.pending ? <Spinner /> : null}
            Run
          </Button>
        }
        footer={
          <>
            One statement per run — use the Migrations tab for multi-statement scripts. Press{" "}
            <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-600">
              Ctrl/⌘ + Enter
            </kbd>{" "}
            to execute.
          </>
        }
      >
        <div className="p-3">
          <Textarea
            rows={8}
            value={sql}
            spellCheck={false}
            aria-label="SQL query"
            onChange={(event) => setSql(event.target.value)}
            onKeyDown={(event) => {
              // Ctrl/Cmd+Enter is the near-universal "execute" chord in SQL tools.
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") run.run();
            }}
          />
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
  const pending = migrations.filter((migration) => !migration.applied).length;

  return (
    <div className="space-y-4">
      {apply.error && <ErrorNote title="Migration failed" detail={apply.error} />}

      <Card
        title="Migrations"
        actions={
          <>
            <Tag>{state.data?.migrationsDir}/</Tag>
            {pending > 0 && <Tag>{pending} pending</Tag>}
          </>
        }
        footer="Applied migrations are tracked in the d1_migrations table, the same convention Wrangler uses."
      >
        {migrations.length === 0 ? (
          <Empty>
            No .sql files found in {state.data?.migrationsDir}/. Create one to get started.
          </Empty>
        ) : (
          <ul className="divide-y hairline">
            {migrations.map((migration) => (
              <li
                key={migration.name}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "size-2 shrink-0 rounded-full",
                      migration.applied ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600",
                    )}
                  />
                  <span className="truncate font-mono text-sm">{migration.name}</span>
                </span>
                {migration.applied ? (
                  <span className="text-xs text-zinc-500">applied {migration.appliedAt}</span>
                ) : (
                  <Button
                    variant="primary"
                    className="px-2.5 py-1 text-xs"
                    disabled={apply.pending}
                    onClick={() => apply.run(migration.name)}
                  >
                    Apply
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}