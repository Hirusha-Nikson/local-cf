import type { Env } from "../env.js";
import { findBinding, isRemote, liveBinding } from "../lib/bindings.js";
import { cfFetch, cfFetchRaw, remoteCredentials } from "../lib/remote.js";

export interface KVKey {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

export interface KVListResult {
  keys: KVKey[];
  cursor?: string;
  listComplete: boolean;
}

export interface KVValue {
  key: string;
  /** UTF-8 text when the value decodes cleanly, otherwise base64. */
  value: string | null;
  encoding: "text" | "base64";
  metadata?: unknown;
  size: number;
}

export interface KVPutOptions {
  expirationTtl?: number;
  metadata?: unknown;
  encoding?: "text" | "base64";
}

export interface KVAdapter {
  list(prefix: string | undefined, cursor: string | undefined, limit: number): Promise<KVListResult>;
  get(key: string): Promise<KVValue>;
  put(key: string, value: string, options: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

/** Prefer readable text; fall back to base64 so binary values stay lossless. */
function decodeValue(buffer: ArrayBuffer): { value: string; encoding: "text" | "base64" } {
  try {
    return { value: decoder.decode(buffer), encoding: "text" };
  } catch {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { value: btoa(binary), encoding: "base64" };
  }
}

function encodeValue(value: string, encoding: "text" | "base64" | undefined): string | ArrayBuffer {
  if (encoding !== "base64") return value;
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function localAdapter(env: Env, bindingName: string): KVAdapter {
  const kv = liveBinding<KVNamespace>(env, bindingName, "KV");
  return {
    async list(prefix, cursor, limit) {
      const result = await kv.list({ limit, ...(prefix ? { prefix } : {}), ...(cursor ? { cursor } : {}) });
      return {
        keys: result.keys.map((key) => ({
          name: key.name,
          ...(key.expiration !== undefined ? { expiration: key.expiration } : {}),
          ...(key.metadata !== undefined ? { metadata: key.metadata } : {}),
        })),
        listComplete: result.list_complete,
        ...(result.list_complete ? {} : { cursor: result.cursor }),
      };
    },
    async get(key) {
      const result = await kv.getWithMetadata(key, "arrayBuffer");
      if (result.value === null) {
        return { key, value: null, encoding: "text", size: 0 };
      }
      const decoded = decodeValue(result.value);
      return {
        key,
        value: decoded.value,
        encoding: decoded.encoding,
        metadata: result.metadata,
        size: result.value.byteLength,
      };
    },
    async put(key, value, options) {
      await kv.put(key, encodeValue(value, options.encoding) as string, {
        ...(options.expirationTtl ? { expirationTtl: options.expirationTtl } : {}),
        ...(options.metadata !== undefined && options.metadata !== null
          ? { metadata: options.metadata }
          : {}),
      });
    },
    async delete(key) {
      await kv.delete(key);
    },
  };
}

function remoteAdapter(env: Env, namespaceId: string): KVAdapter {
  const creds = remoteCredentials(env);
  const base = `/accounts/${creds.accountId}/storage/kv/namespaces/${namespaceId}`;

  return {
    async list(prefix, cursor, limit) {
      const query = new URLSearchParams({ limit: String(limit) });
      if (prefix) query.set("prefix", prefix);
      if (cursor) query.set("cursor", cursor);
      const body = await cfFetch<KVKey[]>(creds, `${base}/keys?${query}`);
      const nextCursor = body.result_info?.cursor;
      return {
        keys: body.result,
        listComplete: !nextCursor,
        ...(nextCursor ? { cursor: nextCursor } : {}),
      };
    },
    async get(key) {
      const response = await cfFetchRaw(creds, `${base}/values/${encodeURIComponent(key)}`);
      if (response.status === 404) return { key, value: null, encoding: "text", size: 0 };
      const buffer = await response.arrayBuffer();
      const decoded = decodeValue(buffer);
      return { key, value: decoded.value, encoding: decoded.encoding, size: buffer.byteLength };
    },
    async put(key, value, options) {
      const form = new FormData();
      form.set("value", value);
      form.set("metadata", JSON.stringify(options.metadata ?? {}));
      await cfFetchRaw(creds, `${base}/values/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: form,
      });
    },
    async delete(key) {
      await cfFetchRaw(creds, `${base}/values/${encodeURIComponent(key)}`, { method: "DELETE" });
    },
  };
}

export async function resolveKV(env: Env, bindingName: string): Promise<KVAdapter> {
  const binding = await findBinding(env, "kv", bindingName);
  return isRemote(env)
    ? remoteAdapter(env, binding.namespaceId)
    : localAdapter(env, bindingName);
}
