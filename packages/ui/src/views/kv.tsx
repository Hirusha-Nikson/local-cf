"use client";

import { useEffect, useState } from "react";
import { unwrap } from "../api";
import {
  BindingList,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  SkeletonList,
  Spinner,
  Tag,
  Textarea,
  cx,
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
    <div className="grid grid-cols-1 md:h-full md:grid-cols-[220px_260px_minmax(0,1fr)]">
      <aside
        className="border-b hairline md:sticky md:top-0 md:h-full md:overflow-y-auto md:border-b-0 md:border-r"
        style={{ background: "var(--surface-raised)" }}
      >
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

      <section
        className="flex min-h-0 flex-col border-b hairline md:sticky md:top-0 md:h-full md:border-b-0 md:border-r"
        style={{ background: "var(--surface-raised)" }}
      >
        <div className="border-b p-2 hairline">
          <Input
            placeholder="Filter by prefix…"
            aria-label="Filter keys by prefix"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {keys.loading ? (
            <SkeletonList rows={8} />
          ) : keys.error ? (
            <div className="p-3">
              <ErrorNote title="Could not list keys" detail={keys.error} />
            </div>
          ) : (keys.data?.keys.length ?? 0) === 0 ? (
            <Empty>No keys{prefix ? ` matching “${prefix}”` : ""}.</Empty>
          ) : (
            <ul className="p-1">
              {keys.data?.keys.map((key) => (
                <li key={key.name}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(key.name)}
                    aria-current={key.name === selectedKey ? "true" : undefined}
                    className={cx(
                      "w-full truncate rounded px-2 py-1.5 text-left font-mono text-xs transition-colors",
                      key.name === selectedKey
                        ? "bg-orange-50 font-medium text-orange-800 dark:bg-orange-500/10 dark:text-orange-400"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                    )}
                  >
                    {key.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-3 py-2 hairline surface-sunken">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">
              {keys.data?.keys.length ?? 0} key{(keys.data?.keys.length ?? 0) === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              className="px-2 py-0.5 text-xs"
              onClick={() => setSelectedKey(null)}
            >
              + New key
            </Button>
          </div>
          {keys.data && !keys.data.listComplete && (
            <p className="mt-1 text-[11px] text-zinc-500">
              First 500 shown — narrow with a prefix to see more.
            </p>
          )}
        </div>
      </section>

      <div className="min-w-0 space-y-4 p-4 md:p-6">
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
      </div>
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
      <div className="space-y-4 p-4">
        {(save.error || remove.error) && (
          <ErrorNote title="Write failed" detail={save.error ?? remove.error} />
        )}

        <Field label="Key">
          <Input
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
            placeholder="my:key"
            className="font-mono"
          />
        </Field>

        <Field
          label="Value"
          hint={
            <>
              {isBinary && <Tag>base64 · binary</Tag>}
              {loaded.data && <Tag>{loaded.data.size} bytes</Tag>}
            </>
          }
        >
          <Textarea
            rows={12}
            value={value}
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>

        <div className="max-w-xs">
          <Field label="Expiration TTL (seconds, optional)">
            <Input
              value={ttl}
              inputMode="numeric"
              onChange={(event) => setTtl(event.target.value.replace(/\D/g, ""))}
              placeholder="never"
            />
          </Field>
        </div>

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
    <Card
      title="Import / export"
      footer={
        <>
          Import accepts either a bare array or the{" "}
          <code className="font-mono">{`{ "entries": [{ "key", "value" }] }`}</code> shape produced
          by export.
        </>
      }
    >
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`${baseUrl}/kv/${encodeURIComponent(binding)}/export`}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Export all as JSON
          </a>
          <label className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
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
      </div>
    </Card>
  );
}