import { ThemeProvider, THEME_INIT_SCRIPT } from "@local-cf/ui";
import { Heart } from "lucide-react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import { SiteNav } from "../components/site-nav";
import "./globals.css";
import { Geist } from "next/font/google";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { REVIEW_FORM_URL } from "@/lib/testimonial-display";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

// Shared with the JSON-LD graph — see lib/site.ts for how it is written.
const DESCRIPTION = SITE_DESCRIPTION;

/**
 * The headline on a social card, kept under 60 characters.
 *
 * Written once and used by both `openGraph` and `twitter`, because the two
 * drifting apart means a link renders differently depending on where it was
 * pasted, and nobody notices until someone screenshots it.
 */
const SOCIAL_TITLE = "See inside your Worker's storage, without leaving localhost";

const X_HANDLE = "@HirushaNikson";

const SPONSOR_URL = "https://github.com/sponsors/Hirusha-Nikson";

export const metadata: Metadata = {
  // Required for the relative OG and canonical URLs below to resolve.
  metadataBase: new URL(SITE_URL),
  title: {
    // Brand last: nobody is searching for "local-cf" yet, they are searching
    // for the problem. ~60 characters, before Google truncates.
    default: "Local D1, KV & R2 browser for Cloudflare Workers — local-cf",
    template: "%s · local-cf",
  },
  description: DESCRIPTION,
  applicationName: "local-cf",
  keywords: [
    "cloudflare workers",
    "d1",
    "kv",
    "r2",
    "durable objects",
    "queues",
    "miniflare",
    "workerd",
    "local development",
  ],
  alternates: { canonical: "/" },
  /*
   * Social cards are not search results, so they get different copy.
   * Nothing is ranked here — a human decides in one second whether to click —
   * so these match the hero and the OG image rather than the keyword-led
   * `title` above. Both fall back to the shared opengraph-image.tsx.
   */
  openGraph: {
    type: "website",
    siteName: "local-cf",
    url: "/",
    /*
     * 59 characters. The full sentence — "See inside your Cloudflare Worker's
     * storage, without leaving localhost" — is 70, which X truncates in a card,
     * and it is already set in 53px type inside the OG image directly above
     * this line. "Cloudflare" is the word the image can carry and this cannot.
     */
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    // Declares which audience this is written for. One locale, because there
    // is one translation.
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    /*
     * `site` attributes the card to an account, `creator` to a byline. It is
     * the same person here, and X wants both present to show either.
     */
    site: X_HANDLE,
    creator: X_HANDLE,
  },
  robots: { index: true, follow: true },
};

/**
 * Colour the browser chrome around the page — the address bar on Android
 * Chrome, the title bar on installed windows.
 *
 * Two entries, not one: the site follows the system theme, and a single dark
 * theme-color leaves a light page sitting under dark chrome. `media` lets the
 * browser pick the one that matches, and the values are the same `canvas`
 * token each theme paints the page with.
 *
 * Separate `viewport` export because Next 14 moved `themeColor` out of
 * `metadata`; leaving it there builds fine but silently emits nothing.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#030303" },
  ],
};

const FOOTER = [
  {
    title: "Product",
    links: [
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/modes", label: "Modes A / B / C" },
      // Leaves the site for a Google Form, so unlike the other footer links
      // this one opens in a new tab rather than navigating away mid-visit.
      { href: REVIEW_FORM_URL, label: "Add your review", external: true },
    ],
  },
  {
    title: "Reference",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/reviews", label: "Reviews" },
      { href: "https://www.npmjs.com/package/local-cf", label: "npm package" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "https://github.com/Hirusha-Nikson/local-cf", label: "Source" },
      { href: "https://github.com/Hirusha-Nikson/local-cf/issues", label: "Issues" },
      {
        href: "https://github.com/Hirusha-Nikson/local-cf/blob/main/CONTRIBUTING.md",
        label: "Contributing",
      },
      { href: SPONSOR_URL, label: "Sponsor", external: true },
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          {/* Keyboard users should not have to tab through the nav on every page. */}
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:ring focus:ring-line"
          >
            Skip to content
          </a>

          <SiteNav />
          <div id="content">{children}</div>

          <footer className="mt-24 border-t hairline">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-semibold text-fg-strong">local-cf</p>
                <p className="mt-1.5 max-w-xs text-sm text-fg-subtle">
                  Your data. Your runtime. No account.
                </p>

                {/*
                  Repeated from the "Project" column on purpose. That column is
                  the correct home for it, but a fourth grey link in a list of
                  four is read by nobody; this block sits top-left where the
                  footer is actually scanned, and the heart gives it a shape
                  the surrounding text doesn't have.
                */}
                <a
                  href={SPONSOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Heart aria-hidden="true" className="size-3.5 text-rose-500" />
                  Sponsor this project
                </a>
              </div>

              {FOOTER.map((column) => (
                <div key={column.title}>
                  <p className="text-sm font-medium text-fg-strong">{column.title}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          {...("external" in link && link.external
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                          className="text-sm text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t hairline">
              <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 px-4 py-5 text-sm text-fg-subtle">
                <span>MIT licensed · not affiliated with Cloudflare</span>
                <span aria-hidden="true" className="text-fg-faint">
                  ·
                </span>
                <Link
                  href="/privacy"
                  className="hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Privacy
                </Link>
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
