"use client";

import { StudioApp } from "@local-cf/ui";
import { useEffect, useState } from "react";

const STORAGE_KEY = "local-cf:base-url";
const DEFAULT_LOCAL = "http://127.0.0.1:8787/__local-cf/api";

/**
 * The hosted copy of the dashboard.
 *
 * Same components as the offline build — the difference is only that here the
 * API base URL has to be asked for, because the studio is running on the
 * user's machine and this page is not. That single injected value is what lets
 * one component tree serve both targets (SETUP.md §6).
 */
export default function HostedDashboardPage() {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState(DEFAULT_LOCAL);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setDraft(stored);
      setBaseUrl(stored);
    }
  }, []);

  if (!baseUrl) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-fg-strong">Connect to your local studio</h1>
        <p className="mt-3 text-fg-subtle">
          This page is the same dashboard that ships inside the npm package, but it runs on our
          domain — so it needs the address of the{" "}
          <code className="font-mono text-[0.9em]">local-cf</code> instance on your machine.
        </p>

        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            window.localStorage.setItem(STORAGE_KEY, draft);
            setBaseUrl(draft);
          }}
        >
          <label className="min-w-64 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-fg">Studio address</span>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 font-mono text-sm text-fg ring ring-line focus:ring-2 focus:ring-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="group relative h-9 overflow-hidden rounded-lg bg-accent-fill px-4 text-sm font-medium text-white ring ring-accent-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[inherit] bg-linear-to-b from-accent-grad to-accent shadow-[inset_0_1px_0_0_var(--color-accent-fill)] group-hover:from-accent-fill"
            />
            <span className="relative">Connect</span>
          </button>
        </form>

        <div className="mt-8 rounded-lg bg-surface px-5 py-4 text-sm ring ring-warning/30">
          <p className="font-semibold text-warning">You probably do not need this page</p>
          <p className="mt-1 text-fg-subtle">
            Running <code className="font-mono text-[0.9em]">local-cf</code> already serves the
            identical dashboard at{" "}
            <code className="font-mono text-[0.9em]">/__local-cf/ui/</code> on your own machine,
            offline and without a cross-origin hop. This hosted copy exists so you can try the UI
            before installing anything.
          </p>
        </div>
      </main>
    );
  }

  return <StudioApp baseUrl={baseUrl} />;
}
