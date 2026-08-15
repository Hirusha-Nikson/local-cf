"use client";

import type { BindingFidelity, D1MigrationFile } from "@local-cf/core/types";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { unwrap } from "../api";
import {
  Button,
  Card,
  DataTable,
  Empty,
  ErrorNote,
  FidelityBadge,
  Skeleton,
  SkeletonList,
  SkeletonTable,
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
  const [table, setTable] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("browse");

  useEffect(() => {
    if (!binding && bindings[0]) setBinding(bindings[0].binding);
  }, [bindings, binding]);

  /*
   * The table list is fetched here rather than inside the browser panel because
   * the navigation tree and the panel both read it, and they have to agree on
   * which table is selected.
   */
  const tables = useAsync(async () => {
    if (!binding) return null;
    return unwrap<{ tables: TableInfo[] }>(
      await client.d1[":binding"].tables.$get({ param: { binding } }),
    );
  }, [binding]);

  // Fall back to the first table whenever the current one is not in this database.
  useEffect(() => {
    const names = tables.data?.tables.map((item) => item.name) ?? [];
    setTable((current) => (current && names.includes(current) ? current : (names[0] ?? null)));
  }, [tables.data]);

  if (bindings.length === 0) {
    return <Empty>No D1 databases are declared in your wrangler config.</Empty>;
  }

  return (
    <SplitView
      sidebar={
        <DatabaseNav
          bindings={bindings}
          binding={binding}
          onSelectBinding={(next) => {
            setBinding(next);
            setTable(null);
          }}
          tables={tables.data?.tables ?? []}
          tablesLoading={tables.loading}
          table={table}
          onSelectTable={(next) => {
            setTable(next);
            // Picking a table is a request to see it.
            setPanel("browse");
          }}
        />
      }
    >
      <Tabs tabs={PANELS} active={panel} onSelect={setPanel} />

      {binding && panel === "browse" && (
        <TableBrowser
          key={`${binding}-${table ?? "none"}`}
          binding={binding}
          table={table}
          baseUrl={baseUrl}
          client={client}
          loading={tables.loading}
          error={tables.error}
        />
      )}
      {binding && panel === "query" && <SqlEditor key={`${binding}-sql`} binding={binding} client={client} />}
      {binding && panel === "migrations" && (
        <Migrations key={`${binding}-mig`} binding={binding} client={client} />
      )}
    </SplitView>
  );
}

/* -------------------------------------------------------------------------- */

interface D1Binding {
  binding: string;
  databaseName: string;
  fidelity: BindingFidelity;
  note?: string;
}

/**
 * Databases, each expanding to its own tables.
 *
 * D1 is the only binding kind with a second level worth navigating, so this
 * lives here rather than complicating the shared `BindingList` that KV, R2,
 * Durable Objects and Queues all use.
 */
function DatabaseNav({
  bindings,
  binding,
  onSelectBinding,
  tables,
  tablesLoading,
  table,
  onSelectTable,
}: {
  bindings: D1Binding[];
  binding: string | null;
  onSelectBinding: (binding: string) => void;
  tables: TableInfo[];
  tablesLoading: boolean;
  table: string | null;
  onSelectTable: (table: string) => void;
}) {
  /*
   * Collapsing is tracked separately from selection. Deriving "open" from the
   * selected binding alone means clicking the open database just re-selects it
   * and it can never be closed — so this records the ones explicitly collapsed,
   * and selecting a different database always reopens it.
   */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (name: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <nav className="p-2">
      <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-fg-subtle">Databases</p>

      {bindings.map((item) => {
        const isSelected = item.binding === binding;
        const isOpen = isSelected && !collapsed.has(item.binding);
        return (
          <div key={item.binding}>
            <button
              type="button"
              onClick={() => {
                if (isSelected) {
                  toggle(item.binding);
                  return;
                }
                onSelectBinding(item.binding);
                setCollapsed((current) => {
                  const next = new Set(current);
                  next.delete(item.binding);
                  return next;
                });
              }}
              aria-expanded={isOpen}
              className={cx(
                "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 pl-1 text-left",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                isSelected ? "bg-tint" : "hover:bg-tint",
              )}
            >
              {/* Transform, not colour — rotation is the one transition the rules allow. */}
              <ChevronRight
                aria-hidden="true"
                strokeWidth={1.75}
                className={cx(
                  "size-3.5 shrink-0 text-fg-muted transition-transform",
                  isOpen && "rotate-90",
                )}
              />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-fg-strong">
                  {item.databaseName}
                </span>
                <FidelityBadge fidelity={item.fidelity} title={item.note} />
              </span>
            </button>

            {isOpen && (
              /*
               * Each row carries its own left border, so together they draw one
               * continuous trunk under the chevron — and the selected row simply
               * turns its own segment orange instead of needing a second rail.
               * `ml-[11px]` centres the trunk on the 14px chevron above it.
               */
              <ul className="mt-0.5 mb-1 ml-[11px]">
                {tablesLoading ? (
                  Array.from({ length: 3 }).map((_, row) => (
                    <li key={row} className="border-l py-1.5 pl-3 hairline">
                      <Skeleton className="h-3.5" style={{ width: `${50 + row * 15}%` }} />
                    </li>
                  ))
                ) : tables.length === 0 ? (
                  <li className="border-l py-1 pl-3 text-sm text-fg-subtle hairline">
                    No tables yet
                  </li>
                ) : (
                  tables.map((item) => {
                    const selected = item.name === table;
                    return (
                      <li
                        key={item.name}
                        className={cx("border-l", selected ? "border-orange-500" : "hairline")}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectTable(item.name)}
                          aria-current={selected ? "true" : undefined}
                          className={cx(
                            "flex w-full items-center rounded-r-md py-1 pr-2 pl-3 text-left font-mono text-sm",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                            selected
                              ? "bg-orange-500/10 font-medium text-orange-700 dark:text-orange-400"
                              : "text-fg hover:bg-tint",
                          )}
                        >
                          <span className="truncate">{item.name}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */

function TableBrowser({
  binding,
  table,
  baseUrl,
  client,
  loading,
  error,
}: {
  binding: string;
  table: string | null;
  baseUrl: string;
  client: ReturnType<typeof useStudio>["client"];
  loading: boolean;
  error: string | null;
}) {
  const [offset, setOffset] = useState(0);
  const pageSize = 50;

  const rows = useAsync(async () => {
    if (!table) return null;
    return unwrap<{ columns: string[]; rows: unknown[][]; total: number }>(
      await client.d1[":binding"].tables[":table"].rows.$get({
        param: { binding, table },
        query: { limit: String(pageSize), offset: String(offset) },
      }),
    );
  }, [binding, table, offset]);

  if (loading) return <SkeletonList rows={6} />;
  if (error) return <ErrorNote title="Could not list tables" detail={error} />;
  if (!table) {
    return <Empty>This database has no tables yet. Apply a migration to create some.</Empty>;
  }

  const total = rows.data?.total ?? 0;
  const showing = rows.data?.rows.length ?? 0;

  return (
    <div className="space-y-4">
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
                className="inline-flex h-7 items-center rounded-md bg-surface px-2 text-xs font-medium text-fg ring ring-line hover:bg-tint"
              >
                Export CSV
              </a>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
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
            <div className="px-5 py-4">
              <ErrorNote title="Query failed" detail={rows.error} />
            </div>
          ) : rows.loading ? (
            <SkeletonTable columns={Math.max(rows.data?.columns.length ?? 4, 4)} rows={8} />
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
            <kbd className="rounded-md px-1 font-mono text-[0.9em] ring ring-line">
              Ctrl/⌘ + Enter
            </kbd>{" "}
            to execute.
          </>
        }
      >
        <div className="px-4 py-3">
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

  if (state.loading) return <SkeletonList rows={4} />;
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
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "size-2 shrink-0 rounded-full",
                      migration.applied ? "bg-success" : "bg-fill",
                    )}
                  />
                  <span className="truncate font-mono text-sm">{migration.name}</span>
                </span>
                {migration.applied ? (
                  <span className="text-sm text-fg-subtle">applied {migration.appliedAt}</span>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
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