import type { AuditEntry } from "@local-cf/core/types";
import type { Env } from "../env.js";

export type AuditDraft = Omit<AuditEntry, "seq" | "ts" | "mode">;

/**
 * Record a write made *through the dashboard*.
 *
 * Fire-and-forget on purpose: an audit failure must never fail the write the
 * user asked for. The bridge owns durability (it appends to `.local-cf/audit.jsonl`).
 */
export function recordAudit(env: Env, entry: AuditDraft): Promise<void> {
  return env.BRIDGE.fetch("http://bridge/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...entry, mode: env.LOCAL_CF_MODE }),
  })
    .then(() => undefined)
    .catch(() => undefined);
}
