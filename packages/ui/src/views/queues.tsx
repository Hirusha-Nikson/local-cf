"use client";

import { useEffect, useState } from "react";
import { unwrap } from "../api";
import {
  BindingList,
  Button,
  Card,
  Empty,
  ErrorNote,
  Spinner,
  Tag,
  Textarea,
} from "../components/primitives";
import { useAction } from "../hooks";
import { useBindings, useStudio } from "../studio-context";

export function QueuesView() {
  const { client } = useStudio();
  const producers = useBindings("queue_producer");
  const consumers = useBindings("queue_consumer");
  const [binding, setBinding] = useState<string | null>(null);
  const [message, setMessage] = useState('{\n  "kind": "demo",\n  "payload": {}\n}');
  const [sent, setSent] = useState<number>(0);

  useEffect(() => {
    if (!binding && producers[0]) setBinding(producers[0].binding);
  }, [producers, binding]);

  const send = useAction(async () => {
    if (!binding) return;
    let parsed: Record<string, unknown> | unknown[] | string;
    try {
      parsed = JSON.parse(message) as Record<string, unknown> | unknown[];
    } catch {
      // A queue message does not have to be JSON; fall back to the raw string.
      parsed = message;
    }
    await unwrap(
      await client.queues[":binding"].send.$post({
        param: { binding },
        json: { message: parsed, delaySeconds: undefined },
      }),
    );
    setSent((count) => count + 1);
  });

  if (producers.length === 0 && consumers.length === 0) {
    return <Empty>No queues are declared in your wrangler config.</Empty>;
  }

  const selected = producers.find((item) => item.binding === binding);

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-200 md:border-b-0 md:border-r dark:border-zinc-800">
        <BindingList
          bindings={producers}
          selected={binding}
          onSelect={setBinding}
          describe={(item) => item.queueName}
        />
      </aside>

      <div className="min-w-0 space-y-4 p-4">
        {selected?.fidelity === "unsupported" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-amber-800 dark:text-amber-400">{selected.note}</p>
          </div>
        )}

        <Card
          title="Send a message"
          actions={
            <Button
              variant="primary"
              disabled={!binding || send.pending || selected?.fidelity === "unsupported"}
              onClick={() => send.run()}
            >
              {send.pending ? <Spinner /> : null}
              Send
            </Button>
          }
        >
          <div className="space-y-3 p-4">
            <Textarea
              rows={8}
              spellCheck={false}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            {send.error && <ErrorNote title="Send failed" detail={send.error} />}
            {sent > 0 && !send.error && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Sent {sent} message{sent === 1 ? "" : "s"} this session. Watch the Logs tab to see
                your consumer pick them up.
              </p>
            )}
            <p className="text-xs text-zinc-500">
              Valid JSON is sent as a structured message; anything else is sent as a string.
            </p>
          </div>
        </Card>

        <Card title={`Consumers (${consumers.length})`}>
          {consumers.length === 0 ? (
            <Empty>No consumers declared. Messages will queue up unconsumed.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {consumers.map((consumer) => (
                <li key={consumer.queueName} className="space-y-1 px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{consumer.queueName}</span>
                    {consumer.maxBatchSize !== undefined && (
                      <Tag>batch ≤ {consumer.maxBatchSize}</Tag>
                    )}
                    {consumer.deadLetterQueue && <Tag>DLQ: {consumer.deadLetterQueue}</Tag>}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800">
            Dead-letter queue contents and retry controls are not implemented yet — the runtime does
            not expose in-flight queue depth to another worker. The DLQ name above comes from your
            config.
          </p>
        </Card>
      </div>
    </div>
  );
}
