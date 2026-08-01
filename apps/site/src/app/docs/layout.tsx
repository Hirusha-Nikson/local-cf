import Link from "next/link";
import type { ReactNode } from "react";

const PAGES = [
  { href: "/docs", label: "Introduction" },
  { href: "/docs/getting-started", label: "Getting started" },
  { href: "/docs/modes", label: "Modes A / B / C" },
  { href: "/docs/architecture", label: "Architecture" },
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:flex-row">
      <nav className="shrink-0 md:w-48">
        <ul className="space-y-1 text-sm">
          {PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="block rounded-md px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {page.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article className="min-w-0 flex-1">{children}</article>
    </main>
  );
}
