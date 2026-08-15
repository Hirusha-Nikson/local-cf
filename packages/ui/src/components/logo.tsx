"use client";

import { cx } from "./primitives";

/**
 * The local-cf mark, inlined.
 *
 * A data URI rather than a file in each app's `public/` because the two builds
 * mount at different roots: the offline dashboard sits under
 * `basePath: "/__local-cf/ui"` while the site serves from `/`. One absolute
 * path cannot satisfy both, and this component is shared by both. Inlining also
 * keeps the offline export to a single request.
 *
 * Source is `packages/cli/logo.png`, trimmed of its transparent margin, scaled
 * to 95x72 (a 24px render at 3x DPR) and quantised to 64 colours: 2 KB, down
 * from the 193 KB original.
 */
const LOGO_SRC =
    "data:image/png;base64,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";

/**
 * Decorative by default: every current placement pairs the mark with the
 * "local-cf" wordmark, so announcing it again would be noise. Pass `alt` when
 * it stands alone.
 */
export function Logo({ className, alt = "" }: { className?: string; alt?: string }) {
    return (
        <img
            src={LOGO_SRC}
            alt={alt}
            {...(alt === "" ? { "aria-hidden": true as const } : {})}
            // Intrinsic ratio is 1.32:1, so height drives and width follows.
            className={cx("h-4 w-auto shrink-0", className)}
        />
    );
}
