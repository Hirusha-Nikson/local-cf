"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

function describe(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

/** Run an async task on mount and whenever `deps` change. */
export function useAsync<T>(task: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    taskRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describe(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** An async action bound to a button: tracks in-flight state and the last error. */
export function useAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
): {
  run: (...args: Args) => void;
  pending: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;

  const run = useCallback((...args: Args) => {
    setPending(true);
    setError(null);
    actionRef
      .current(...args)
      .catch((cause: unknown) => setError(describe(cause)))
      .finally(() => setPending(false));
  }, []);

  return { run, pending, error, clearError: useCallback(() => setError(null), []) };
}

/**
 * Poll on an interval.
 *
 * Used for the log tail: the worker's console output lives in the Node process,
 * so the dashboard cannot subscribe to it directly and a cursor-based poll is
 * both simpler and more robust than a stream through two hops.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
