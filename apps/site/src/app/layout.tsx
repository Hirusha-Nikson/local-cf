import { ThemeProvider, THEME_INIT_SCRIPT } from "@local-cf/ui";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import { SiteNav } from "../components/site-nav";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const DESCRIPTION =
  "Browse and edit the exact D1, KV, R2, Durable Objects and Queues your worker is using — in the same runtime, offline, with no Cloudflare account.";

export const metadata: Metadata = {
  // Required for the relative OG and canonical URLs below to resolve.
  metadataBase: new URL("https://www.local-cf.com"),
  title: {
    default: "local-cf — a local-first studio for Cloudflare Workers",
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
  openGraph: {
    type: "website",
    siteName: "local-cf",
    url: "/",
    title: "local-cf — a local-first studio for Cloudflare Workers",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "local-cf — a local-first studio for Cloudflare Workers",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const FOOTER = [
  {
    title: "Product",
    links: [
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/modes", label: "Modes A / B / C" },
    ],
  },
  {
    title: "Reference",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/architecture", label: "Architecture" },
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
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen" cz-shortcut-listen="true">
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
              </div>

              {FOOTER.map((column) => (
                <div key={column.title}>
                  <p className="text-sm font-medium text-fg-strong">{column.title}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
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
              <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-fg-subtle">
                MIT licensed · not affiliated with Cloudflare
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
