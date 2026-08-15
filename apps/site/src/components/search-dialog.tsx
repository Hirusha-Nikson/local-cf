"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import INDEX from "../lib/search-index.json";

interface Entry {
  path: string;
  page: string;
  heading: string;
  id: string;
  text: string;
}

const ENTRIES = INDEX as Entry[];
const MAX_RESULTS = 8;

/**
 * Rank a section against the query.
 *
 * Deliberately a hand-rolled scorer rather than a search library: the index is
 * fifteen sections, so anything cleverer would cost more bytes than the corpus
 * it searches. Every term must appear somewhere, and a term in the heading is
 * worth far more than one buried in the body.
 */
function score(entry: Entry, terms: string[]): number {
  const heading = entry.heading.toLowerCase();
  const page = entry.page.toLowerCase();
  const text = entry.text.toLowerCase();

  let total = 0;
  for (const term of terms) {
    const inHeading = heading.includes(term);
    const inPage = page.includes(term);
    const inText = text.includes(term);
    if (!inHeading && !inPage && !inText) return 0;

    if (heading.startsWith(term)) total += 12;
    else if (inHeading) total += 8;
    if (inPage) total += 3;
    if (inText) total += 1;
  }
  return total;
}

/** The matching region, so a result shows why it matched. */
function excerpt(entry: Entry, terms: string[]): string {
  const lower = entry.text.toLowerCase();
  const at = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  if (at.length === 0) return entry.text.slice(0, 110);
  const start = Math.max(0, Math.min(...at) - 40);
  return `${start > 0 ? "…" : ""}${entry.text.slice(start, start + 130)}`;
}

export function SearchDialog() {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );

  const results = useMemo(() => {
    if (terms.length === 0) return [];
    return ENTRIES.map((entry) => ({ entry, rank: score(entry, terms) }))
      .filter((item) => item.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, MAX_RESULTS)
      .map((item) => item.entry);
  }, [terms]);

  // ⌘K / Ctrl+K from anywhere, and "/" when not already typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function goTo(entry: Entry) {
    setOpen(false);
    router.push(`${entry.path}#${entry.id}`);
  }

  /*
   * Arrow keys move a virtual cursor rather than DOM focus: focus stays in the
   * input so typing never breaks, and `aria-activedescendant` tells assistive
   * tech which option is current. Escape, the focus trap, the portal and the
   * scroll lock all come from the Dialog primitive.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (value + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (value - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      const entry = results[cursor];
      if (entry) {
        event.preventDefault();
        goTo(entry);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center gap-2 rounded-lg bg-surface py-1.5 pr-1.5 pl-3 text-sm text-fg-subtle ring ring-line hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
        <span>Search docs</span>
        <kbd className="ml-auto rounded bg-recessed px-1.5 py-0.5 font-mono text-xs text-fg-muted">
          ⌘ + K
        </kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setCursor(0);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          // A command palette sits high and is wider than the default dialog.
          className="top-[12vh] max-w-xl translate-y-0 gap-0 p-0 sm:max-w-xl"
          onKeyDown={onKeyDown}
        >
          <DialogTitle className="sr-only">Search documentation</DialogTitle>
          <DialogDescription className="sr-only">
            Find a section by title or content. Use the arrow keys to move between results.
          </DialogDescription>

          <div className="flex items-center gap-2.5 border-b px-4 hairline">
            <Search
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4 shrink-0 text-fg-subtle"
            />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
              type="text"
              placeholder="Search the docs…"
              aria-label="Search documentation"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              aria-activedescendant={results[cursor] ? `${listId}-${cursor}` : undefined}
              className="w-full bg-transparent py-3.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none"
            />
          </div>

          {query.length > 0 && results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-subtle">
              No matches for &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-2">
              {results.map((entry, index) => (
                <li key={`${entry.path}${entry.id}`}>
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === cursor}
                    tabIndex={-1}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => goTo(entry)}
                    className={[
                      "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left",
                      index === cursor ? "bg-tint" : "",
                    ].join(" ")}
                  >
                    <span className="flex h-lh shrink-0 items-center">
                      <FileText
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-4 text-fg-subtle"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg-strong">
                        {entry.heading}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-muted">
                        {entry.page}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-fg-subtle">
                        {excerpt(entry, terms)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-fg-muted hairline">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono">↵</kbd> open
            </span>
            <span>
              <kbd className="font-mono">esc</kbd> close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
