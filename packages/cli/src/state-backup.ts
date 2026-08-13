import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

/** Backups kept before the oldest is pruned. */
const KEEP = 3;

/** Attach snapshots kept before the oldest is pruned. */
const KEEP_SNAPSHOTS = 2;

/** Above this, copying costs more disk and patience than the safety is worth. */
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

export interface CopyOutcome {
  /** Where the copy landed, or undefined when nothing was copied. */
  path?: string;
  /** Why no copy was made, phrased for the banner. */
  skipped?: string;
}

async function directorySize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(full);
    } else if (entry.isFile()) {
      total += (await stat(full)).size;
    }
    if (total > MAX_BYTES) return total;
  }
  return total;
}

/**
 * Which files may be copied out of a persist directory.
 *
 * `-shm` is SQLite's shared-memory index: it describes one host's view of a
 * WAL and is meant to be rebuilt on open, so carrying another process's copy
 * into the snapshot makes workerd fail to read the database at all. The `-wal`
 * beside it is real committed data and is kept, so recent writes survive.
 */
function copyableStateFile(source: string): boolean {
  return !source.endsWith("-shm");
}

async function assertCopyable(source: string): Promise<void> {
  if ((await directorySize(source)) > MAX_BYTES) {
    throw new Error(
      `The persist directory is larger than ${Math.round(MAX_BYTES / 1024 ** 3)}GB, so local-cf ` +
        `will not copy it.\nRun \`local-cf dev\` to own the runtime, or ` +
        `\`local-cf --allow-write\` if your dev server is stopped.`,
    );
  }
}

/**
 * Take a point-in-time copy of the persist directory for attach mode to open.
 *
 * Opening the real directory is not safe, and not because of writes: starting a
 * runtime against a *fresh* project creates SQLite `-wal`/`-shm` files beside
 * the data before a single request is served. Those files belong to the workerd
 * build that made them, and the project's own `wrangler dev` — a different
 * build — can fail to reconcile them, which is how local-cf left a real project
 * unable to start. So attach reads a copy and never touches the original.
 */
export async function snapshotPersistState(
  source: string,
  projectRoot: string,
): Promise<CopyOutcome> {
  if (!existsSync(source)) return { skipped: "no persist directory yet" };
  await assertCopyable(source);

  /**
   * Single-character slots, deliberately.
   *
   * Two constraints pull against each other here. Reusing one fixed directory
   * means deleting it first, and on Windows that fails with EBUSY while
   * anything still holds a handle — an orphaned `workerd` is enough. But a
   * timestamped directory per run adds ~25 characters, and Windows still
   * enforces MAX_PATH (260) for SQLite: the `-wal` beside a D1 database is
   * already a 64-character hash deep inside `v3/d1/miniflare-D1DatabaseObject`,
   * so the extra depth pushes real projects over the limit and every query
   * fails with SQLITE_CANTOPEN. Short rotating slots satisfy both.
   */
  const root = join(projectRoot, ".local-cf", "attached");
  await mkdir(root, { recursive: true });

  for (let slot = 0; slot < KEEP_SNAPSHOTS + 1; slot += 1) {
    const destination = join(root, String(slot));
    try {
      await rm(destination, { recursive: true, force: true });
    } catch {
      continue; // Still locked by another run — take the next slot.
    }
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true, filter: copyableStateFile });
    return { path: destination };
  }

  throw new Error(
    "Could not prepare a snapshot of the persist directory: every slot under " +
      `${root} is locked. Close other local-cf processes and try again.`,
  );
}

/**
 * Copy the persist directory aside before a runtime opens it read/write.
 *
 * Used when the user has explicitly opted into writing someone else's state,
 * which is the one path where local-cf can still damage the original.
 */
export async function backupPersistState(
  source: string,
  projectRoot: string,
): Promise<CopyOutcome> {
  if (!existsSync(source)) return { skipped: "no persist directory yet" };
  await assertCopyable(source);

  const root = join(projectRoot, ".local-cf", "backups");
  await mkdir(root, { recursive: true });

  const destination = join(root, new Date().toISOString().replace(/[:.]/g, "-"));
  await cp(source, destination, { recursive: true, filter: copyableStateFile });

  const existing = (await readdir(root)).sort();
  for (const stale of existing.slice(0, Math.max(0, existing.length - KEEP))) {
    await rm(join(root, stale), { recursive: true, force: true });
  }

  return { path: destination };
}
