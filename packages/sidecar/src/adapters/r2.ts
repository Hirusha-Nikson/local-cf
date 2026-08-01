import type { Env } from "../env.js";
import { findBinding, isRemote, liveBinding } from "../lib/bindings.js";
import { fail } from "../lib/http.js";
import { cfFetch, cfFetchRaw, remoteCredentials } from "../lib/remote.js";

export interface R2ObjectSummary {
  key: string;
  size: number;
  uploaded: string;
  etag: string;
  contentType?: string;
}

export interface R2ListResult {
  objects: R2ObjectSummary[];
  prefixes: string[];
  cursor?: string;
  truncated: boolean;
}

export interface R2Adapter {
  list(options: {
    prefix?: string;
    cursor?: string;
    delimiter?: string;
    limit: number;
  }): Promise<R2ListResult>;
  get(key: string): Promise<Response>;
  put(key: string, body: ArrayBuffer, contentType: string | undefined): Promise<void>;
  delete(key: string): Promise<void>;
}

function localAdapter(env: Env, bindingName: string): R2Adapter {
  const bucket = liveBinding<R2Bucket>(env, bindingName, "R2");
  return {
    async list({ prefix, cursor, delimiter, limit }) {
      const result = await bucket.list({
        limit,
        ...(prefix ? { prefix } : {}),
        ...(cursor ? { cursor } : {}),
        ...(delimiter ? { delimiter } : {}),
        // Supported by workerd and Miniflare, but absent from the pinned
        // @cloudflare/workers-types. Without it `httpMetadata` comes back
        // undefined and the list view loses content types.
        include: ["httpMetadata"],
      } as R2ListOptions);
      return {
        objects: result.objects.map((object) => ({
          key: object.key,
          size: object.size,
          uploaded: object.uploaded.toISOString(),
          etag: object.etag,
          ...(object.httpMetadata?.contentType
            ? { contentType: object.httpMetadata.contentType }
            : {}),
        })),
        prefixes: result.delimitedPrefixes,
        truncated: result.truncated,
        ...(result.truncated ? { cursor: result.cursor } : {}),
      };
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) fail(404, `No object "${key}" in bucket.`);
      const headers = new Headers();
      object.writeHttpMetadata(headers as unknown as Headers);
      headers.set("etag", object.httpEtag);
      headers.set("content-length", String(object.size));
      return new Response(object.body as unknown as ReadableStream, { headers });
    },
    async put(key, body, contentType) {
      await bucket.put(key, body, {
        ...(contentType ? { httpMetadata: { contentType } } : {}),
      });
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

interface RemoteR2Object {
  key: string;
  size: number;
  uploaded: string;
  etag: string;
  http_metadata?: { contentType?: string };
}

function remoteAdapter(env: Env, bucketName: string): R2Adapter {
  const creds = remoteCredentials(env);
  const base = `/accounts/${creds.accountId}/r2/buckets/${bucketName}`;

  return {
    async list({ prefix, cursor, delimiter, limit }) {
      const query = new URLSearchParams({ per_page: String(limit) });
      if (prefix) query.set("prefix", prefix);
      if (cursor) query.set("cursor", cursor);
      if (delimiter) query.set("delimiter", delimiter);
      const body = await cfFetch<RemoteR2Object[]>(creds, `${base}/objects?${query}`);
      const nextCursor = body.result_info?.cursor;
      return {
        objects: (body.result ?? []).map((object) => ({
          key: object.key,
          size: object.size,
          uploaded: object.uploaded,
          etag: object.etag,
          ...(object.http_metadata?.contentType
            ? { contentType: object.http_metadata.contentType }
            : {}),
        })),
        prefixes: [],
        truncated: Boolean(nextCursor),
        ...(nextCursor ? { cursor: nextCursor } : {}),
      };
    },
    async get(key) {
      const response = await cfFetchRaw(creds, `${base}/objects/${encodeURIComponent(key)}`);
      if (!response.ok) fail(404, `No object "${key}" in bucket.`);
      return response;
    },
    async put(key, body, contentType) {
      await cfFetchRaw(creds, `${base}/objects/${encodeURIComponent(key)}`, {
        method: "PUT",
        body,
        ...(contentType ? { headers: { "Content-Type": contentType } } : {}),
      });
    },
    async delete(key) {
      await cfFetchRaw(creds, `${base}/objects/${encodeURIComponent(key)}`, { method: "DELETE" });
    },
  };
}

export async function resolveR2(env: Env, bindingName: string): Promise<R2Adapter> {
  const binding = await findBinding(env, "r2", bindingName);
  return isRemote(env)
    ? remoteAdapter(env, binding.bucketName)
    : localAdapter(env, bindingName);
}
