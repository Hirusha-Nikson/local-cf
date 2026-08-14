import type { LogEntry } from "@local-cf/core";
import type { Log, LogLevel } from "miniflare";
import type { MiniflareModule } from "./runtime.js";

const MAX_ENTRIES = 2000;

/**
 * Worker `console.*` output surfaces in the *Node* process, not inside workerd,
 * so the log tail has to live here and be polled by the sidecar through the
 * bridge.
 */
export class LogBuffer {
  #entries: LogEntry[] = [];
  #seq = 0;

  push(level: LogEntry["level"], source: LogEntry["source"], message: string): void {
    this.#seq += 1;
    this.#entries.push({ seq: this.#seq, ts: Date.now(), level, source, message });
    if (this.#entries.length > MAX_ENTRIES) {
      this.#entries.splice(0, this.#entries.length - MAX_ENTRIES);
    }
  }

  /** Everything after `since`, plus the cursor to poll with next time. */
  since(cursor: number): { entries: LogEntry[]; cursor: number } {
    const entries = this.#entries.filter((entry) => entry.seq > cursor);
    return { entries, cursor: this.#seq };
  }
}

function toLevel(levels: MiniflareModule["LogLevel"], level: LogLevel): LogEntry["level"] {
  switch (level) {
    case levels.ERROR:
      return "error";
    case levels.WARN:
      return "warn";
    case levels.DEBUG:
    case levels.VERBOSE:
      return "debug";
    default:
      return "info";
  }
}

/**
 * Build a Miniflare `Log` that tees into the buffer as well as the terminal.
 *
 * A factory rather than a top-level `class StudioLog extends Log`, because the
 * miniflare we run is resolved at startup — it may be the project's copy or our
 * bundled one. Miniflare validates this option with `z.instanceof(Log)`, so the
 * base class has to be the one belonging to the copy actually being started.
 */
export function createStudioLog(
  runtime: MiniflareModule,
  buffer: LogBuffer,
  level: LogLevel,
  quiet: boolean,
): Log {
  const { LogLevel: levels } = runtime;

  class StudioLog extends runtime.Log {
    override logWithLevel(entryLevel: LogLevel, message: string): void {
      buffer.push(toLevel(levels, entryLevel), "worker", message);
      if (!quiet) super.logWithLevel(entryLevel, message);
    }

    override error(message: Error): void {
      buffer.push("error", "worker", message.stack ?? message.message);
      super.error(message);
    }
  }

  return new StudioLog(level);
}
