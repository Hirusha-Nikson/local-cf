"use client";

import { useEffect, useState } from "react";
import { unwrap } from "../api";
import {
  BindingList,
  Button,
  Card,
  Empty,
  ErrorNote,
  Input,
  Spinner,
  Tag,
  Textarea,
} from "../components/primitives";
import { useAction, useAsync } from "../hooks";
import { useBindings, useStudio } from "../studio-context";

interface KVKey {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

interface KVValue {
  key: string;
  value: string | null;
  encoding: "text" | "base64";
  metadata?: unknown;
  size: number;
}

export function KVView() {
  const { client, baseUrl } = useStudio();
  const bindings = useBindings("kv");
  const [binding, setBinding] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!binding && bindings[0]) setBinding(bindings[0].binding);
  }, [bindings, binding]);

  const keys = useAsync(async () => {
    if (!binding) return null;
    return unwrap<{ keys: KVKey[]; listComplete: boolean; cursor?: string }>(
      await client.kv[":binding"].keys.$get({
        param: { binding },
        query: { limit: "500", prefix: prefix || undefined, cursor: undefined, delimiter: undefined },
      }),
    );
  }, [binding, prefix]);

  if (bindings.length === 0) {
    return <Empty>No KV namespaces are declared in your wrangler config.</Empty>;
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[200px_260px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-200 md:border-b-0 md:border-r dark:border-zinc-800">
        <BindingList
          bindings={bindings}
          selected={binding}
          onSelect={(next) => {
            setBinding(next);
            setSelectedKey(null);
          }}
          describe={(item) => item.namespaceId}
        />
      </aside>

      <section className="flex min-h-0 flex-col border-b border-zinc-200 md:border-b-0 md:border-r dark:border-zinc-800">
        <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
          <Input
            placeholder="Filter by prefix…"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {keys.loading ? (
            <Empty>Loading keys…</Empty>
          ) : keys.error ? (
            <div className="p-3">
              <ErrorNote title="Could not list keys" detail={keys.error} />
            </div>
          ) : (keys.data?.keys.length ?? 0) === 0 ? (
            <Empty>No keys{prefix ? ` matching “${prefix}”` : ""}.</Empty>
          ) : (
            <ul>
              {keys.data?.keys.map((key) => (
                <li key={key.name}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(key.name)}
                    className={
                      key.name === selectedKey
                        ? "w-full truncate bg-orange-500/10 px-3 py-1.5 text-left font-mono text-xs text-orange-700 dark:text-orange-400"
                        : "w-full truncate px-3 py-1.5 text-left font-mono text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }
                  >
                    {key.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {keys.data && !keys.data.listComplete && (
          <p className="border-t border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800">
            Showing the first 500 keys. Narrow with a prefix to see more.
          </p>
        )}
      </section>

      <section className="min-w-0 space-y-4 p-4">
        {binding && (
          <>
            <ValueEditor
              key={`${binding}:${selectedKey ?? "new"}`}
              binding={binding}
              selectedKey={selectedKey}
              client={client}
              onChanged={() => keys.reload()}
              onDeleted={() => {
                setSelectedKey(null);
                keys.reload();
              }}
            />
            <ImportExport
              binding={binding}
              baseUrl={baseUrl}
              client={client}
              onImported={() => keys.reload()}
            />
          </>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ValueEditor({
  binding,
  selectedKey,
  client,
  onChanged,
  onDeleted,
}: {
  binding: string;
  selectedKey: string | null;
  client: ReturnType<typeof useStudio>["client"];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [keyName, setKeyName] = useState(selectedKey ?? "");
  const [value, setValue] = useState("");
  const [ttl, setTtl] = useState("");

  const loaded = useAsync(async () => {
    if (!selectedKey) return null;
    return unwrap<KVValue>(
      await client.kv[":binding"].value.$get({
        param: { binding },
        query: { key: selectedKey },
      }),
    );
  }, [binding, selectedKey]);

  useEffect(() => {
    if (loaded.data) setValue(loaded.data.value ?? "");
  }, [loaded.data]);

  const save = useAction(async () => {
    await unwrap(
      await client.kv[":binding"].value.$put({
        param: { binding },
        json: {
          key: keyName,
          value,
          encoding: "text" as const,
          expirationTtl: ttl ? Number.parseInt(ttl, 10) : undefined,
          metadata: undefined,
        },
      }),
    );
    onChanged();
  });

  const remove = useAction(async () => {
    await unwrap(
      await client.kv[":binding"].value.$delete({
        param: { binding },
        query: { key: keyName },
      }),
    );
    onDeleted();
  });

  const isBinary = loaded.data?.encoding === "base64";

  return (
    <Card
      title={selectedKey ? "Edit value" : "New key"}
      actions={
        <>
          {selectedKey && (
            <Button variant="danger" disabled={remove.pending} onClick={() => remove.run()}>
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            disabled={save.pending || keyName === ""}
            onClick={() => save.run()}
          >
            {save.pending ? <Spinner /> : null}
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-4">
        {(save.error || remove.error) && (
          <ErrorNote title="Write failed" detail={save.error ?? remove.error} />
        )}

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Key</span>
          <Input
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
            placeholder="my:key"
            className="font-mono"
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
            Value
            {isBinary && <Tag>base64 — binary value</Tag>}
            {loaded.data && <Tag>{loaded.data.size} bytes</Tag>}
          </span>
          <Textarea
            rows={10}
            value={value}
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>

        <label className="block max-w-xs">
          <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
            Expiration TTL (seconds, optional)
          </span>
          <Input
            value={ttl}
            inputMode="numeric"
            onChange={(event) => setTtl(event.target.value.replace(/\D/g, ""))}
            placeholder="never"
          />
        </label>

        {isBinary && (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            This value is not valid UTF-8, so it is shown base64-encoded. Saving from here would
            store your edit as literal text — download it instead if you need to modify the bytes.
          </p>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function ImportExport({
  binding,
  baseUrl,
  client,
  onImported,
}: {
  binding: string;
  baseUrl: string;
  client: ReturnType<typeof useStudio>["client"];
  onImported: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);

  const importJson = useAction(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as { entries?: { key: string; value: string }[] };
    const entries = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);

    const result = await unwrap<{ written: number; skipped: number }>(
      await client.kv[":binding"].import.$post({ param: { binding }, json: { entries } }),
    );
    setStatus(`Imported ${result.written} key(s), skipped ${result.skipped}.`);
    onImported();
  });

  return (
    <Card title="Import / export">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`${baseUrl}/kv/${encodeURIComponent(binding)}/export`}
            className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Export all as JSON
          </a>
          <label className="cursor-pointer rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
            Import JSON…
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importJson.run(file);
                event.target.value = "";
              }}
            />
          </label>
          {importJson.pending && <Spinner />}
        </div>

        {importJson.error && <ErrorNote title="Import failed" detail={importJson.error} />}
        {status && <p className="text-sm text-emerald-700 dark:text-emerald-400">{status}</p>}

        <p className="text-xs text-zinc-500">
          Import accepts either a bare array or the{" "}
          <code className="font-mono">{`{ "entries": [{ "key", "value" }] }`}</code> shape produced
          by export.
        </p>
      </div>
    </Card>
  );
}
