/**
 * The docs table of contents — the one place a page is registered.
 *
 * Deliberately a plain module and not part of `components/docs-nav.tsx`, which
 * carries a `"use client"` directive. Importing a value across that boundary
 * from a server component does not hand you the array; it hands you a client
 * reference proxy, and the first `.map` on it fails at prerender time. Keeping
 * the data here lets the client sidebar and the server-rendered 404 share one
 * list instead of two that drift.
 */
export interface DocPage {
  href: string;
  label: string;
}

export interface DocSection {
  title: string;
  pages: DocPage[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Start here",
    pages: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/getting-started", label: "Getting started" },
    ],
  },
  {
    title: "Guides",
    pages: [
      { href: "/docs/modes", label: "Modes A / B / C" },
      { href: "/docs/features", label: "Features" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { href: "/docs/cli", label: "CLI reference" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/troubleshooting", label: "Troubleshooting" },
    ],
  },
];

/** Every docs page in sidebar order — what the pager walks. */
export const DOC_PAGES: DocPage[] = DOC_SECTIONS.flatMap((section) => section.pages);
