import type { MDXComponents } from "mdx/types";

/**
 * Styling for MDX docs pages. Tailwind utilities are applied here rather than
 * via a prose plugin so docs and app chrome share exactly one type scale.
 *
 * Prose stays at 16px — the 14px content rule is for dense product surfaces,
 * not long-form reading. Everything else follows the same rules as the studio:
 * sentence-case headings, no letter-spacing, blue links rather than the brand
 * orange, and rings instead of borders wherever a shadow is involved.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-2 mb-4 text-3xl font-semibold text-fg-strong">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-10 mb-3 border-b pb-2 text-xl font-semibold text-fg-strong hairline">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-6 mb-2 text-base font-semibold text-fg-strong">{children}</h3>
    ),
    p: ({ children }) => <p className="my-3 leading-7 text-fg">{children}</p>,
    ul: ({ children }) => (
      <ul className="my-3 list-disc space-y-1.5 pl-6 text-fg">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 list-decimal space-y-1.5 pl-6 text-fg">{children}</ol>
    ),
    a: ({ href, children }) => (
      // Cloudflare uses blue for inline links, never the brand orange.
      <a href={href} className="text-link underline underline-offset-2">
        {children}
      </a>
    ),
    code: ({ children }) => (
      // Monospace runs large beside body text; 0.9em evens the two out.
      <code className="rounded-md bg-recessed px-1.5 py-0.5 font-mono text-[0.9em] text-fg">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      // Code blocks scroll inside themselves; the page never scrolls sideways.
      <pre className="my-4 overflow-x-auto rounded-lg bg-recessed px-4 py-3 text-sm leading-relaxed ring ring-line">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b px-3 py-2 font-medium text-fg-subtle hairline">{children}</th>
    ),
    td: ({ children }) => <td className="border-b px-3 py-2 hairline">{children}</td>,
    blockquote: ({ children }) => (
      <blockquote className="my-4 rounded-r-lg border-l-2 border-accent bg-recessed py-2 pl-4 text-fg">
        {children}
      </blockquote>
    ),
    ...components,
  };
}
