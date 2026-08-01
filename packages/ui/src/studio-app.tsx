"use client";

import { useState } from "react";
import { cx, FidelityBadge } from "./components/primitives";
import { StudioProvider, useStudio } from "./studio-context";
import { D1View } from "./views/d1";
import { DurableObjectsView } from "./views/durable-objects";
import { KVView } from "./views/kv";
import { LogsView } from "./views/logs";
import { OperationsView } from "./views/operations";
import { OverviewView } from "./views/overview";
import { QueuesView } from "./views/queues";
import { R2View } from "./views/r2";

const TABS = [
  { id: "overview", label: "Overview", render: () => <OverviewView /> },
  { id: "d1", label: "D1", render: () => <D1View /> },
  { id: "kv", label: "KV", render: () => <KVView /> },
  { id: "r2", label: "R2", render: () => <R2View /> },
  { id: "do", label: "Durable Objects", render: () => <DurableObjectsView /> },
  { id: "queues", label: "Queues", render: () => <QueuesView /> },
  { id: "logs", label: "Logs", render: () => <LogsView /> },
  { id: "ops", label: "Snapshots & audit", render: () => <OperationsView /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MODE_BADGE: Record<string, { label: string; fidelity: "live" | "disk" | "remote" }> = {
  own: { label: "Mode A", fidelity: "live" },
  attach: { label: "Mode B", fidelity: "disk" },
  remote: { label: "Mode C", fidelity: "remote" },
};

function Chrome() {
  const [tab, setTab] = useState<TabId>("overview");
  const { meta } = useStudio();
  const active = TABS.find((item) => item.id === tab) ?? TABS[0];
  const badge = meta ? MODE_BADGE[meta.mode] : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <span className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded bg-orange-600 text-xs font-bold text-white">
              cf
            </span>
            <span className="font-semibold tracking-tight">local-cf</span>
          </span>

          {meta && badge && (
            <span className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="font-mono">{meta.workerName}</span>
              <FidelityBadge fidelity={badge.fidelity} title={`${badge.label}`} />
            </span>
          )}

          <nav className="-mb-2.5 ml-auto flex flex-wrap gap-0.5">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cx(
                  "border-b-2 px-3 py-2 text-sm transition-colors",
                  item.id === tab
                    ? "border-orange-500 font-medium text-orange-600 dark:text-orange-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">{active.render()}</main>
    </div>
  );
}

/**
 * The entire dashboard, as one component.
 *
 * Tabs are component state rather than routes on purpose. SETUP.md §6 worried
 * about static-export routing and client-side fallback for dynamic segments;
 * with a single page there are no dynamic segments to fall back to, and the
 * same tree drops into the hosted site's `/app` route unchanged.
 */
export function StudioApp({ baseUrl }: { baseUrl?: string }) {
  return (
    <StudioProvider {...(baseUrl ? { baseUrl } : {})}>
      <Chrome />
    </StudioProvider>
  );
}
