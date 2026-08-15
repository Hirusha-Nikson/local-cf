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
/* Controls                                                                    */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "base";

/**
 * Kumo's button hierarchy. Two things differ from the obvious implementation
 * and are deliberate:
 *
 * - Every variant is outlined with `ring`, never `border`. A border participates
 *   in layout and softens against a drop shadow; a ring keeps the edge sharp.
 * - Colour changes on hover are immediate. Transitioning them makes a dense
 *   dashboard feel sluggish, so there is no `transition-colors` here.
 *
 * Primary is the blue accent rather than the brand orange — that is what the
 * Cloudflare dashboard uses for emphasis, with orange reserved for the mark.
 */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "group relative overflow-hidden bg-accent-fill text-white ring ring-accent-ring",
  secondary: "bg-surface text-fg ring ring-line hover:bg-tint",
  ghost: "bg-transparent text-fg-subtle ring ring-transparent hover:bg-tint hover:text-fg",
  danger: "bg-surface text-danger ring ring-line hover:ring-danger/30",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 gap-1 rounded-md px-2 text-xs",
  base: "h-9 gap-1.5 rounded-lg px-3 text-sm",
};

export function Button({
  variant = "secondary",
  size = "base",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {/*
        Kumo's emphasis fill: a top-to-bottom gradient that lands on the pure
        accent, over a 1px inset highlight. Hovering flattens the gradient
        rather than shifting hue, so the button darkens without a colour change.
      */}
      {variant === "primary" && (
        <span
          aria-hidden="true"
          className={cx(
            "absolute inset-0 rounded-[inherit] bg-linear-to-b from-accent-grad to-accent",
            "shadow-[inset_0_1px_0_0_var(--color-accent-fill)] group-hover:from-accent-fill",
          )}
        />
      )}
      <span className={cx("inline-flex items-center gap-1.5", variant === "primary" && "relative")}>
        {children}
      </span>
    </button>
  );
}

const FIELD_BASE =
  "w-full rounded-lg bg-surface px-2.5 py-1.5 text-sm text-fg ring ring-line " +
  "placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent";

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
    <select {...props} className={cx(FIELD_BASE, "h-9 w-auto pr-8", className)}>
      {children}
    </select>
  );
}

/** Label sits close to its control; the gap below the group is what separates fields. */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-fg">
        {label}
        {hint}
      </span>
      {children}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */

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
    // `ring` rather than `border`: a bordered box with a shadow reads soft-edged.
    <section
      className={cx("overflow-hidden rounded-lg bg-surface shadow-sm ring ring-line", className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3 hairline">
          <h2 className="text-sm font-semibold text-fg-strong">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
      {footer && (
        <footer className="border-t px-5 py-2.5 text-sm text-fg-subtle hairline bg-recessed">
          {footer}
        </footer>
      )}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-12 text-center text-sm text-fg-subtle">{children}</p>;
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
      className={cx("block rounded bg-fill motion-safe:animate-pulse", className)}
    />
  );
}

/** Stand-in for a short list (keys, tables, migrations) while it loads. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, row) => (
        <Skeleton key={row} className="h-3.5" style={{ width: `${55 + ((row * 17) % 35)}%` }} />
      ))}
    </div>
  );
}

/** Stand-in for a DataTable while its first page of rows is still loading. */
export function SkeletonTable({ columns = 4, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="p-4">
      <table className="w-full border-collapse text-left text-sm">
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row} className="border-b last:border-0 hairline">
              {Array.from({ length: columns }).map((_, col) => (
                <td key={col} className="px-3 py-2">
                  <Skeleton
                    className="h-3.5"
                    style={{ width: col === 0 ? "70%" : `${40 + ((row * 13 + col * 7) % 40)}%` }}
                  />
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
    <div role="alert" className="rounded-lg bg-surface px-4 py-3 ring ring-danger/30">
      <p className="text-sm font-medium text-danger">{title}</p>
      {detail && <p className="mt-1 text-sm break-words text-fg-subtle">{detail}</p>}
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
  const rings = {
    info: "ring-link/25",
    warn: "ring-warning/30",
    success: "ring-success/30",
  } as const;

  const marks = {
    info: "text-link",
    warn: "text-warning",
    success: "text-success",
  } as const;

  return (
    // Title and body belong together; the gap that matters is the one outside.
    <div className={cx("rounded-lg bg-surface px-5 py-4 ring", rings[tone])}>
      {title && <p className={cx("text-sm font-semibold", marks[tone])}>{title}</p>}
      <div className="mt-1 text-sm text-fg-subtle">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                      */

const FIDELITY_STYLE: Record<BindingFidelity, { label: string; className: string }> = {
  live: { label: "Live", className: "text-success ring-success/30" },
  disk: { label: "On disk", className: "text-warning ring-warning/30" },
  remote: { label: "Remote", className: "text-link ring-link/25" },
  unsupported: { label: "Unavailable", className: "text-fg-subtle ring-line" },
};

const BADGE_BASE =
  "inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring";

/**
 * The trust signal from SETUP.md §1/§3: every binding says how real it is under
 * the current mode, instead of the UI implying uniform fidelity.
 */
export function FidelityBadge({ fidelity, title }: { fidelity: BindingFidelity; title?: string }) {
  const style = FIDELITY_STYLE[fidelity];
  return (
    <span title={title} className={cx(BADGE_BASE, style.className)}>
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
    <span title={MODE_LABEL[mode].title} className={cx(BADGE_BASE, style.className)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {MODE_LABEL[mode].short}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md bg-recessed px-1.5 py-0.5 font-mono text-xs text-fg-subtle ring ring-line",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */

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
            "-mb-px border-b-2 px-0.5 py-2 text-sm",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            tab.id === active
              ? "border-accent font-medium text-fg-strong"
              : "border-transparent text-fg-subtle hover:text-fg",
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */

/** Render an unknown SQL/KV value without letting `null` and `"null"` blur. */
export function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-fg-muted italic">null</span>;
  }
  if (typeof value === "object") {
    return <span className="font-mono text-sm">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return <span className="font-mono text-sm text-link">{String(value)}</span>;
  }
  return <span className="font-mono text-sm">{String(value)}</span>;
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
                // Sticky, so a border is what separates it from the rows beneath.
                className="sticky top-0 z-10 border-b px-3 py-2 text-sm font-medium whitespace-nowrap text-fg-subtle hairline bg-recessed"
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
                className="border-b last:border-0 hairline hover:bg-tint"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="max-w-md truncate px-3 py-2">
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

/**
 * A left-hand list of bindings, used by every storage view.
 *
 * The selected row is marked with the brand rail rather than a filled block: a
 * solid tint reads as a floating card in a sidebar this narrow, and the rail
 * matches how the main navigation marks its current page.
 */
export function BindingList<T extends { binding: string; fidelity: BindingFidelity; note?: string }>({
  bindings,
  selected,
  onSelect,
  describe,
  label,
}: {
  bindings: T[];
  selected: string | null;
  onSelect: (binding: string) => void;
  describe: (binding: T) => string;
  label?: string;
}) {
  return (
    <nav className="p-2">
      {label && <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-fg-subtle">{label}</p>}

      <div className="flex flex-col gap-0.5">
        {bindings.map((binding) => {
          const isActive = binding.binding === selected;
          return (
            <button
              key={binding.binding}
              type="button"
              onClick={() => onSelect(binding.binding)}
              aria-current={isActive ? "true" : undefined}
              className={cx(
                "relative rounded-md py-1.5 pr-2 pl-3 text-left",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                isActive ? "bg-orange-500/10" : "hover:bg-tint",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "absolute inset-y-1 left-0.5 w-0.5 rounded-full bg-orange-500",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cx(
                    "truncate text-sm",
                    isActive ? "font-medium text-orange-700 dark:text-orange-400" : "text-fg",
                  )}
                >
                  {binding.binding}
                </span>
                <FidelityBadge fidelity={binding.fidelity} title={binding.note} />
              </span>
              <span className="mt-0.5 block truncate font-mono text-sm text-fg-subtle">
                {describe(binding)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Standard two-pane storage layout: binding picker on the left, detail right. */
export function SplitView({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:h-full md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b bg-surface hairline md:sticky md:top-0 md:h-full md:overflow-y-auto md:border-r md:border-b-0">
        {sidebar}
      </aside>
      <div className="min-w-0 space-y-5 px-4 py-5 md:px-6">{children}</div>
    </div>
  );
}
