import type { Env } from "../env.js";
import { fail } from "./http.js";

const API_BASE = "https://api.cloudflare.com/client/v4";

export interface RemoteCredentials {
  accountId: string;
  apiToken: string;
}

/**
 * Mode C only. Credentials are supplied by the CLI as plain vars; they never
 * touch the browser, which keeps the token out of devtools/localStorage.
 */
export function remoteCredentials(env: Env): RemoteCredentials {
  const accountId = env.LOCAL_CF_ACCOUNT_ID;
  const apiToken = env.LOCAL_CF_API_TOKEN;
  if (!accountId || !apiToken) {
    fail(
      503,
      "Remote mode is not configured.",
      "Run `local-cf remote --account-id <id> --api-token <token>`, or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
    );
  }
  return { accountId, apiToken };
}

interface CloudflareEnvelope<T> {
  success: boolean;
  result: T;
  errors?: { code: number; message: string }[];
  result_info?: { cursor?: string; count?: number; total_count?: number };
}

/** Call the Cloudflare REST API and unwrap its standard envelope. */
export async function cfFetch<T>(
  creds: RemoteCredentials,
  path: string,
  init: RequestInit = {},
): Promise<CloudflareEnvelope<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
      ...(init.body && !(init.body instanceof ReadableStream)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      fail(500, `Cloudflare API returned ${response.status}.`, await response.text());
    }
    // Binary payloads (R2 object bodies) are handled by the caller instead.
    return { success: true, result: response as unknown as T };
  }

  const body = (await response.json()) as CloudflareEnvelope<T>;
  if (!response.ok || body.success === false) {
    const detail = body.errors?.map((e) => `${e.code}: ${e.message}`).join("; ");
    fail(500, `Cloudflare API error (${response.status}).`, detail ?? (await response.text()));
  }
  return body;
}

/** Raw variant for endpoints that stream bytes rather than JSON. */
export async function cfFetchRaw(
  creds: RemoteCredentials,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}
