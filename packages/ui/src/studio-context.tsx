"use client";

import type { StudioMeta } from "@local-cf/core/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_API_BASE, createClient, unwrap, type StudioClient } from "./api";
import { useInterval } from "./hooks";

interface StudioContextValue {
  client: StudioClient;
  baseUrl: string;
  meta: StudioMeta | null;
  error: string | null;
  loading: boolean;
  syncing: boolean;
  lastUpdatedAt: number | null;
  refresh: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

/**
 * Everything the views need, injected rather than imported.
 *
 * SETUP.md §6 asked whether the same React components could serve both the
 * static-exported offline dashboard and the hosted OpenNext site. They can —
 * *because* the only environment-specific value is this base URL. Keeping all
 * data fetching client-side and parameterised is what makes one component tree
 * build for two targets with no adapter layer.
 */
export function StudioProvider({
  children,
  baseUrl = DEFAULT_API_BASE,
}: {
  children: ReactNode;
  baseUrl?: string;
}) {
  const client = useMemo(() => createClient(baseUrl), [baseUrl]);
  const [meta, setMeta] = useState<StudioMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const hasMeta = useRef(false);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const backgroundRefresh = hasMeta.current;

    if (backgroundRefresh) {
      setSyncing(true);
    } else {
      setLoading(true);
    }

    client.meta
      .$get()
      .then((response) => unwrap<StudioMeta>(response))
      .then((value) => {
        if (cancelled) return;
        setMeta(value);
        hasMeta.current = true;
        setLastUpdatedAt(Date.now());
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (!backgroundRefresh) {
          setMeta(null);
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not reach the local-cf API. Is `local-cf` running?",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        if (!cancelled) setSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, nonce]);

  useInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    refresh();
  }, 10000);

  const value = useMemo(
    () => ({ client, baseUrl, meta, error, loading, syncing, lastUpdatedAt, refresh }),
    [client, baseUrl, meta, error, loading, syncing, lastUpdatedAt, refresh],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used inside a <StudioProvider>.");
  }
  return context;
}

/** Bindings of one kind, in config order. */
export function useBindings<K extends StudioMeta["bindings"][number]["kind"]>(kind: K) {
  const { meta } = useStudio();
  return useMemo(
    () =>
      (meta?.bindings ?? []).filter(
        (binding): binding is Extract<StudioMeta["bindings"][number], { kind: K }> =>
          binding.kind === kind,
      ),
    [meta, kind],
  );
}
