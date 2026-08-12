"use client";

import type { BindingFidelity, StudioMode } from "@local-cf/core/types";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Cloudflare's button hierarchy: one filled orange primary per surface,
 * outlined secondary, quiet ghost. Danger reads as red text on a tint rather
 * than a filled red block — destructive but not alarming.
 */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-orange-500 text-white shadow-sm hover:bg-orange-600 focus-visible:outline-orange-500",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 focus-visible:outline-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

const FIELD_BASE =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(FIELD_BASE, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(FIELD_BASE, "font-mono leading-relaxed", className)} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={cx(FIELD_BASE, "w-auto pr-8", className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {hint}
      </span>
      {children}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */

export function Card({
  title,
  actions,
  footer,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx("overflow-hidden rounded-lg border hairline shadow-sm surface", className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 hairline">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
      {footer && (
        <footer className="border-t px-4 py-2 text-xs text-zinc-500 hairline surface-sunken">
          {footer}
        </footer>
      )}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-12 text-center text-sm text-zinc-500">{children}</p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        "inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/** A single placeholder bar. Static (no pulse) under prefers-reduced-motion. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cx("block rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800", className)}
    />
  );
}

/** Stand-in for a short list (keys, tables, migrations) while it loads. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2.5 p-3">
      {Array.from({ length: rows }).map((_, row) => (
        <Skeleton key={row} className="h-3.5" style={{ width: `${55 + ((row * 17) % 35)}%` }} />
      ))}
    </div>
  );
}

/** Stand-in for a DataTable while its first page of rows is still loading. */
export function SkeletonTable({ columns = 4, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="p-3">
      <table className="w-full border-collapse text-left text-sm">
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row} className="border-b last:border-0 hairline">
              {Array.from({ length: columns }).map((_, col) => (
                <td key={col} className="px-3 py-2">
                  <Skeleton className="h-3.5" style={{ width: col === 0 ? "70%" : `${40 + ((row * 13 + col * 7) % 40)}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorNote({ title, detail }: { title: string; detail?: string | null }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm dark:border-red-900/70 dark:bg-red-950/40"
    >
      <p className="font-medium text-red-800 dark:text-red-300">{title}</p>
      {detail && <p className="mt-1 break-words text-xs text-red-700/90 dark:text-red-400/90">{detail}</p>}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "success";
  title?: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    info: "border-sky-300 bg-sky-50 dark:border-sky-900/70 dark:bg-sky-950/30",
    warn: "border-amber-300 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30",
    success: "border-emerald-300 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30",
  } as const;

  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>}
      <div className="mt-1 text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                      */

const FIDELITY_STYLE: Record<BindingFidelity, { label: string; className: string }> = {
  live: {
    label: "Live",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400",
  },
  disk: {
    label: "On disk",
    className:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-400",
  },
  remote: {
    label: "Remote",
    className:
      "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-400",
  },
  unsupported: {
    label: "Unavailable",
    className:
      "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

/**
 * The trust signal from SETUP.md §1/§3: every binding says how real it is under
 * the current mode, instead of the UI implying uniform fidelity.
 */
export function FidelityBadge({ fidelity, title }: { fidelity: BindingFidelity; title?: string }) {
  const style = FIDELITY_STYLE[fidelity];
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {style.label}
    </span>
  );
}

const MODE_LABEL: Record<StudioMode, { short: string; title: string }> = {
  own: { short: "Mode A · shared runtime", title: "Same live binding objects as your worker" },
  attach: { short: "Mode B · attached", title: "Shares files on disk, not memory" },
  remote: { short: "Mode C · remote", title: "Proxying the Cloudflare REST API" },
};

export function ModeBadge({ mode }: { mode: StudioMode }) {
  const fidelity: BindingFidelity = mode === "own" ? "live" : mode === "attach" ? "disk" : "remote";
  const style = FIDELITY_STYLE[fidelity];
  return (
    <span
      title={MODE_LABEL[mode].title}
      className={cx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {MODE_LABEL[mode].short}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700",
        "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */

export function Tabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <nav className="flex gap-4 border-b hairline" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          onClick={() => onSelect(tab.id)}
          className={cx(
            "-mb-px border-b-2 px-0.5 py-2 text-sm transition-colors",
            tab.id === active
              ? "border-orange-500 font-medium text-zinc-900 dark:text-zinc-100"
              : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */

/** Render an unknown SQL/KV value without letting `null` and `"null"` blur. */
export function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic text-zinc-400 dark:text-zinc-600">null</span>;
  }
  if (typeof value === "object") {
    return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return <span className="font-mono text-xs text-sky-700 dark:text-sky-400">{String(value)}</span>;
  }
  return <span className="font-mono text-xs">{String(value)}</span>;
}

export function DataTable({
  columns,
  rows,
  emptyMessage = "No rows.",
}: {
  columns: string[];
  rows: unknown[][];
  emptyMessage?: string;
}) {
  if (columns.length === 0 && rows.length === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    // Wide result sets scroll inside the table, never the page.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="border-b px-3 py-2 text-xs font-semibold whitespace-nowrap text-zinc-600 hairline surface-sunken dark:text-zinc-400"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(columns.length, 1)}>
                <Empty>{emptyMessage}</Empty>
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                // Row order is the only stable identity a SQL result set has.
                key={rowIndex}
                className="border-b last:border-0 hairline hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="max-w-md truncate px-3 py-1.5">
                    <CellValue value={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** A left-hand list of bindings, used by every storage view. */
export function BindingList<T extends { binding: string; fidelity: BindingFidelity; note?: string }>({
  bindings,
  selected,
  onSelect,
  describe,
}: {
  bindings: T[];
  selected: string | null;
  onSelect: (binding: string) => void;
  describe: (binding: T) => string;
}) {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {bindings.map((binding) => {
        const isActive = binding.binding === selected;
        return (
          <button
            key={binding.binding}
            type="button"
            onClick={() => onSelect(binding.binding)}
            aria-current={isActive ? "true" : undefined}
            className={cx(
              "rounded-md border px-2.5 py-2 text-left transition-colors",
              isActive
                ? "border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-500/10"
                : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span
                className={cx(
                  "truncate font-mono text-sm",
                  isActive
                    ? "font-medium text-orange-800 dark:text-orange-400"
                    : "text-zinc-800 dark:text-zinc-200",
                )}
              >
                {binding.binding}
              </span>
              <FidelityBadge fidelity={binding.fidelity} title={binding.note} />
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-500">
              {describe(binding)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Standard two-pane storage layout: binding picker on the left, detail right. */
export function SplitView({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:h-full md:grid-cols-[240px_minmax(0,1fr)]">
      <aside
        className="border-b hairline md:sticky md:top-0 md:h-full md:overflow-y-auto md:border-b-0 md:border-r"
        style={{ background: "var(--surface-raised)" }}
      >
        {sidebar}
      </aside>
      <div className="min-w-0 space-y-4 p-4 md:p-6">{children}</div>
    </div>
  );
}