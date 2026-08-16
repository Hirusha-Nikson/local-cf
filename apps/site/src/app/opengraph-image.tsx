import { ImageResponse } from "next/og";

/**
 * The card shown when a local-cf link is pasted into Slack, Discord, X or
 * iMessage.
 *
 * Rendered from JSX at build time rather than committed as a PNG, so the
 * wording stays in the same place as the rest of the metadata and a copy change
 * is a text edit rather than a trip through a design tool.
 *
 * Deliberately no webfont. `ImageResponse` has to be handed font binaries, and
 * the usual way to get them — fetching Google Fonts during the build — turns a
 * network hiccup in CI into a failed deploy for a decorative asset. The default
 * sans is close enough to the site's Geist at this size.
 *
 * Satori (what renders this) supports a subset of CSS: flexbox only, no grid,
 * and every element with more than one child needs an explicit `display`.
 */
export const alt =
  "local-cf — browse and edit the exact D1, KV, R2, Durable Objects and Queues your Cloudflare Worker is using";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Same values as packages/ui/src/theme.css, inlined because Satori sees no CSS. */
const ORANGE = "#f6821f";
const INK = "#0b0b0b";
const FG = "#f5f5f5";
const SUBTLE = "#a1a1a1";
const LINE = "#333333";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: INK,
          // Satori has no radial-gradient, so the warm corner is a linear one.
          backgroundImage: `linear-gradient(135deg, rgba(246,130,31,0.16) 0%, rgba(246,130,31,0) 45%)`,
          padding: 72,
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: ORANGE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
              color: INK,
            }}
          >
            cf
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, color: FG }}>local-cf</div>
        </div>

        {/* The claim */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/*
            * Two rows rather than one string with a <br />: that break counts
            * as a third child node, and Satori rejects any element with more
            * than one child unless it declares `display` itself.
          */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 62,
              fontWeight: 700,
              color: FG,
              lineHeight: 1.12,
              letterSpacing: -1.5,
              maxWidth: 940,
            }}
          >
            <div>See your Cloudflare Workers data</div>
            <div>without deploying it</div>
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 27,
              color: SUBTLE,
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            Browse and edit the exact D1, KV, R2, Durable Objects and Queues your
            worker is using — same runtime, offline, no account.
          </div>
        </div>

        {/* Command + domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              padding: "14px 22px",
              fontSize: 26,
              color: FG,
            }}
          >
            <span style={{ color: ORANGE }}>$</span>
            <span>npx local-cf</span>
          </div>

          <div style={{ fontSize: 24, color: SUBTLE }}>local-cf.com</div>
        </div>
      </div>
    ),
    size,
  );
}
