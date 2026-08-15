"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

/**
 * The heading's own text, without its anchor.
 *
 * Each heading in mdx-components.tsx ends with a `#` link to itself, and that
 * link is a child node — so plain `textContent` yields "Install#". Stripping it
 * from a clone leaves the original DOM untouched and stays correct no matter
 * where the anchor sits or what else the heading contains.
 */
function headingText(node: HTMLHeadingElement): string {
  const clone = node.cloneNode(true) as HTMLHeadingElement;
  for (const anchor of clone.querySelectorAll('a[href^="#"]')) anchor.remove();
  return (clone.textContent ?? "").trim();
}

/**
 * "On this page", built from the rendered document rather than from the MDX
 * source.
 *
 * Reading the DOM avoids two problems with parsing the markdown: headings can
 * contain inline elements (`## Mode A — shared runtime (\`local-cf\`)`), and a
 * `#` at the start of a line inside a bash fence is a shell comment, not a
 * heading — modes/page.mdx has one. `textContent` and a `h2, h3` query get both
 * right for free.
 */
export function TableOfContents() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLHeadingElement>("article h2[id], article h3[id]"),
    );

    setHeadings(
      nodes.map((node) => ({
        id: node.id,
        text: headingText(node),
        level: Number(node.tagName[1]),
      })),
    );
    setActive(nodes[0]?.id ?? null);

    if (nodes.length === 0) return;

    /*
     * The top band of the viewport is the "current" zone. Without the negative
     * bottom margin every heading below the fold counts as intersecting on
     * load, and the last one would win.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [pathname]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="sticky top-20">
      <p className="px-3 pb-2 text-xs font-medium text-fg-subtle">On this page</p>
      <ul className="space-y-0.5 border-l hairline">
        {headings.map((heading) => {
          const current = heading.id === active;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={current ? "location" : undefined}
                className={[
                  "-ml-px block border-l py-1 pr-2 text-sm",
                  heading.level === 3 ? "pl-6" : "pl-3",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  current
                    ? "border-orange-500 font-medium text-orange-600"
                    : "border-transparent text-fg-subtle hover:text-fg",
                ].join(" ")}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
