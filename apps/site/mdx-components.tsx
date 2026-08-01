import type { MDXComponents } from "mdx/types";

/**
 * Styling for MDX docs pages. Tailwind utilities are applied here rather than
 * via a prose plugin so docs and app chrome share exactly one type scale.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mb-4 mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-3 mt-10 border-b border-zinc-200 pb-2 text-xl font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="my-3 leading-7 text-zinc-700 dark:text-zinc-300">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-3 list-disc space-y-1.5 pl-6 text-zinc-700 dark:text-zinc-300">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 list-decimal space-y-1.5 pl-6 text-zinc-700 dark:text-zinc-300">
        {children}
      </ol>
    ),
    a: ({ href, children }) => (
      <a href={href} className="text-orange-600 underline underline-offset-2 hover:text-orange-500">
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-orange-700 dark:bg-zinc-800 dark:text-orange-400">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      // Code blocks scroll inside themselves; the page never scrolls sideways.
      <pre className="my-4 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-zinc-300 px-3 py-2 font-semibold dark:border-zinc-700">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">{children}</td>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-2 border-orange-500 bg-orange-50/50 py-1 pl-4 text-zinc-700 dark:bg-orange-950/20 dark:text-zinc-300">
        {children}
      </blockquote>
    ),
    ...components,
  };
}
