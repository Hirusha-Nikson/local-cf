"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";

/**
 * The three modes, as a tab set rather than a comparison table.
 *
 * A table forces every visitor to read all three rows to find the one that
 * applies to them. Tabs let them pick their situation and read only that — and
 * the honesty about what each mode cannot do stays on screen either way.
 */
const MODES = [
  {
    id: "a",
    name: "Shared runtime",
    tag: "Mode A",
    command: "npx local-cf dev",
    summary:
      "The studio runs inside the same workerd process as your worker, wired to the same binding objects. Not a mirror synced over disk — the same objects.",
    facts: [
      { ok: true, text: "D1, KV and R2 are the live objects your code writes to" },
      { ok: true, text: "Durable Objects include in-memory state, not just the last flush" },
      { ok: true, text: "Queues produce and consume against the running worker" },
      { ok: true, text: "Fully offline — no Cloudflare account required" },
    ],
  },
  {
    id: "b",
    name: "Attached",
    tag: "Mode B",
    command: "npx local-cf",
    summary:
      "What bare local-cf runs. Your own dev server keeps running and local-cf attaches to the state it has already written to disk — read-only, so a first run cannot damage anything.",
    facts: [
      { ok: true, text: "Shares the same files on disk as wrangler dev" },
      { ok: true, text: "Read-only by default; --allow-write once the other server is stopped" },
      { ok: false, text: "Durable Object memory is not visible across processes" },
      { ok: false, text: "Queue consumers belong to the other process" },
    ],
  },
  {
    id: "c",
    name: "Remote",
    tag: "Mode C",
    command: "npx local-cf remote",
    summary:
      "Proxies the Cloudflare REST API against your real account, so the same interface works for production data.",
    facts: [
      { ok: true, text: "Reads and writes your real D1, KV and R2" },
      { ok: true, text: "Same UI, so nothing new to learn" },
      { ok: false, text: "Durable Objects have no REST equivalent" },
      { ok: false, text: "Requires an API token — the only mode that is not offline" },
    ],
  },
] as const;

type ModeId = (typeof MODES)[number]["id"];

export function ModeTabs() {
  // Without the explicit parameter, `as const` narrows the state to just "a".
  const [active, setActive] = useState<ModeId>(MODES[0].id);
  const mode = MODES.find((item) => item.id === active) ?? MODES[0];

  return (
    <div>
      <div role="tablist" aria-label="Modes" className="flex flex-wrap gap-1">
        {MODES.map((item) => {
          const selected = item.id === mode.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`mode-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`mode-panel-${item.id}`}
              onClick={() => setActive(item.id)}
              className={
                selected
                  ? "rounded-lg bg-surface px-3.5 py-2 text-sm font-medium text-fg-strong ring ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  : "rounded-lg px-3.5 py-2 text-sm text-fg-subtle hover:bg-tint hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              }
            >
              <span className="text-fg-muted">{item.tag}</span>{" "}
              <span className="ml-1">{item.name}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`mode-panel-${mode.id}`}
        aria-labelledby={`mode-tab-${mode.id}`}
        className="mt-4 rounded-xl bg-surface px-6 py-5 ring ring-line"
      >
        <code className="font-mono text-sm text-orange-600 dark:text-orange-400">
          $ {mode.command}
        </code>
        <p className="mt-3 max-w-2xl text-fg-subtle">{mode.summary}</p>

        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {mode.facts.map((fact) => (
            <li key={fact.text} className="flex items-start gap-2.5">
              {/* h-lh keeps the icon centred on the first line when text wraps. */}
              <span className="flex h-lh shrink-0 items-center">
                {fact.ok ? (
                  <Check aria-hidden="true" strokeWidth={2} className="size-4 text-success" />
                ) : (
                  <Minus aria-hidden="true" strokeWidth={2} className="size-4 text-fg-muted" />
                )}
              </span>
              <span className={fact.ok ? "text-sm text-fg" : "text-sm text-fg-subtle"}>
                {/* Colour is never the only signal: the icon differs too. */}
                {fact.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
