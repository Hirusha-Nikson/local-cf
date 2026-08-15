"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Copies `value` to the clipboard and confirms it for a moment.
 *
 * The confirmation is announced politely as well as shown, because a tick
 * replacing an icon is invisible to anyone not looking at it.
 */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A click just before unmount would otherwise set state on a dead component.
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // Denied permission or an insecure origin: leave the UI untouched
          // rather than claiming a copy that did not happen.
          return;
        }
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      }}
      aria-label={copied ? "Copied" : label}
      className="rounded-md p-1.5 text-fg-subtle hover:bg-tint hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {copied ? (
        <Check aria-hidden="true" strokeWidth={1.75} className="size-4 text-success" />
      ) : (
        <Copy aria-hidden="true" strokeWidth={1.75} className="size-4" />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
