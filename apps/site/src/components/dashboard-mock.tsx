import { Box, Database, KeyRound, LayoutDashboard, Package, ScrollText } from "lucide-react";

/**
 * A scale model of the studio, built from the same tokens the studio itself
 * uses.
 *
 * Deliberately markup rather than a screenshot. A hero image would be the LCP
 * element — discovered late, decoded, then painted, and on this OpenNext/Workers
 * deployment it would also cost Worker CPU to optimise. This paints with the
 * first stylesheet, adapts to light and dark for free, stays crisp at any pixel
 * density, and cannot drift out of date when the real dashboard changes.
 *
 * It is decorative: the surrounding copy carries the meaning, so the whole thing
 * is hidden from assistive technology rather than read out as a fake table.
 */

const NAV = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: Database, label: "D1", active: true },
  { icon: KeyRound, label: "KV" },
  { icon: Package, label: "R2" },
  { icon: Box, label: "Durable Objects" },
  { icon: ScrollText, label: "Logs" },
];

const ROWS = [
  ["1", "0001_create_posts.sql", "2026-08-01 21:01:21"],
  ["2", "0002_seed_posts.sql", "2026-08-01 21:01:27"],
  ["3", "0003_add_author.sql", "2026-08-02 09:14:03"],
];

export function DashboardMock() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl bg-surface shadow-2xl ring ring-line select-none"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b bg-elevated px-3 py-2.5 hairline">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-fill" />
          <span className="size-2.5 rounded-full bg-fill" />
          <span className="size-2.5 rounded-full bg-fill" />
        </span>
        <span className="mx-auto rounded-md bg-recessed px-3 py-0.5 font-mono text-xs text-fg-subtle">
          localhost:8787/__local-cf/ui
        </span>
      </div>

      <div className="flex h-[19rem] text-xs">
        {/* Sidebar */}
        <div className="hidden w-40 shrink-0 flex-col border-r bg-surface hairline sm:flex">
          <div className="flex items-center gap-1.5 border-b px-3 py-2.5 hairline">
            <span className="size-3.5 rounded bg-orange-600" />
            <span className="font-semibold text-fg-strong">local-cf</span>
          </div>
          <div className="space-y-0.5 p-1.5">
            {NAV.map((item) => (
              <div
                key={item.label}
                className={
                  item.active
                    ? "relative flex items-center gap-2 rounded-md bg-tint px-2 py-1.5 font-medium text-fg-strong"
                    : "flex items-center gap-2 rounded-md px-2 py-1.5 text-fg-subtle"
                }
              >
                {item.active && (
                  <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-orange-600" />
                )}
                <item.icon
                  strokeWidth={1.75}
                  className={item.active ? "size-3.5 text-orange-600" : "size-3.5"}
                />
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 bg-canvas">
          <div className="flex items-center gap-2 border-b bg-surface px-4 py-2.5 hairline">
            <span className="font-mono text-fg">demo-worker</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 font-medium text-success ring ring-success/30">
              <span className="size-1.5 rounded-full bg-current opacity-70" />
              Live
            </span>
          </div>

          <div className="p-4">
            <div className="overflow-hidden rounded-lg bg-surface ring ring-line">
              <div className="flex items-center gap-2 border-b px-4 py-2.5 hairline">
                <span className="font-mono font-semibold text-fg-strong">d1_migrations</span>
                <span className="rounded-md bg-recessed px-1.5 py-0.5 font-mono text-fg-subtle ring ring-line">
                  3 rows
                </span>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="bg-recessed text-fg-subtle">
                    {["id", "name", "applied_at"].map((column) => (
                      <th key={column} className="border-b px-4 py-2 font-medium hairline">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {ROWS.map((row) => (
                    <tr key={row[0]} className="border-b last:border-0 hairline">
                      <td className="px-4 py-2 text-link">{row[0]}</td>
                      <td className="px-4 py-2 text-fg">{row[1]}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-fg">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
