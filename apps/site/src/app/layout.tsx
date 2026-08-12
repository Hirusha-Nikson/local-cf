import { ThemeProvider, ThemeToggle, THEME_INIT_SCRIPT } from "@local-cf/ui";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "local-cf — a local-first studio for Cloudflare Workers",
    template: "%s · local-cf",
  },
  description:
    "Browse and edit the exact D1, KV, R2, Durable Objects and Queues your worker is using — in the same runtime, offline.",
};

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/app", label: "Dashboard" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <header className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="grid size-6 place-items-center rounded bg-orange-600 text-xs font-bold text-white">
                  cf
                </span>
                local-cf
              </Link>
              <nav className="ml-auto flex items-center gap-5 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {item.label}
                  </Link>
                ))}
                <a
                  href="https://www.npmjs.com/package/local-cf"
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  npm
                </a>
                <ThemeToggle />
              </nav>
            </div>
          </header>

          {children}

          <footer className="mt-16 border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-zinc-500">
              local-cf · MIT licensed · not affiliated with Cloudflare
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
