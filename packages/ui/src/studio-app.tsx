"use client";

import {
    Archive,
    ChevronRight,
    Database,
    KeyRound,
    LayoutDashboard,
    ListOrdered,
    Menu,
    Package,
    PanelLeftClose,
    PanelLeftOpen,
    RefreshCw,
    ScrollText,
    Box,
    type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "./components/logo";
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

/**
 * Lucide at 1.75 stroke rather than its default 2 — closer to the lighter
 * weight Cloudflare's own chrome uses, and it stops 16px icons reading heavier
 * than the 14px label beside them.
 */
function Icon({ as: Glyph, className }: { as: LucideIcon; className?: string }) {
    return <Glyph aria-hidden="true" strokeWidth={1.75} className={cx("size-4 shrink-0", className)} />;
}

/* -------------------------------------------------------------------------- */

interface Tab {
    id: string;
    label: string;
    icon: LucideIcon;
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
                icon: LayoutDashboard,
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
                icon: Database,
                description: "Browse tables, run SQL and apply migrations.",
                countKinds: ["d1"],
                render: () => <D1View />,
            },
            {
                id: "kv",
                label: "KV",
                icon: KeyRound,
                description: "Inspect and edit keys, import and export namespaces.",
                countKinds: ["kv"],
                render: () => <KVView />,
            },
            {
                id: "r2",
                label: "R2",
                icon: Package,
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
                icon: Box,
                description: "Resolve instance ids and send requests to a live object.",
                countKinds: ["durable_object"],
                render: () => <DurableObjectsView />,
            },
            {
                id: "queues",
                label: "Queues",
                icon: ListOrdered,
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
                icon: ScrollText,
                description: "Live tail of your worker's console output.",
                render: () => <LogsView />,
            },
            {
                id: "ops",
                label: "Snapshots & audit",
                icon: Archive,
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
    /*
     * Rail mode is a desktop affordance only. On mobile the sidebar is already a
     * drawer that slides away entirely, so every collapse-related class below is
     * scoped to `md:` and the drawer keeps its full width.
     */
    const [collapsed, setCollapsed] = useState(false);

    return (
        <>
            {open && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={onClose}
                    className="fixed inset-0 z-20 bg-black/50 md:hidden"
                />
            )}

            <aside
                className={cx(
                    "fixed inset-y-0 left-0 z-30 flex h-screen w-60 shrink-0 flex-col border-r bg-surface hairline",
                    "transition-[width,transform] duration-200 md:static md:h-full md:translate-x-0",
                    open ? "translate-x-0" : "-translate-x-full",
                    collapsed && "md:w-14",
                )}
            >
                <div
                    className={cx(
                        "flex h-12 shrink-0 items-center gap-2 border-b px-4 hairline",
                        collapsed && "md:justify-center md:px-0",
                    )}
                >
                    <Logo />
                    <span className={cx("font-semibold text-fg-strong", collapsed && "md:sr-only")}>
                        local-cf
                    </span>
                </div>

                <nav className="min-h-0 flex-1 overflow-y-auto p-2">
                    {SECTIONS.map((section) => (
                        <div key={section.label ?? "root"} className="mb-1">
                            {section.label && (
                                <>
                                    <p
                                        className={cx(
                                            "px-2.5 pt-4 pb-1.5 text-xs font-medium text-fg-subtle",
                                            collapsed && "md:hidden",
                                        )}
                                    >
                                        {section.label}
                                    </p>
                                    {/* The group still needs a boundary once its name is gone. */}
                                    {collapsed && (
                                        <div
                                            aria-hidden="true"
                                            className="mx-auto my-2 hidden h-px w-6 bg-hairline md:block"
                                        />
                                    )}
                                </>
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
                                        // The label is the accessible name; in rail mode it also
                                        // has to be the tooltip, since nothing else names the icon.
                                        title={collapsed ? tab.label : undefined}
                                        className={cx(
                                            "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm",
                                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                                            collapsed && "md:justify-center md:px-0",
                                            isActive
                                                ? "bg-tint font-medium text-fg-strong"
                                                : "text-fg hover:bg-tint",
                                        )}
                                    >
                                        {/* Orange stays the brand mark: the rail and the active icon, nothing else. */}
                                        <span
                                            className={cx(
                                                "absolute inset-y-1 left-0 w-0.5 rounded-full bg-orange-500",
                                                isActive ? "opacity-100" : "opacity-0",
                                            )}
                                        />
                                        <Icon
                                            as={tab.icon}
                                            className={isActive ? "text-orange-500" : "text-fg-subtle"}
                                        />
                                        {/*
                                          `sr-only` rather than `hidden`: the button keeps its
                                          accessible name in rail mode instead of becoming a
                                          nameless icon.
                                        */}
                                        <span className={cx("truncate", collapsed && "md:sr-only")}>
                                            {tab.label}
                                        </span>
                                        {count !== undefined && count > 0 && (
                                            <span
                                                className={cx(
                                                    "ml-auto rounded-md bg-fill px-1.5 text-xs font-medium text-fg-subtle",
                                                    collapsed && "md:hidden",
                                                )}
                                            >
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="shrink-0 border-t p-2 hairline">
                    <button
                        type="button"
                        onClick={() => setCollapsed((value) => !value)}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className={cx(
                            "hidden w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-fg-subtle md:flex",
                            "hover:bg-tint hover:text-fg",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                            collapsed && "md:justify-center md:px-0",
                        )}
                    >
                        <Icon as={collapsed ? PanelLeftOpen : PanelLeftClose} />
                        <span className={cx("truncate", collapsed && "md:sr-only")}>Collapse</span>
                    </button>

                    <p
                        className={cx(
                            "px-2.5 py-1 text-xs text-fg-subtle",
                            collapsed && "md:hidden",
                        )}
                    >
                        Local only · nothing leaves your machine
                    </p>
                </div>
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
        <div className="flex h-screen overflow-hidden text-fg">
            <Sidebar active={tab} onSelect={setTab} counts={counts} open={navOpen} onClose={() => setNavOpen(false)} />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {/* Sticky chrome, so a border is what separates it from the content. */}
                <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-surface px-4 hairline">
                    <button
                        type="button"
                        aria-label="Open navigation"
                        onClick={() => setNavOpen(true)}
                        className="-ml-1 rounded-md p-1.5 text-fg-subtle hover:bg-tint md:hidden"
                    >
                        <Icon as={Menu} />
                    </button>

                    {meta && (
                        <>
                            <span className="truncate font-mono text-sm text-fg">{meta.workerName}</span>
                            <ModeBadge mode={meta.mode} />
                            <span className="hidden text-sm text-fg-subtle md:inline">
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
                        className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-fg-subtle hover:bg-tint hover:text-fg disabled:opacity-50"
                    >
                        <Icon
                            as={RefreshCw}
                            className={cx("size-3.5", (loading || syncing) && "motion-safe:animate-spin")}
                        />
                        {syncing ? "Syncing" : "Refresh"}
                    </button>

                    <ThemeToggle />
                </header>

                <div className="shrink-0 border-b bg-surface px-4 py-3.5 hairline md:px-6">
                    {/*
                      The trail ends on the page's own name, so that crumb *is* the
                      heading — marking it up as one keeps a single h1 on the page
                      without repeating the title underneath.
                    */}
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-1.5 text-sm text-fg-subtle"
                    >
                        <span>{meta?.workerName ?? "local-cf"}</span>
                        <Icon as={ChevronRight} className="size-3.5 text-fg-faint" />
                        <h1 className="font-medium text-fg-strong">{active.label}</h1>
                    </nav>
                    <p className="mt-1 text-sm text-fg-subtle">{active.description}</p>
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