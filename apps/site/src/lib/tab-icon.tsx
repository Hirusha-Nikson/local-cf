import { ImageResponse } from "next/og";
import { logoDataUri } from "./brand";

/**
 * The mark, rendered square at a given size, for the browser tab.
 *
 * Shared by `app/icon.tsx` and `app/icon1.tsx` rather than generated from one
 * file by `generateImageMetadata`. That API looks like the right tool and is
 * not: it puts the images behind a `[__metadata_id__]` segment which Next does
 * not prerender, so they compile to a route handler that runs per request. On
 * a Worker that is actively broken — `logoDataUri()` reads
 * `packages/cli/logo.png` off a disk that is not there, and every tab icon
 * silently degrades to the "cf" monogram while the build reports success.
 * `export const dynamic = "force-static"` changes the label in the build table
 * and nothing else.
 *
 * Two plain files with no dynamic segment prerender to real PNGs, the same way
 * apple-icon.tsx does. The duplication is two lines each; the alternative was a
 * broken icon in production.
 */

/** Aspect ratio of the mark — 748x578. Kept exact so nothing is squashed. */
const LOGO_RATIO = 748 / 578;

export function renderTabIcon(size: number): ImageResponse {
  const logo = logoDataUri();

  /*
   * 94% of the box. The mark carries no padding of its own and a tab icon is
   * only ever seen at a size where breathing room is wasted pixels — this
   * matches how it already sits inside favicon.ico.
   */
  const width = Math.round(size * 0.94);
  const height = Math.round(width / LOGO_RATIO);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM.
          <img src={logo} alt="" width={width} height={height} />
        ) : (
          // Same fallback as apple-icon.tsx: a missing logo file degrades to the
          // monogram rather than failing the build.
          <div style={{ fontSize: size * 0.6, fontWeight: 700, color: "#f6821f" }}>cf</div>
        )}
      </div>
    ),
    { width: size, height: size },
  );
}
