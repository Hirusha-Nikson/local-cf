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
} from "../components/primitives";
import { useAction, useAsync } from "../hooks";
import { useBindings, useStudio } from "../studio-context";

interface R2ObjectSummary {
  key: string;
  size: number;
  uploaded: string;
  etag: string;
  contentType?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function R2View() {
  const { client, baseUrl } = useStudio();
  const bindings = useBindings("r2");
  const [binding, setBinding] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (!binding && bindings[0]) setBinding(bindings[0].binding);
  }, [bindings, binding]);

  const objects = useAsync(async () => {
    if (!binding) return null;
    return unwrap<{ objects: R2ObjectSummary[]; prefixes: string[]; truncated: boolean }>(
      await client.r2[":binding"].objects.$get({
        param: { binding },
        // Every validated key is named explicitly: the RPC type treats them as
        // present-but-possibly-undefined, which is what catches typos.
        query: { limit: "500", prefix: prefix || undefined, cursor: undefined, delimiter: undefined },
      }),
    );
  }, [binding, prefix]);

  const upload = useAction(async (file: File) => {
    if (!binding) return;
    /*
     * Plain fetch rather than the RPC client: `hc` models JSON and form bodies,
     * not raw binary, and buffering a file through JSON would be wasteful.
     * Every other call in the dashboard goes through the typed client.
     */
    const url = `${baseUrl}/r2/${encodeURIComponent(binding)}/object?key=${encodeURIComponent(`${prefix}${file.name}`)}`;
    await unwrap(
      await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      }),
    );
    objects.reload();
  });

  const remove = useAction(async (key: string) => {
    if (!binding) return;
    await unwrap(
      await client.r2[":binding"].object.$delete({ param: { binding }, query: { key } }),
    );
    objects.reload();
  });

  if (bindings.length === 0) {
    return <Empty>No R2 buckets are declared in your wrangler config.</Empty>;
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-200 md:border-b-0 md:border-r dark:border-zinc-800">
        <BindingList
          bindings={bindings}
          selected={binding}
          onSelect={setBinding}
          describe={(item) => item.bucketName}
        />
      </aside>

      <div className="min-w-0 space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Filter by prefix…"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
          />
          <label className="cursor-pointer rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500">
            Upload file…
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.run(file);
                event.target.value = "";
              }}
            />
          </label>
          {upload.pending && <Spinner />}
        </div>

        {(upload.error || remove.error) && (
          <ErrorNote title="Operation failed" detail={upload.error ?? remove.error} />
        )}

        <Card
          title="Objects"
          actions={<Tag>{objects.data?.objects.length ?? 0} shown</Tag>}
        >
          {objects.loading ? (
            <Empty>Loading objects…</Empty>
          ) : objects.error ? (
            <div className="p-4">
              <ErrorNote title="Could not list objects" detail={objects.error} />
            </div>
          ) : (objects.data?.objects.length ?? 0) === 0 ? (
            <Empty>This bucket is empty{prefix ? ` under “${prefix}”` : ""}.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <th className="px-4 py-2 font-semibold">Key</th>
                    <th className="px-4 py-2 font-semibold">Size</th>
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Uploaded</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {objects.data?.objects.map((object) => (
                    <tr
                      key={object.key}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                    >
                      <td className="max-w-md truncate px-4 py-2 font-mono text-xs">{object.key}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {formatBytes(object.size)}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500">
                        {object.contentType ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-500">
                        {new Date(object.uploaded).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <a
                          href={`${baseUrl}/r2/${encodeURIComponent(binding ?? "")}/object?key=${encodeURIComponent(object.key)}`}
                          className="mr-2 text-xs font-medium text-zinc-600 hover:text-orange-600 dark:text-zinc-400"
                        >
                          Download
                        </a>
                        <Button
                          variant="danger"
                          className="px-2 py-0.5 text-xs"
                          disabled={remove.pending}
                          onClick={() => remove.run(object.key)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {objects.data?.truncated && (
          <p className="text-xs text-zinc-500">
            More objects exist than are shown. Narrow the prefix to page through them.
          </p>
        )}
      </div>
    </div>
  );
}
