import type { ReactNode } from "react";

/**
 * Container for the legal pages.
 *
 * They are authored as MDX so the prose styling in mdx-components.tsx applies,
 * but unlike /docs they get no sidebar, no pager and no table of contents —
 * nobody navigates a privacy notice, they read it once and leave. The measure
 * matches /reviews so the two non-docs pages sit at the same width.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-3xl px-4 py-16">{children}</main>;
}
