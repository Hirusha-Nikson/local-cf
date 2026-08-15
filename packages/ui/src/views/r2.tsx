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
  SkeletonTable,
  SplitView,
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

  const total = objects.data?.objects.reduce((sum, object) => sum + object.size, 0) ?? 0;

  return (
    <SplitView
      sidebar={
        <BindingList
          bindings={bindings}
          selected={binding}
          onSelect={setBinding}
          describe={(item) => item.bucketName}
          label="Buckets"
        />
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Filter by prefix…"
          aria-label="Filter objects by prefix"
          value={prefix}
          onChange={(event) => setPrefix(event.target.value)}
        />
        {/* A label, not a button, so the hidden file input stays keyboard-reachable. */}
        <label className="group relative inline-flex h-9 cursor-pointer items-center overflow-hidden rounded-lg bg-accent-fill px-3 text-sm font-medium text-white ring ring-accent-ring focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[inherit] bg-linear-to-b from-accent-grad to-accent shadow-[inset_0_1px_0_0_var(--color-accent-fill)] group-hover:from-accent-fill"
          />
          <span className="relative">Upload file…</span>
          <input
            type="file"
            className="sr-only"
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
        actions={
          <>
            <Tag>{objects.data?.objects.length ?? 0} shown</Tag>
            {total > 0 && <Tag>{formatBytes(total)}</Tag>}
          </>
        }
        footer={
          objects.data?.truncated
            ? "More objects exist than are shown. Narrow the prefix to page through them."
            : undefined
        }
      >
        {objects.loading ? (
          <SkeletonTable columns={5} rows={8} />
        ) : objects.error ? (
          <div className="px-5 py-4">
            <ErrorNote title="Could not list objects" detail={objects.error} />
          </div>
        ) : (objects.data?.objects.length ?? 0) === 0 ? (
          <Empty>This bucket is empty{prefix ? ` under “${prefix}”` : ""}.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky top-0 z-10 border-b px-4 py-2 text-sm font-medium text-fg-subtle hairline bg-recessed">
                    Key
                  </th>
                  <th scope="col" className="sticky top-0 z-10 border-b px-4 py-2 text-sm font-medium text-fg-subtle hairline bg-recessed">
                    Size
                  </th>
                  <th scope="col" className="sticky top-0 z-10 border-b px-4 py-2 text-sm font-medium text-fg-subtle hairline bg-recessed">
                    Type
                  </th>
                  <th scope="col" className="sticky top-0 z-10 border-b px-4 py-2 text-sm font-medium text-fg-subtle hairline bg-recessed">
                    Uploaded
                  </th>
                  <th scope="col" className="border-b px-4 py-2 hairline bg-recessed">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {objects.data?.objects.map((object) => (
                  <tr key={object.key} className="border-b last:border-0 hairline">
                    <td className="max-w-md truncate px-4 py-2 font-mono text-sm">{object.key}</td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-fg-subtle">
                      {formatBytes(object.size)}
                    </td>
                    <td className="px-4 py-2 text-sm text-fg-subtle">{object.contentType ?? "—"}</td>
                    <td className="px-4 py-2 text-sm whitespace-nowrap text-fg-subtle">
                      {new Date(object.uploaded).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <a
                        href={`${baseUrl}/r2/${encodeURIComponent(binding ?? "")}/object?key=${encodeURIComponent(object.key)}`}
                        className="mr-3 text-sm font-medium text-link hover:underline"
                      >
                        Download
                      </a>
                      <Button
                        variant="danger"
                        size="sm"
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
    </SplitView>
  );
}