import type { MDXComponents } from "mdx/types";
import { CodeBlock } from "./src/components/code-block";

/**
 * Anchor for a heading. Shown on hover, and on keyboard focus so it is reachable
 * without a pointer.
 */
function HeadingLink({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <a
      href={`#${id}`}
      aria-label="Link to this section"
      className="ml-2 text-fg-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      #
    </a>
  );
}

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
    h1: ({ children, id }) => (
      <h1 id={id} className="mt-2 mb-4 scroll-mt-20 text-3xl font-semibold text-fg-strong">
        {children}
      </h1>
    ),
    /*
     * `id` arrives from rehype-slug (see next.config.ts). `scroll-mt-20` keeps
     * an anchored heading clear of the sticky site header, and the ¶ link makes
     * the section addressable without hunting for the id.
     */
    h2: ({ children, id }) => (
      <h2
        id={id}
        className="group mt-10 mb-3 scroll-mt-20 border-b pb-2 text-xl font-semibold text-fg-strong hairline"
      >
        {children}
        <HeadingLink id={id} />
      </h2>
    ),
    h3: ({ children, id }) => (
      <h3 id={id} className="group mt-6 mb-2 scroll-mt-20 text-base font-semibold text-fg-strong">
        {children}
        <HeadingLink id={id} />
      </h3>
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
    code: ({ children, className }) =>
      // A fenced block arrives as <pre><code class="language-*">, and already
      // sits on CodeBlock's tinted surface — only inline code gets the chip.
      className ? (
        <code className={className}>{children}</code>
      ) : (
        // Monospace runs large beside body text; 0.9em evens the two out.
        <code className="rounded-md bg-recessed px-1.5 py-0.5 font-mono text-[0.9em] text-fg">
          {children}
        </code>
      ),
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
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
