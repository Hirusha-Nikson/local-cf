"use client";

import { Logo, ThemeToggle } from "@local-cf/ui";
import { Heart, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitHubIcon, NpmIcon } from "./brand-icons";
import { SearchDialog } from "./search-dialog";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/docs", label: "Docs" },
];

const GITHUB = "https://github.com/Hirusha-Nikson/local-cf";
const NPM = "https://www.npmjs.com/package/local-cf";
const SPONSOR = "https://github.com/sponsors/Hirusha-Nikson";

const EXTERNAL = [
  { href: GITHUB, label: "GitHub", icon: GitHubIcon },
  { href: NPM, label: "npm", icon: NpmIcon },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A route change should never leave the drawer hanging open behind the page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b bg-canvas/80 backdrop-blur hairline">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-fg-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Logo />
          local-cf
        </Link>

        <div className="ml-auto hidden md:block">
          <SearchDialog />
        </div>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-md px-2.5 py-1.5 text-sm",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  active ? "font-medium text-fg-strong" : "text-fg-subtle hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-hairline" />

          {/*
            Marks rather than words: "Docs / GitHub / npm" plus a search field
            and a three-way theme toggle made the bar read as a wall of text,
            and both logos are recognisable enough to carry the meaning. The
            accessible name still says the word.
          */}
          {EXTERNAL.map((item) => (
            <Link
              target="_blank"
              key={item.href}
              href={item.href}
              title={item.label}
              className="rounded-md p-2 text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <item.icon className="size-4" />
              <span className="sr-only">{item.label}</span>
            </Link>
          ))}

          {/*
            A bordered button rather than a fourth icon-only mark: this is a
            call to action, not another destination, and the heart carries the
            meaning faster than the word alone. Rose, not `accent` — the blue
            belongs to the primary `npx local-cf` CTA and a second blue button
            in the same viewport would split the emphasis.
          */}
          <a
            href={SPONSOR}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-fg-subtle ring ring-line hover:bg-tint hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Heart aria-hidden="true" className="size-3.5 text-rose-500" />
            Sponsor
          </a>

          <span aria-hidden="true" className="mx-1 h-5 w-px bg-hairline" />
          <ThemeToggle />
        </nav>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-md p-1.5 text-fg-subtle hover:bg-tint hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {open ? (
              <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
            ) : (
              <Menu aria-hidden="true" strokeWidth={1.75} className="size-5" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t bg-canvas px-4 py-2 hairline md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2.5 py-2 text-sm text-fg hover:bg-tint"
            >
              {item.label}
            </Link>
          ))}

          {/*
            Plain anchors, not `next/link`: these leave the site, so the router
            has nothing to prefetch or handle. The drawer has room for the mark
            *and* the word, so it keeps both.
          */}
          {EXTERNAL.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg hover:bg-tint"
            >
              <item.icon className="size-4 text-fg-subtle" />
              {item.label}
            </a>
          ))}

          <a
            href={SPONSOR}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg hover:bg-tint"
          >
            <Heart aria-hidden="true" className="size-4 text-rose-500" />
            Sponsor
          </a>

          {/* Search belongs on a phone too — the ⌘K shortcut is desktop-only. */}
          <div className="px-2.5 pt-2 pb-1">
            <SearchDialog />
          </div>
        </nav>
      )}
    </header>
  );
}

function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
