"use client";

import { useState, type ReactNode } from "react";
import { cx, ModeBadge } from "./components/primitives";
import { ThemeToggle } from "./components/theme-toggle";
import { StudioProvider, useStudio } from "./studio-context";
import { D1View } from "./views/d1";
import { DurableObjectsView } from "./views/durable-objects";
import { KVView } from "./views/kv";
import { LogsView } from "./views/logs";
import { OperationsView } from "./views/operations";
import { OverviewView } from "./views/overview";
import { QueuesView } from "./views/queues";
import { R2View } from "./views/r2";

/* -------------------------------------------------------------------------- */
/* Icons — inline so the package stays dependency-free and the export offline. */

function Icon({ path, className }: { path: string; className?: string }) {
    return (
        <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cx("size-4 shrink-0", className)}
        >
            <path d={path} />
        </svg>
    );
}

const ICONS = {
    overview: "M2 3.5h5v4H2zM9 3.5h5v9H9zM2 9.5h5v3H2z",
    database:
        "M8 1.8c3 0 5 .8 5 1.8s-2 1.8-5 1.8-5-.8-5-1.8S5 1.8 8 1.8ZM3 3.6v8.8c0 1 2 1.8 5 1.8s5-.8 5-1.8V3.6M3 8c0 1 2 1.8 5 1.8s5-.8 5-1.8",
    key: "M9.5 2.5a4 4 0 1 0-3.2 6.4L2 13.2v1.3h1.9l.7-.7v-1.2h1.2l.9-.9V10.4h1.2l.7-.7a4 4 0 0 0 2.9-7.2Z",
    bucket:
        "M2.5 4h11l-1 9.5a1 1 0 0 1-1 .9H4.5a1 1 0 0 1-1-.9L2.5 4ZM5 4V2.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V4",
    cube: "M8 1.6 14 5v6l-6 3.4L2 11V5l6-3.4ZM2 5l6 3.4M14 5 8 8.4M8 8.4v6",
    queue: "M2 4.5h12M2 8h12M2 11.5h8M12.5 10.5 14.5 12.5 12.5 14.5",
    logs: "M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3",
    archive: "M2 3.5h12v3H2zM3 6.5v7h10v-7M6.5 9h3",
} as const;

/* -------------------------------------------------------------------------- */

interface Tab {
    id: string;
    label: string;
    icon: string;
    title: string;
    description: string;
    countKinds?: string[];
    render: () => ReactNode;
}

const SECTIONS: { label: string | null; tabs: Tab[] }[] = [
    {
        label: null,
        tabs: [
            {
                id: "overview",
                label: "Overview",
                icon: ICONS.overview,
                title: "Overview",
                description: "What local-cf is connected to, and how faithfully.",
                render: () => <OverviewView />,
            },
        ],
    },
    {
        label: "Storage",
        tabs: [
            {
                id: "d1",
                label: "D1",
                icon: ICONS.database,
                title: "D1",
                description: "Browse tables, run SQL and apply migrations.",
                countKinds: ["d1"],
                render: () => <D1View />,
            },
            {
                id: "kv",
                label: "KV",
                icon: ICONS.key,
                title: "KV",
                description: "Inspect and edit keys, import and export namespaces.",
                countKinds: ["kv"],
                render: () => <KVView />,
            },
            {
                id: "r2",
                label: "R2",
                icon: ICONS.bucket,
                title: "R2",
                description: "List, upload, download and delete objects.",
                countKinds: ["r2"],
                render: () => <R2View />,
            },
        ],
    },
    {
        label: "Compute",
        tabs: [
            {
                id: "do",
                label: "Durable Objects",
                icon: ICONS.cube,
                title: "Durable Objects",
                description: "Resolve instance ids and send requests to a live object.",
                countKinds: ["durable_object"],
                render: () => <DurableObjectsView />,
            },
            {
                id: "queues",
                label: "Queues",
                icon: ICONS.queue,
                title: "Queues",
                description: "Send messages and review consumer configuration.",
                countKinds: ["queue_producer", "queue_consumer"],
                render: () => <QueuesView />,
            },
        ],
    },
    {
        label: "Observe",
        tabs: [
            {
                id: "logs",
                label: "Logs",
                icon: ICONS.logs,
                title: "Logs",
                description: "Live tail of your worker's console output.",
                render: () => <LogsView />,
            },
            {
                id: "ops",
                label: "Snapshots & audit",
                icon: ICONS.archive,
                title: "Snapshots & audit",
                description: "Capture and restore local state; review every write made here.",
                render: () => <OperationsView />,
            },
        ],
    },
];

const ALL_TABS = SECTIONS.flatMap((section) => section.tabs);

/* -------------------------------------------------------------------------- */

function Sidebar({
    active,
    onSelect,
    counts,
    open,
    onClose,
}: {
    active: string;
    onSelect: (id: string) => void;
    counts: Map<string, number>;
    open: boolean;
    onClose: () => void;
}) {
    return (
        <>
            {open && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={onClose}
                    className="fixed inset-0 z-20 bg-zinc-900/40 md:hidden"
                />
            )}

            <aside
                className={cx(
                    "fixed inset-y-0 left-0 z-30 flex h-screen w-60 shrink-0 flex-col border-r hairline",
                    "transition-transform md:static md:h-full md:translate-x-0",
                    open ? "translate-x-0" : "-translate-x-full",
                )}
                style={{ background: "var(--surface-sidebar)" }}
            >
                <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4 hairline">
                    <span className="grid size-6 shrink-0 place-items-center rounded bg-orange-500 text-[10px] font-bold text-white">
                        cf
                    </span>
                    <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        local-cf
                    </span>
                </div>

                <nav className="min-h-0 flex-1 overflow-y-auto p-2">
                    {SECTIONS.map((section) => (
                        <div key={section.label ?? "root"} className="mb-1">
                            {section.label && (
                                <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    {section.label}
                                </p>
                            )}

                            {section.tabs.map((tab) => {
                                const count = tab.countKinds
                                    ? tab.countKinds.reduce((sum, kind) => sum + (counts.get(kind) ?? 0), 0)
                                    : undefined;
                                const isActive = tab.id === active;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(tab.id);
                                            onClose();
                                        }}
                                        aria-current={isActive ? "page" : undefined}
                                        className={cx(
                                            "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                                            isActive
                                                ? "bg-orange-50 font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                                                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                                        )}
                                    >
                                        <span
                                            className={cx(
                                                "absolute inset-y-1 left-0 w-0.5 rounded-full bg-orange-500",
                                                isActive ? "opacity-100" : "opacity-0",
                                            )}
                                        />
                                        <Icon path={tab.icon} className={isActive ? "text-orange-500" : "text-zinc-500"} />
                                        <span className="truncate">{tab.label}</span>
                                        {count !== undefined && count > 0 && (
                                            <span className="ml-auto rounded bg-zinc-200 px-1.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <p className="shrink-0 border-t px-4 py-2.5 text-[11px] text-zinc-500 hairline">
                    Local only · nothing leaves your machine
                </p>
            </aside>
        </>
    );
}

/* -------------------------------------------------------------------------- */

function Chrome() {
    const [tab, setTab] = useState("overview");
    const [navOpen, setNavOpen] = useState(false);
    const { meta, refresh, loading, syncing, lastUpdatedAt } = useStudio();
    const active = ALL_TABS.find((item) => item.id === tab) ?? ALL_TABS[0]!;
    const counts = new Map<string, number>();

    for (const binding of meta?.bindings ?? []) {
        counts.set(binding.kind, (counts.get(binding.kind) ?? 0) + 1);
    }

    return (
        <div className="flex h-screen overflow-hidden text-zinc-900 dark:text-zinc-100">
            <Sidebar active={tab} onSelect={setTab} counts={counts} open={navOpen} onClose={() => setNavOpen(false)} />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <header
                    className="flex h-12 shrink-0 items-center gap-3 border-b px-4 hairline"
                    style={{ background: "var(--surface-raised)" }}
                >
                    <button
                        type="button"
                        aria-label="Open navigation"
                        onClick={() => setNavOpen(true)}
                        className="-ml-1 rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
                    >
                        <Icon path="M2 4h12M2 8h12M2 12h12" />
                    </button>

                    {meta && (
                        <>
                            <span className="truncate font-mono text-sm text-zinc-700 dark:text-zinc-300">
                                {meta.workerName}
                            </span>
                            <ModeBadge mode={meta.mode} />
                            <span className="hidden text-xs text-zinc-500 md:inline dark:text-zinc-400">
                                {syncing
                                    ? "Syncing latest state"
                                    : lastUpdatedAt
                                        ? `Synced ${new Date(lastUpdatedAt).toLocaleTimeString()}`
                                        : "Connected"}
                            </span>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={refresh}
                        disabled={loading}
                        title="Reload studio metadata"
                        className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                        <Icon
                            path="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3"
                            className={cx("size-3.5", (loading || syncing) && "animate-spin")}
                        />
                        {syncing ? "Syncing" : "Refresh"}
                    </button>

                    <ThemeToggle />
                </header>

                <div
                    className="shrink-0 border-b px-4 py-4 hairline md:px-6"
                    style={{ background: "var(--surface-raised)" }}
                >
                    <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{meta?.workerName ?? "local-cf"}</span>
                        <Icon path="M6 3.5 10 8l-4 4.5" className="size-3 shrink-0 text-zinc-400 dark:text-zinc-600" />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{active.label}</span>
                    </nav>
                    <h1 className="text-lg font-semibold tracking-tight">{active.title}</h1>
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{active.description}</p>
                </div>

                <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{active.render()}</main>
            </div>
        </div>
    );
}

/**
 * The whole dashboard, as one component.
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