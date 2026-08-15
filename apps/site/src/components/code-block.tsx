"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A docs code block with a copy button.
 *
 * The text is read off the DOM node at click time rather than threaded through
 * props: MDX hands `pre` a nested `code` element whose children may be an array
 * of strings and elements, and `textContent` is both simpler and exactly what
 * the reader sees.
 */
export function CodeBlock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="group relative my-4">
      <pre
        ref={ref}
        // Code blocks scroll inside themselves; the page never scrolls sideways.
        className="overflow-x-auto rounded-lg bg-recessed px-4 py-3 text-sm leading-relaxed ring ring-line"
      >
        {children}
      </pre>

      <button
        type="button"
        onClick={async () => {
          const text = ref.current?.textContent ?? "";
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            return;
          }
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        }}
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute top-2 right-2 rounded-md bg-surface p-1.5 text-fg-subtle opacity-0 ring ring-line group-hover:opacity-100 hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copied ? (
          <Check aria-hidden="true" strokeWidth={1.75} className="size-3.5 text-success" />
        ) : (
          <Copy aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
        )}
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
