"use client";

import { useEffect, useState } from "react";
import { unwrap } from "../api";
import {
  BindingList,
  Button,
  Card,
  Empty,
  ErrorNote,
  Input,
  Select,
  Spinner,
  Tag,
} from "../components/primitives";
import { useAction } from "../hooks";
import { useBindings, useStudio } from "../studio-context";

interface FetchResult {
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * The DO view is deliberately an *addressing and probing* tool, not a storage
 * browser.
 *
 * workerd exposes no API for reading a third-party Durable Object's storage, so
 * a UI that claimed to show it would be lying. What we can honestly do is
 * resolve names to ids and send requests to a live instance — which is enough
 * to drive any debug endpoint the class chooses to expose.
 */
export function DurableObjectsView() {
  const { client, meta } = useStudio();
  const bindings = useBindings("durable_object");
  const [binding, setBinding] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("global");
  const [path, setPath] = useState("/debug");
  const [method, setMethod] = useState("GET");
  const [requestBody, setRequestBody] = useState("");
  const [result, setResult] = useState<FetchResult | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    if (!binding && bindings[0]) setBinding(bindings[0].binding);
  }, [bindings, binding]);

  const send = useAction(async () => {
    if (!binding) return;
    setResult(
      await unwrap<FetchResult>(
        await client.do[":binding"].fetch.$post({
          param: { binding },
          json: {
            name: instanceName,
            id: undefined,
            path,
            method,
            headers: {},
            body: method === "GET" || method === "HEAD" ? undefined : requestBody,
          },
        }),
      ),
    );
  });

  const resolve = useAction(async () => {
    if (!binding) return;
    const response = await unwrap<{ id: string }>(
      await client.do[":binding"].resolve.$post({
        param: { binding },
        json: { name: instanceName },
      }),
    );
    setResolvedId(response.id);
  });

  if (bindings.length === 0) {
    return <Empty>No Durable Object bindings are declared in your wrangler config.</Empty>;
  }

  const selected = bindings.find((item) => item.binding === binding);
  const unavailable = selected?.fidelity === "unsupported";

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-200 md:border-b-0 md:border-r dark:border-zinc-800">
        <BindingList
          bindings={bindings}
          selected={binding}
          onSelect={setBinding}
          describe={(item) => item.className}
        />
      </aside>

      <div className="min-w-0 space-y-4 p-4">
        {unavailable && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-300">
              Durable Objects are not reachable in {meta?.mode === "attach" ? "attach" : "remote"} mode
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-400">{selected?.note}</p>
          </div>
        )}

        <Card title="Instance">
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-48 flex-1">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Name (idFromName)
                </span>
                <Input
                  className="font-mono"
                  value={instanceName}
                  onChange={(event) => setInstanceName(event.target.value)}
                />
              </label>
              <Button disabled={unavailable || resolve.pending} onClick={() => resolve.run()}>
                Resolve id
              </Button>
            </div>
            {resolvedId && (
              <p className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {resolvedId}
              </p>
            )}
            {resolve.error && <ErrorNote title="Could not resolve" detail={resolve.error} />}
          </div>
        </Card>

        <Card
          title="Send a request to this instance"
          actions={
            <Button variant="primary" disabled={unavailable || send.pending} onClick={() => send.run()}>
              {send.pending ? <Spinner /> : null}
              Send
            </Button>
          }
        >
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-3">
              <Select value={method} onChange={(event) => setMethod(event.target.value)}>
                {["GET", "POST", "PUT", "DELETE"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
              <Input
                className="min-w-48 flex-1 font-mono"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/debug"
              />
            </div>

            {method !== "GET" && method !== "HEAD" && (
              <Input
                className="font-mono"
                value={requestBody}
                onChange={(event) => setRequestBody(event.target.value)}
                placeholder="Request body"
              />
            )}

            <p className="text-xs text-zinc-500">
              The runtime has no API for reading another Durable Object&rsquo;s storage, so this
              inspector talks to the instance instead. Give your class a route like{" "}
              <code className="font-mono">/debug</code> that dumps{" "}
              <code className="font-mono">ctx.storage.list()</code> and it becomes browsable here.
            </p>

            {send.error && <ErrorNote title="Request failed" detail={send.error} />}

            {result && (
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <Tag>{result.status}</Tag>
                  <Tag>{result.durationMs}ms</Tag>
                </p>
                <pre className="max-h-96 overflow-auto rounded-md bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(result.body), null, 2);
                    } catch {
                      return result.body;
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
