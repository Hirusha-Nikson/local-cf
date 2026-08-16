import Link from "next/link";
import { DOC_PAGES } from "@/lib/docs";

export const metadata = {
  title: "Page not found",
  /*
   * A 404 that gets indexed is a 404 that shows up in results. Next already
   * serves this with a 404 status, which is the signal that matters, but the
   * meta tag costs nothing and covers crawlers that reach it another way.
   */
  robots: { index: false, follow: true },
};

/**
 * 404.
 *
 * Rendered inside the root layout, so it keeps the nav and footer — a dead end
 * with no way out is the actual failure here, not the missing page. The docs
 * list comes from the same `DOC_PAGES` the sidebar uses, so a page added later
 * shows up here without anyone remembering to add it.
 */
export default function NotFound() {
  const pages = DOC_PAGES;

  return (
    <main className="mx-auto max-w-3xl px-4 py-24">
      <p className="font-mono text-sm text-fg-muted">404</p>

      <h1 className="mt-3 text-3xl font-semibold text-balance text-fg-strong sm:text-4xl">
        That page isn&rsquo;t here.
      </h1>

      <p className="mt-4 text-lg text-pretty text-fg-subtle">
        The link may be out of date, or the page may have moved. Nothing is
        broken on your end.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white ring ring-line hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Back to local-cf
        </Link>
        <Link
          href="/docs"
          className="rounded-lg bg-surface px-5 py-2.5 text-sm font-medium text-fg ring ring-line hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Read the docs
        </Link>
      </div>

      <div className="mt-14 border-t pt-8 hairline">
        <p className="text-sm font-medium text-fg-strong">Documentation</p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {pages.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="text-sm text-link underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {page.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-fg-subtle">
          If you followed a link from somewhere on this site,{" "}
          <a
            href="https://github.com/Hirusha-Nikson/local-cf/issues"
            rel="noopener noreferrer"
            target="_blank"
            className="text-link underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            please report it
          </a>
          .
        </p>
      </div>
    </main>
  );
}
