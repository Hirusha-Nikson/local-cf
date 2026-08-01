"use client";

import type { BindingFidelity } from "@local-cf/core/types";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-orange-600 text-white hover:bg-orange-500 focus-visible:outline-orange-500 disabled:bg-orange-600/50",
  secondary:
    "bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  ghost:
    "bg-transparent text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  danger:
    "bg-red-600/10 text-red-700 hover:bg-red-600/20 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20",
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
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900",
        "placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600",
        className,
      )}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900",
        "placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600",
        className,
      )}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className={cx(
        "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900",
        "focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
        className,
      )}
    >
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------------- */

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-500">{children}</p>
  );
}

export function Spinner() {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function ErrorNote({ title, detail }: { title: string; detail?: string | null }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm dark:border-red-900/60 dark:bg-red-950/40">
      <p className="font-medium text-red-800 dark:text-red-300">{title}</p>
      {detail && <p className="mt-1 text-xs text-red-700/80 dark:text-red-400/80">{detail}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const FIDELITY_STYLE: Record<BindingFidelity, { label: string; className: string }> = {
  live: {
    label: "live",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  disk: {
    label: "on disk",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  remote: {
    label: "remote",
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  },
  unsupported: {
    label: "unavailable",
    className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
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
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600",
        "dark:bg-zinc-800 dark:text-zinc-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

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
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
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
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
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
      {bindings.map((binding) => (
        <button
          key={binding.binding}
          type="button"
          onClick={() => onSelect(binding.binding)}
          className={cx(
            "rounded-md px-2.5 py-2 text-left transition-colors",
            binding.binding === selected
              ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-sm">{binding.binding}</span>
            <FidelityBadge fidelity={binding.fidelity} title={binding.note} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-500">
            {describe(binding)}
          </span>
        </button>
      ))}
    </nav>
  );
}
