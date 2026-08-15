"use client";

import type { AuditEntry } from "@local-cf/core/types";
import { useState } from "react";
import { unwrap } from "../api";
import { Button, Card, Empty, ErrorNote, Input, SkeletonList, Spinner, Tag } from "../components/primitives";
import { useAction, useAsync } from "../hooks";
import { useStudio } from "../studio-context";

interface Snapshot {
  name: string;
  createdAt: string;
}

/**
 * Snapshots and the audit log.
 *
 * Both are cheap precisely because Mode A and Mode B already persist to known
 * files (SETUP.md §3): a snapshot is a directory copy, and undo is a replayed
 * inverse recorded at write time.
 */
export function OperationsView() {
  const { client, meta } = useStudio();
  const [snapshotName, setSnapshotName] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);

  const audit = useAsync(
    async () => unwrap<{ entries: AuditEntry[] }>(await client.audit.$get()),
    [],
  );

  const snapshots = useAsync(
    async () => unwrap<{ snapshots: Snapshot[] }>(await client.snapshots.$get()),
    [],
  );

  const create = useAction(async () => {
    await unwrap(await client.snapshots.$post({ json: { name: snapshotName || undefined } }));
    setSnapshotName("");
    snapshots.reload();
  });

  const restore = useAction(async (name: string) => {
    await unwrap(await client.snapshots[":name"].restore.$post({ param: { name } }));

    /*
     * The server answers before it tears the runtime down, so the port goes
     * away for a moment. Poll until it answers again rather than showing the
     * user a connection error for something that is working as intended.
     */
    setRestoring(name);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const response = await client.meta.$get();
        if (response.ok) break;
      } catch {
        // Still down; keep waiting.
      }
    }
    setRestoring(null);
    audit.reload();
  });

  const remove = useAction(async (name: string) => {
    await unwrap(await client.snapshots[":name"].$delete({ param: { name } }));
    snapshots.reload();
  });

  const undo = useAction(async (seq: number) => {
    await unwrap(await client.audit[":seq"].undo.$post({ param: { seq: String(seq) } }));
    audit.reload();
  });

  const remoteMode = meta?.mode === "remote";

  return (
    <div className="grid gap-4 px-4 py-5 md:px-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Card
          title="Snapshots"
          actions={
            <>
              <Input
                className="w-40"
                placeholder="name (optional)"
                value={snapshotName}
                onChange={(event) => setSnapshotName(event.target.value)}
              />
              <Button
                variant="primary"
                disabled={remoteMode || create.pending}
                onClick={() => create.run()}
              >
                {create.pending ? <Spinner /> : null}
                Snapshot
              </Button>
            </>
          }
        >
          <div className="space-y-2 px-5 py-4">
            {remoteMode && (
              <p className="text-sm text-fg-subtle">
                Snapshots copy the local persist directory, so they do not apply in remote mode.
              </p>
            )}
            {(create.error || restore.error || remove.error) && (
              <ErrorNote
                title="Snapshot operation failed"
                detail={create.error ?? restore.error ?? remove.error}
              />
            )}

            {restoring && (
              <p className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2.5 text-sm text-warning ring ring-warning/30">
                <Spinner />
                Restoring &ldquo;{restoring}&rdquo; — the runtime is restarting…
              </p>
            )}

            {snapshots.loading ? (
              <SkeletonList rows={3} />
            ) : (snapshots.data?.snapshots.length ?? 0) === 0 ? (
              <Empty>No snapshots yet.</Empty>
            ) : (
              <ul className="divide-y hairline">
                {snapshots.data?.snapshots.map((snapshot) => (
                  <li
                    key={snapshot.name}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      <span className="font-mono text-sm">{snapshot.name}</span>
                      <span className="ml-2 text-sm text-fg-subtle">
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <Button
                        disabled={restore.pending}
                        onClick={() => restore.run(snapshot.name)}
                      >
                        Restore
                      </Button>
                      <Button variant="danger" onClick={() => remove.run(snapshot.name)}>
                        Delete
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm text-fg-subtle">
              Restoring stops the runtime, swaps the persist directory and starts it again — open
              connections and in-memory Durable Object state are lost by design.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Audit log"
        actions={<Button variant="ghost" onClick={() => audit.reload()}>Refresh</Button>}
      >
        {undo.error && (
          <div className="px-5 py-4">
            <ErrorNote title="Undo failed" detail={undo.error} />
          </div>
        )}

        {audit.loading ? (
          <SkeletonList rows={5} />
        ) : (audit.data?.entries.length ?? 0) === 0 ? (
          <Empty>
            No writes recorded yet. Every change made through this dashboard is logged here.
          </Empty>
        ) : (
          <ul className="max-h-[32rem] divide-y overflow-y-auto hairline">
            {audit.data?.entries.map((entry) => (
              <li key={entry.seq} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Tag>{entry.action}</Tag>
                    <span className="font-mono text-sm text-fg-subtle">
                      {entry.binding}
                    </span>
                    <span className="text-sm text-fg-muted">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                  </p>
                  <p className="mt-1 truncate font-mono text-sm text-fg-subtle">{entry.detail}</p>
                </div>
                {entry.undo && (
                  <Button
                    className="shrink-0"
                    disabled={undo.pending}
                    onClick={() => undo.run(entry.seq)}
                  >
                    Undo
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
