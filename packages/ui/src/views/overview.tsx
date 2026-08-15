"use client";

import type { AnyBinding, AuditEntry, LogEntry, StudioMode } from "@local-cf/core/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrap } from "../api";
import {
  Callout,
  Card,
  Empty,
  FidelityBadge,
  ModeBadge,
  Skeleton,
  SkeletonList,
  Spinner,
  Tag,
  cx,
} from "../components/primitives";
import { useAsync, useInterval } from "../hooks";
import { useStudio } from "../studio-context";

/**
 * SETUP.md §1 and §3 both insist the Mode A / Mode B distinction be surfaced
 * rather than papered over. This banner is that commitment: it states what the
 * current mode actually guarantees, in the same words for every user.
 */
const MODE_COPY: Record<
  StudioMode,
  { title: string; body: string; tone: "success" | "warn" | "info" }
> = {
  own: {
    title: "Shared runtime (Mode A)",
    body:
      "The studio runs inside the same workerd process as your worker and holds the same binding objects. " +
      "Durable Object memory, in-flight queue messages and un-flushed writes are all visible live.",
    tone: "success",
  },
  attach: {
    title: "Attached (Mode B)",
    body:
      "Your dev server owns the runtime, so the studio reads the same persist directory in a separate process. " +
      "D1, KV and R2 are shared through files; Durable Object memory and in-flight queue messages are not.",
    tone: "warn",
  },
  remote: {
    title: "Remote (Mode C)",
    body:
      "Every read and write goes to your real Cloudflare account through the REST API. " +
      "There is no local runtime, so Durable Objects and Queues are not browsable.",
    tone: "info",
  },
};

const KIND_LABEL: Record<AnyBinding["kind"], string> = {
  d1: "D1 database",
  kv: "KV namespace",
  r2: "R2 bucket",
  durable_object: "Durable Object",
  queue_producer: "Queue producer",
  queue_consumer: "Queue consumer",
  vectorize: "Vectorize index",
  ai: "Workers AI",
  hyperdrive: "Hyperdrive",
  analytics_engine: "Analytics Engine",
  service: "Service binding",
  var: "Var",
};

const KIND_ORDER: AnyBinding["kind"][] = [
  "d1",
  "kv",
  "r2",
  "durable_object",
  "queue_producer",
  "queue_consumer",
  "vectorize",
  "ai",
  "hyperdrive",
  "analytics_engine",
  "service",
  "var",
];

function describeTimeAgo(timestamp: number | null): string {
  if (!timestamp) return "waiting";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Flat stat tile: sentence-case label, big number, no shadow or gradient. The
 * label sits tight against its value because they are one thought; the detail
 * line is what gets the extra breathing room.
 */
function StatTile({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-lg bg-surface px-5 py-4 ring ring-line">
      <p className="text-sm text-fg-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg-strong">{value}</p>
      {detail && <p className="mt-2 text-sm text-fg-subtle">{detail}</p>}
    </div>
  );
}

function ActivityItem({
  tone,
  title,
  detail,
  meta,
}: {
  tone: "info" | "warn" | "success";
  title: string;
  detail?: string;
  meta?: string;
}) {
  const dot =
    tone === "success" ? "bg-success" : tone === "warn" ? "bg-warning" : "bg-link";

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      {/* h-lh keeps the dot centred on the first line when the title wraps. */}
      <span className="flex h-lh shrink-0 items-center">
        <span className={cx("size-2 rounded-full", dot)} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg-strong">{title}</p>
        {detail && <p className="mt-0.5 text-sm break-words text-fg-subtle">{detail}</p>}
        {meta && <p className="mt-0.5 text-sm text-fg-muted">{meta}</p>}
      </div>
    </li>
  );
}

function describeTarget(binding: AnyBinding): string {
  switch (binding.kind) {
    case "d1":
      return binding.databaseName;
    case "kv":
      return binding.namespaceId;
    case "r2":
      return binding.bucketName;
    case "durable_object":
      return binding.className;
    case "queue_producer":
    case "queue_consumer":
      return binding.queueName;
    default:
      return binding.target ?? "—";
  }
}

function kindTone(fidelity: AnyBinding["fidelity"]): "success" | "warn" | "info" | "muted" {
  switch (fidelity) {
    case "live":
      return "success";
    case "disk":
      return "warn";
    case "remote":
      return "info";
    case "unsupported":
      return "muted";
  }
}

export function OverviewView() {
  const { client, meta, loading, syncing, lastUpdatedAt, error } = useStudio();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logCursor, setLogCursor] = useState(0);
  const [logError, setLogError] = useState<string | null>(null);

  const audit = useAsync(async () => unwrap<{ entries: AuditEntry[] }>(await client.audit.$get()), [client]);

  const pollLogs = useCallback(async () => {
    try {
      const page = await unwrap<{ entries: LogEntry[]; cursor: number }>(
        await client.logs.$get({ query: { since: String(logCursor) } }),
      );
      if (page.entries.length > 0) {
        setLogEntries((previous) => [...previous, ...page.entries].slice(-6));
        setLogCursor(page.cursor);
      }
      setLogError(null);
    } catch (cause: unknown) {
      setLogError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [client, logCursor]);

  useEffect(() => {
    void pollLogs();
    // The interval below handles the recurring refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInterval(() => void pollLogs(), 3000);
  useInterval(() => audit.reload(), 5000);

  const storageBindings = useMemo(() => meta?.bindings.filter((binding) => binding.kind !== "var") ?? [], [meta]);
  const variableBindings = useMemo(() => meta?.bindings.filter((binding) => binding.kind === "var") ?? [], [meta]);
  const browsableBindings = useMemo(
    () => storageBindings.filter((binding) => binding.fidelity !== "unsupported"),
    [storageBindings],
  );
  const fidelityCounts = useMemo(
    () =>
      storageBindings.reduce(
        (counts, binding) => {
          counts[binding.fidelity] += 1;
          return counts;
        },
        { live: 0, disk: 0, remote: 0, unsupported: 0 } as Record<AnyBinding["fidelity"], number>,
      ),
    [storageBindings],
  );

  const bindingRows = useMemo(
    () =>
      KIND_ORDER.map((kind) => {
        const items = meta?.bindings.filter((binding) => binding.kind === kind) ?? [];
        if (items.length === 0) return null;
        const liveCount = items.filter((binding) => binding.fidelity === "live").length;
        const unavailableCount = items.filter((binding) => binding.fidelity === "unsupported").length;
        return {
          kind,
          count: items.length,
          liveCount,
          unavailableCount,
          sample: describeTarget(items[0]!),
          tone: kindTone(items[0]!.fidelity),
        };
      }).filter((value): value is NonNullable<typeof value> => value !== null),
    [meta],
  );

  if (loading) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-4 w-full max-w-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg bg-surface px-5 py-4 ring ring-line">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="mt-2.5 h-7 w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="p-4 md:p-6">
        <Card title="Not connected">
          <div className="space-y-2 px-5 py-4 text-sm text-fg-subtle">
            <p>{error ?? "No studio metadata available."}</p>
            <p>
              Start it with{" "}
              {/* Monospace runs large next to body text; 0.9em evens them out. */}
              <code className="rounded-md bg-recessed px-1.5 py-0.5 font-mono text-[0.9em] text-fg">
                npx local-cf
              </code>{" "}
              in your worker&rsquo;s directory, then reload this page.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const mode = MODE_COPY[meta.mode];
  const lastSyncText = syncing ? "Syncing now" : `Updated ${describeTimeAgo(lastUpdatedAt)}`;

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      {error && (
        <Callout tone="warn" title="Background refresh stalled">
          {error}
          {" "}
          The dashboard is still showing the last known state.
        </Callout>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ModeBadge mode={meta.mode} />
          <Tag>{lastSyncText}</Tag>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-fg-subtle">{mode.body}</p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Bindings" value={storageBindings.length} detail="declared in wrangler config" />
          <StatTile label="Live" value={fidelityCounts.live} detail="same runtime state" />
          <StatTile label="Browsable" value={browsableBindings.length} detail="ready to inspect now" />
          <StatTile label="Vars" value={variableBindings.length} detail="config values only" />
        </div>
      </section>

      {meta.warnings.length > 0 && (
        <Callout tone="warn" title="Configuration warnings">
          <ul className="space-y-1">
            {meta.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card title={`Binding health (${storageBindings.length})`}>
          {storageBindings.length === 0 ? (
            <Empty>No storage bindings declared in your wrangler config.</Empty>
          ) : (
            <ul className="divide-y hairline">
              {bindingRows.map((row) => (
                <li key={row.kind} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg-strong">{KIND_LABEL[row.kind]}</p>
                    <p className="mt-0.5 text-sm text-fg-subtle">{row.sample}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>{row.count}</Tag>
                    <Tag>{row.liveCount} live</Tag>
                    {row.unavailableCount > 0 && <Tag>{row.unavailableCount} unavailable</Tag>}
                    <FidelityBadge
                      fidelity={row.tone === "success" ? "live" : row.tone === "warn" ? "disk" : row.tone === "info" ? "remote" : "unsupported"}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card
            title="Live activity"
            actions={syncing ? <Spinner className="text-fg-subtle" /> : <Tag>{lastSyncText}</Tag>}
          >
            {logError && (
              <div className="border-b px-5 py-2 text-sm text-warning hairline">{logError}</div>
            )}
            {logEntries.length === 0 ? (
              <Empty>No log output yet. Make a request to your worker, or send a queue message.</Empty>
            ) : (
              <ul className="divide-y px-5 py-2 font-mono text-sm hairline">
                {logEntries.map((entry) => (
                  <li key={entry.seq} className="flex gap-3 py-2">
                    <span className="w-16 shrink-0 text-fg-muted">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                    {/* Uppercasing the level is data formatting, not a heading. */}
                    <span className="w-12 shrink-0 text-link uppercase">{entry.level}</span>
                    <span className="min-w-0 break-all text-fg">{entry.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent writes" actions={<Tag>{audit.data?.entries.length ?? 0} entries</Tag>}>
            {audit.loading ? (
              <SkeletonList rows={4} />
            ) : (audit.data?.entries.length ?? 0) === 0 ? (
              <Empty>No writes recorded yet.</Empty>
            ) : (
              <ul className="divide-y hairline">
                {audit.data?.entries.slice(0, 5).map((entry) => (
                  <ActivityItem
                    key={entry.seq}
                    tone={entry.undo ? "success" : "info"}
                    title={entry.action}
                    detail={`${entry.binding} · ${entry.detail}`}
                    meta={new Date(entry.ts).toLocaleTimeString()}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live writes" value={fidelityCounts.live} detail="fully shared with the worker" />
        <StatTile label="On disk" value={fidelityCounts.disk} detail="attached process persistence" />
        <StatTile label="Remote" value={fidelityCounts.remote} detail="Cloudflare REST API backed" />
        <StatTile label="Unavailable" value={fidelityCounts.unsupported} detail="not browsable in this mode" />
      </div>

      <Card title="Connection details">
        <dl className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-recessed px-4 py-3 ring ring-line">
            <dt className="text-sm text-fg-subtle">Config</dt>
            <dd className="mt-1 font-mono text-sm break-all text-fg">{meta.configPath ?? "—"}</dd>
          </div>
          <div className="rounded-lg bg-recessed px-4 py-3 ring ring-line">
            <dt className="text-sm text-fg-subtle">Persist root</dt>
            <dd className="mt-1 font-mono text-sm break-all text-fg">
              {meta.persistRoot ?? "Remote mode uses Cloudflare storage"}
            </dd>
          </div>
        </dl>
      </Card>

      {variableBindings.length > 0 && (
        <Card title={`Vars (${variableBindings.length})`}>
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {variableBindings.map((binding) => (
              <Tag key={binding.binding}>
                {binding.binding} = {"target" in binding ? binding.target : ""}
              </Tag>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}