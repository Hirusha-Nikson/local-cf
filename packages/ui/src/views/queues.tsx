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
  SplitView,
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
  const [message, setMessage] = useState('{\n  "kind": "demo",\n  "payload": {}\n}');
  const [sent, setSent] = useState(0);

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
  const unavailable = selected?.fidelity === "unsupported";

  return (
    <SplitView
      sidebar={
        producers.length > 0 ? (
          <BindingList
            bindings={producers}
            selected={binding}
            onSelect={setBinding}
            describe={(item) => item.queueName}
          />
        ) : (
          <p className="p-4 text-xs text-zinc-500">No producer bindings.</p>
        )
      }
    >
      {unavailable && <Callout tone="warn">{selected?.note}</Callout>}

      <Card
        title="Send a message"
        actions={
          <Button
            variant="primary"
            disabled={!binding || send.pending || unavailable}
            onClick={() => send.run()}
          >
            {send.pending ? <Spinner /> : null}
            Send
          </Button>
        }
        footer="Valid JSON is sent as a structured message; anything else is sent as a string."
      >
        <div className="space-y-3 p-4">
          <Textarea
            rows={9}
            spellCheck={false}
            aria-label="Message body"
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
        </div>
      </Card>

      <Card
        title={`Consumers (${consumers.length})`}
        footer="Dead-letter queue contents and retry controls are not implemented — the runtime does not expose in-flight queue depth to another worker. The DLQ name below comes from your config."
      >
        {consumers.length === 0 ? (
          <Empty>No consumers declared. Messages will queue up unconsumed.</Empty>
        ) : (
          <ul className="divide-y hairline">
            {consumers.map((consumer) => (
              <li key={consumer.queueName} className="px-4 py-3">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{consumer.queueName}</span>
                  {consumer.maxBatchSize !== undefined && <Tag>batch ≤ {consumer.maxBatchSize}</Tag>}
                  {consumer.deadLetterQueue && <Tag>DLQ: {consumer.deadLetterQueue}</Tag>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </SplitView>
  );
}