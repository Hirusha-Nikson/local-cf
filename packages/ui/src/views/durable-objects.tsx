"use client";

import { useEffect, useState } from "react";
import { unwrap } from "../api";
import {
  BindingList,
  Button,
  Callout,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Select,
  SplitView,
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

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
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
    <SplitView
      sidebar={
        <BindingList
          bindings={bindings}
          selected={binding}
          onSelect={setBinding}
          describe={(item) => item.className}
          label="Namespaces"
        />
      }
    >
      {unavailable && (
        <Callout
          tone="warn"
          title={`Durable Objects are not reachable in ${meta?.mode === "attach" ? "attach" : "remote"} mode`}
        >
          {selected?.note}
        </Callout>
      )}

      <Card title="Instance">
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Field label="Name (idFromName)">
                <Input
                  className="font-mono"
                  value={instanceName}
                  onChange={(event) => setInstanceName(event.target.value)}
                />
              </Field>
            </div>
            <Button disabled={unavailable || resolve.pending} onClick={() => resolve.run()}>
              Resolve id
            </Button>
          </div>

          {resolvedId && (
            <p className="rounded-lg px-3 py-2 font-mono text-sm break-all ring ring-line bg-recessed">
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
        footer={
          <>
            The runtime has no API for reading another Durable Object&rsquo;s storage, so this
            inspector talks to the instance instead. Give your class a route like{" "}
            <code className="font-mono">/debug</code> that dumps{" "}
            <code className="font-mono">ctx.storage.list()</code> and it becomes browsable here.
          </>
        }
      >
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Select
              value={method}
              aria-label="HTTP method"
              onChange={(event) => setMethod(event.target.value)}
            >
              {["GET", "POST", "PUT", "DELETE"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Input
              className="min-w-48 flex-1 font-mono"
              aria-label="Request path"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/debug"
            />
          </div>

          {method !== "GET" && method !== "HEAD" && (
            <Field label="Request body">
              <Input
                className="font-mono"
                value={requestBody}
                onChange={(event) => setRequestBody(event.target.value)}
              />
            </Field>
          )}

          {send.error && <ErrorNote title="Request failed" detail={send.error} />}

          {result && (
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-2">
                <Tag
                  className={
                    result.status < 400
                      ? "text-success ring-success/30"
                      : "text-danger ring-danger/30"
                  }
                >
                  {result.status}
                </Tag>
                <Tag>{result.durationMs}ms</Tag>
              </p>
              <pre className="max-h-96 overflow-auto rounded-lg px-4 py-3 font-mono text-sm ring ring-line bg-recessed">
                {prettyJson(result.body)}
              </pre>
            </div>
          )}
        </div>
      </Card>
    </SplitView>
  );
}