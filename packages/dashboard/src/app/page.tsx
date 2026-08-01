"use client";

import { StudioApp } from "@local-cf/ui";

/**
 * The whole dashboard is one static page.
 *
 * It talks to the sidecar at the default same-origin `/__local-cf/api`, so the
 * export has no build-time knowledge of host or port and works from any
 * checkout, offline.
 */
export default function Page() {
  return <StudioApp />;
}
