import { Logo, ThemeProvider, ThemeToggle, THEME_INIT_SCRIPT } from "@local-cf/ui";
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
      <body className="min-h-screen">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <header className="border-b bg-surface hairline">
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold text-fg-strong">
                <Logo />
                local-cf
              </Link>
              <nav className="ml-auto flex items-center gap-5 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-fg-subtle hover:text-fg"
                  >
                    {item.label}
                  </Link>
                ))}
                <a
                  href="https://www.npmjs.com/package/local-cf"
                  className="rounded-lg bg-contrast px-3 py-1.5 font-medium text-canvas hover:opacity-90"
                >
                  npm
                </a>
                <ThemeToggle />
              </nav>
            </div>
          </header>

          {children}

          <footer className="mt-16 border-t hairline">
            <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-fg-subtle">
              local-cf · MIT licensed · not affiliated with Cloudflare
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
