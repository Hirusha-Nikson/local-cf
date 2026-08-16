"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const DOC_SECTIONS = [
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

const FLAT = DOC_SECTIONS.flatMap((section) => section.pages);

function NavList({ pathname }: { pathname: string }) {
  return (
    <>
      {DOC_SECTIONS.map((section) => (
        <div key={section.title} className="mb-4">
          <p className="px-3 pb-1.5 text-xs font-medium text-fg-subtle">{section.title}</p>
          <ul className="space-y-0.5">
            {section.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "relative block rounded-md py-1.5 pr-2 pl-3 text-sm",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                      active
                        ? "bg-orange-500/10 font-medium text-orange-600 dark:text-orange-500"
                        : "text-fg-subtle hover:bg-tint hover:text-fg",
                    ].join(" ")}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1 left-0.5 w-0.5 rounded-full bg-orange-600"
                      />
                    )}
                    {page.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Docs sidebar.
 *
 * On desktop it is a plain sticky list. Below `md` it collapses behind the
 * current page's name — stacking a full nav above the article pushed the actual
 * content off the first screen on a phone.
 */
export function DocsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const current = FLAT.find((page) => page.href === pathname)?.label ?? "Documentation";

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="docs-nav-mobile"
          className="flex w-full items-center justify-between rounded-lg bg-surface px-4 py-2.5 text-sm ring ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span>
            <span className="text-fg-subtle">Docs</span>{" "}
            <span className="font-medium text-fg-strong">/ {current}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.75}
            className={`size-4 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <nav id="docs-nav-mobile" aria-label="Documentation" className="mt-2">
            <NavList pathname={pathname} />
          </nav>
        )}
      </div>

      <nav aria-label="Documentation" className="hidden md:sticky md:top-20 md:block">
        <NavList pathname={pathname} />
      </nav>
    </>
  );
}

/** Previous / next links, so a doc page is never a dead end. */
export function DocsPager() {
  const pathname = usePathname();
  const index = FLAT.findIndex((page) => page.href === pathname);
  if (index === -1) return null;

  const previous = index > 0 ? FLAT[index - 1] : undefined;
  const next = index < FLAT.length - 1 ? FLAT[index + 1] : undefined;

  return (
    <nav aria-label="Pagination" className="mt-12 flex gap-3 border-t pt-6 hairline">
      {previous && (
        <Link
          href={previous.href}
          className="flex-1 rounded-lg bg-surface px-4 py-3 ring ring-line hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="block text-xs text-fg-subtle">Previous</span>
          <span className="mt-0.5 block text-sm font-medium text-fg-strong">{previous.label}</span>
        </Link>
      )}
      {next && (
        <Link
          href={next.href}
          className="flex-1 rounded-lg bg-surface px-4 py-3 text-right ring ring-line hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="block text-xs text-fg-subtle">Next</span>
          <span className="mt-0.5 block text-sm font-medium text-fg-strong">{next.label}</span>
        </Link>
      )}
    </nav>
  );
}

/** Breadcrumb plus a link to the source of the page being read. */
export function DocsMeta() {
  const pathname = usePathname();
  const current = FLAT.find((page) => page.href === pathname);
  if (!current) return null;

  const file =
    pathname === "/docs"
      ? "apps/site/src/app/docs/page.mdx"
      : `apps/site/src/app${pathname}/page.mdx`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-fg-subtle">
        <Link href="/docs" className="hover:text-fg">
          Docs
        </Link>
        <span aria-hidden="true" className="text-fg-faint">
          /
        </span>
        <span className="font-medium text-fg">{current.label}</span>
      </nav>

      <a
        href={`https://github.com/Hirusha-Nikson/local-cf/edit/main/${file}`}
        className="text-sm text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Edit this page
      </a>
    </div>
  );
}
