import type { LogEntry } from "@local-cf/core";
import { Log, LogLevel } from "miniflare";

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

function toLevel(level: LogLevel): LogEntry["level"] {
  switch (level) {
    case LogLevel.ERROR:
      return "error";
    case LogLevel.WARN:
      return "warn";
    case LogLevel.DEBUG:
    case LogLevel.VERBOSE:
      return "debug";
    default:
      return "info";
  }
}

/** A Miniflare `Log` that tees into the buffer as well as the terminal. */
export class StudioLog extends Log {
  readonly buffer: LogBuffer;
  readonly #quiet: boolean;

  constructor(buffer: LogBuffer, level: LogLevel, quiet: boolean) {
    super(level);
    this.buffer = buffer;
    this.#quiet = quiet;
  }

  override logWithLevel(level: LogLevel, message: string): void {
    this.buffer.push(toLevel(level), "worker", message);
    if (!this.#quiet) super.logWithLevel(level, message);
  }

  override error(message: Error): void {
    this.buffer.push("error", "worker", message.stack ?? message.message);
    super.error(message);
  }
}
