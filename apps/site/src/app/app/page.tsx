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
        <h1 className="text-2xl font-bold tracking-tight">Connect to your local studio</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          This page is the same dashboard that ships inside the npm package, but it runs on our
          domain — so it needs the address of the <code className="font-mono">local-cf</code>{" "}
          instance on your machine.
        </p>

        <form
          className="mt-6 flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            window.localStorage.setItem(STORAGE_KEY, draft);
            setBaseUrl(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-64 flex-1 rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
          >
            Connect
          </button>
        </form>

        <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-300">
            You probably do not need this page
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-400">
            Running <code className="font-mono">local-cf</code> already serves the identical
            dashboard at <code className="font-mono">/__local-cf/ui/</code> on your own machine,
            offline and without a cross-origin hop. This hosted copy exists so you can try the UI
            before installing anything.
          </p>
        </div>
      </main>
    );
  }

  return <StudioApp baseUrl={baseUrl} />;
}
