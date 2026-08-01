"use client";

import type { AnyBinding, StudioMode } from "@local-cf/core/types";
import { Card, Empty, FidelityBadge, Tag } from "../components/primitives";
import { useStudio } from "../studio-context";

/**
 * SETUP.md §1 and §3 both insist the Mode A / Mode B distinction be surfaced
 * rather than papered over. This banner is that commitment: it states what the
 * current mode actually guarantees, in the same words for every user.
 */
const MODE_COPY: Record<StudioMode, { title: string; body: string; tone: string }> = {
  own: {
    title: "Shared runtime (Mode A)",
    body:
      "The studio runs inside the same workerd process as your worker and holds the same binding objects. " +
      "Durable Object memory, in-flight queue messages and un-flushed writes are all visible live.",
    tone: "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  },
  attach: {
    title: "Attached (Mode B)",
    body:
      "Your dev server owns the runtime, so the studio reads the same persist directory in a separate process. " +
      "D1, KV and R2 are shared through files; Durable Object memory and in-flight queue messages are not.",
    tone: "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  },
  remote: {
    title: "Remote (Mode C)",
    body:
      "Every read and write goes to your real Cloudflare account through the REST API. " +
      "There is no local runtime, so Durable Objects and Queues are not browsable.",
    tone: "border-sky-300 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30",
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

export function OverviewView() {
  const { meta, loading, error } = useStudio();

  if (loading) return <Empty>Connecting to local-cf…</Empty>;
  if (error || !meta) {
    return (
      <div className="p-6">
        <Card title="Not connected">
          <div className="space-y-2 p-4 text-sm text-zinc-600 dark:text-zinc-400">
            <p>{error ?? "No studio metadata available."}</p>
            <p>
              Start it with <code className="font-mono text-orange-600">npx local-cf</code> in your
              worker&rsquo;s directory, then reload this page.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const mode = MODE_COPY[meta.mode];
  const storage = meta.bindings.filter((binding) => binding.kind !== "var");
  const vars = meta.bindings.filter((binding) => binding.kind === "var");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className={`rounded-lg border px-4 py-3 ${mode.tone}`}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{mode.title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-700 dark:text-zinc-300">{mode.body}</p>
      </div>

      {meta.warnings.length > 0 && (
        <Card title="Configuration warnings">
          <ul className="space-y-1.5 p-4 text-sm text-amber-700 dark:text-amber-400">
            {meta.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Worker" className="lg:col-span-1">
          <dl className="space-y-2.5 p-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Name</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-100">{meta.workerName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Config</dt>
              <dd className="break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {meta.configPath ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Local state</dt>
              <dd className="break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {meta.persistRoot ?? "not applicable in remote mode"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Started</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">
                {new Date(meta.startedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title={`Bindings (${storage.length})`} className="lg:col-span-2">
          {storage.length === 0 ? (
            <Empty>No storage bindings declared in your wrangler config.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <th className="px-4 py-2 font-semibold">Binding</th>
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Target</th>
                    <th className="px-4 py-2 font-semibold">Fidelity</th>
                  </tr>
                </thead>
                <tbody>
                  {storage.map((binding) => (
                    <tr
                      key={`${binding.kind}:${binding.binding}`}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                    >
                      <td className="px-4 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                        {binding.binding}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {KIND_LABEL[binding.kind]}
                      </td>
                      <td className="px-4 py-2">
                        <Tag>{describeTarget(binding)}</Tag>
                      </td>
                      <td className="px-4 py-2">
                        <FidelityBadge fidelity={binding.fidelity} title={binding.note} />
                        {binding.note && (
                          <p className="mt-1 max-w-sm text-xs text-zinc-500">{binding.note}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {vars.length > 0 && (
        <Card title={`Vars (${vars.length})`}>
          <div className="flex flex-wrap gap-2 p-4">
            {vars.map((binding) => (
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
