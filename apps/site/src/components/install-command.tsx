import { CopyButton } from "./copy-button";

export const BROWSE_COMMAND = "npx local-cf";
export const EDIT_COMMAND = "npx local-cf dev";

/** A single copyable command line. */
export function InstallCommand({ command = BROWSE_COMMAND }: { command?: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-surface py-1 pr-1 pl-3.5 ring ring-line">
      <code className="font-mono text-sm text-fg">
        <span className="text-fg-muted select-none">$ </span>
        {command}
      </code>
      <CopyButton value={command} label={`Copy: ${command}`} />
    </div>
  );
}

/**
 * Both entry points, with what each one actually does.
 *
 * The distinction matters enough to lead with: bare `local-cf` is the `attach`
 * command (it is registered as the default), which is read-only and cannot
 * damage local state. `local-cf dev` is the one that runs your worker.
 */
const COMMANDS = [
  {
    command: BROWSE_COMMAND,
    label: "Browse",
    detail: "Read-only. Attaches to the dev server you already have running.",
  },
  {
    command: EDIT_COMMAND,
    label: "Edit",
    detail: "Runs your worker and the studio in one runtime, read/write.",
  },
];

export function CommandPair() {
  return (
    <dl className="divide-y overflow-hidden rounded-xl bg-surface ring ring-line hairline">
      {COMMANDS.map((item) => (
        <div key={item.command} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <dt className="flex min-w-0 items-center gap-2.5">
            <code className="font-mono text-sm whitespace-nowrap text-fg">
              <span className="text-fg-muted select-none">$ </span>
              {item.command}
            </code>
            <span className="rounded-md bg-recessed px-1.5 py-0.5 text-xs font-medium text-fg-subtle">
              {item.label}
            </span>
          </dt>
          {/*
            The explanation is the first thing to go on a narrow screen: the
            command and its Browse/Edit tag already carry the distinction, and
            wrapping a full sentence under them turned each row into a block.
          */}
          <dd className="hidden min-w-0 flex-1 text-sm text-fg-subtle sm:block">{item.detail}</dd>
          {/* Once `dd` is gone there is free space, so this keeps the button right. */}
          <span className="ml-auto">
            <CopyButton value={item.command} label={`Copy: ${item.command}`} />
          </span>
        </div>
      ))}
    </dl>
  );
}

/**
 * The hero terminal.
 *
 * Output lines are dealt out on a stagger with plain CSS keyframes, so the
 * effect costs nothing at runtime and disappears entirely under
 * prefers-reduced-motion, where every line is simply already there.
 *
 * The command shown is `dev` on purpose: this output — one shared runtime, every
 * binding live — is Mode A. Showing it under bare `local-cf` would describe
 * attach mode, which is read-only and cannot see Durable Object memory.
 */
const LINES: { text: string; tone?: "muted" | "ok" | "brand" }[] = [
  { text: "workerd booted — your worker and the studio share one runtime", tone: "muted" },
  { text: "D1  DB          demo-db          live", tone: "ok" },
  { text: "KV  CACHE       sessions         live", tone: "ok" },
  { text: "R2  ASSETS      uploads          live", tone: "ok" },
  { text: "DO  COUNTER     Counter          live", tone: "ok" },
  { text: "studio ready → http://localhost:8787/__local-cf/ui", tone: "brand" },
];

export function HeroTerminal() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl bg-surface shadow-xl ring ring-line select-none"
    >
      <div className="flex items-center gap-2 border-b bg-elevated px-3 py-2 hairline">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-fill" />
          <span className="size-2.5 rounded-full bg-fill" />
          <span className="size-2.5 rounded-full bg-fill" />
        </span>
        <span className="mx-auto font-mono text-xs text-fg-subtle">~/my-worker</span>
      </div>

      <div className="space-y-1 p-4 font-mono text-xs leading-relaxed sm:text-sm">
        <p className="text-fg">
          <span className="text-fg-muted">$ </span>
          <span className="caret">{EDIT_COMMAND}</span>
        </p>

        {LINES.map((line, index) => (
          <p
            key={line.text}
            className={
              line.tone === "brand"
                ? "terminal-line text-orange-600"
                : line.tone === "ok"
                  ? "terminal-line text-success"
                  : "terminal-line text-fg-subtle"
            }
            // Dealt out after the command "types", one every 220ms.
            style={{ animationDelay: `${700 + index * 220}ms` }}
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
