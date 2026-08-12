"use client";

import type { LogEntry } from "@local-cf/core/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { unwrap } from "../api";
import { Button, Card, Empty, Input, cx } from "../components/primitives";
import { useInterval } from "../hooks";
import { useStudio } from "../studio-context";

const LEVEL_STYLE: Record<LogEntry["level"], string> = {
  debug: "text-zinc-500",
  info: "text-zinc-700 dark:text-zinc-300",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

const LEVEL_CHIP: Record<LogEntry["level"], string> = {
  debug: "text-zinc-500",
  info: "text-sky-600 dark:text-sky-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

/**
 * Live log tail.
 *
 * The worker's console output is captured by Miniflare in the Node process, so
 * the dashboard reaches it via sidecar -> bridge. A monotonic cursor makes each
 * poll cheap and, unlike a stream through two hops, it recovers cleanly from a
 * dropped request.
 */
export function LogsView() {
  const { client } = useStudio();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const page = await unwrap<{ entries: LogEntry[]; cursor: number }>(
        await client.logs.$get({ query: { since: String(cursor) } }),
      );
      setError(null);
      if (page.entries.length > 0) {
        // Keep the buffer bounded so a chatty worker cannot grow the DOM forever.
        setEntries((previous) => [...previous, ...page.entries].slice(-1000));
        setCursor(page.cursor);
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [client, cursor]);

  useEffect(() => {
    void poll();
    // Only on mount: the interval below takes over from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInterval(() => void poll(), paused ? null : 1000);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries, paused]);

  const visible = filter
    ? entries.filter((entry) => entry.message.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <div className="p-4 md:p-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            Logs
            <span
              className={cx(
                "inline-flex items-center gap-1.5 text-xs font-normal",
                paused ? "text-zinc-500" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              <span
                className={cx(
                  "size-1.5 rounded-full",
                  paused ? "bg-zinc-400" : "animate-pulse bg-emerald-500",
                )}
              />
              {paused ? "Paused" : "Live"}
            </span>
          </span>
        }
        actions={
          <>
            <Input
              className="w-48"
              placeholder="Filter…"
              aria-label="Filter log messages"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <Button onClick={() => setPaused((value) => !value)}>
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="ghost" onClick={() => setEntries([])}>
              Clear
            </Button>
          </>
        }
        footer={`${visible.length} of ${entries.length} lines${filter ? " (filtered)" : ""}`}
      >
        {error && (
          <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        {visible.length === 0 ? (
          <Empty>No log output yet. Make a request to your worker, or send a queue message.</Empty>
        ) : (
          <div className="max-h-[calc(100vh-18rem)] overflow-auto px-4 py-2 font-mono text-xs leading-relaxed">
            {visible.map((entry) => (
              <p key={entry.seq} className="flex gap-3 py-px">
                <span className="w-20 shrink-0 text-zinc-400 dark:text-zinc-600">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
                <span className={cx("w-12 shrink-0 uppercase", LEVEL_CHIP[entry.level])}>
                  {entry.level}
                </span>
                <span className={cx("break-all whitespace-pre-wrap", LEVEL_STYLE[entry.level])}>
                  {entry.message}
                </span>
              </p>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </Card>
    </div>
  );
}