"use client";

import type { ApiType } from "@local-cf/sidecar";
import { hc } from "hono/client";

/**
 * The typed client.
 *
 * `hc<ApiType>` gives the dashboard end-to-end types straight from the sidecar's
 * route definitions — no OpenAPI document, no codegen step, no drift. This is
 * the concrete payoff SETUP.md §2 attributes to building the sidecar on Hono.
 */
export type StudioClient = ReturnType<typeof hc<ApiType>>;

export function createClient(baseUrl: string): StudioClient {
  return hc<ApiType>(baseUrl);
}

/** Default base URL when the dashboard is served by the sidecar itself. */
export const DEFAULT_API_BASE = "/__local-cf/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Unwrap a Hono RPC response, turning the sidecar's error shape into a throw. */
export async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with ${response.status}.`;
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { error?: string; detail?: string };
      if (body.error) message = body.error;
      detail = body.detail;
    } catch {
      // Non-JSON error body; keep the status-code message.
    }
    throw new ApiError(message, detail, response.status);
  }
  return (await response.json()) as T;
}
