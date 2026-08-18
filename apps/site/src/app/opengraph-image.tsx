import { ImageResponse } from "next/og";
import { logoWhiteDataUri } from "@/lib/brand";

/**
 * The card shown when a local-cf link is pasted into Slack, Discord, X or
 * iMessage.
 *
 * Rendered from JSX at build time rather than committed as a PNG, so the
 * wording stays in the same place as the rest of the metadata and a copy change
 * is a text edit rather than a trip through a design tool.
 *
 * Designed for the size it is actually seen at. A card renders about 600px wide
 * in a desktop feed and nearer 380px on a phone — call it half scale and worse.
 * Everything here is sized so it survives that: one headline, one command, and
 * a terminal reduced to the four lines that carry the idea. An earlier version
 * dropped in a screenshot of the home page; at half scale its body copy fell to
 * about 8px and stopped being information.
 *
 * Deliberately no webfont. `ImageResponse` has to be handed font binaries, and
 * the usual way to get them — fetching Google Fonts during the build — turns a
 * network hiccup in CI into a failed deploy for a decorative asset. The default
 * sans is close enough to the site's Geist at this size.
 *
 * Satori (what renders this) supports a subset of CSS: flexbox only, no grid,
 * no radial-gradient, and every element with more than one child needs an
 * explicit `display`.
 */
export const alt =
  "local-cf — see inside your Cloudflare Worker's storage without leaving localhost";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Same values as packages/ui/src/theme.css, inlined because Satori sees no CSS. */
const ORANGE = "#f6821f";
const INK = "#0b0b0b";
const WHITE = "#ffffff";
const LIVE = "#4ade80";
const MUTED = "rgba(255,255,255,0.55)";

/**
 * The faint circuit trace behind everything.
 *
 * Generated rather than hand-drawn, but from a fixed seed, so the card is
 * byte-identical between builds — a background that reshuffled on every deploy
 * would invalidate every social platform's cached copy for no reason.
 *
 * Corners are softened with `stroke-linejoin: round` instead of arc commands:
 * the visual difference at 12% opacity is nil and the path data stays readable.
 */
function circuitDataUri(): string {
  let seed = 20260819;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;

  const GRID = 40;
  const snap = (value: number) => Math.round(value / GRID) * GRID;

  const traces: string[] = [];
  const vias: string[] = [];

  for (let i = 0; i < 30; i++) {
    const x = snap(random() * size.width);
    const y = snap(random() * size.height);
    const run = (2 + Math.floor(random() * 6)) * GRID;
    const drop = (1 + Math.floor(random() * 3)) * GRID * (random() > 0.5 ? 1 : -1);

    traces.push(`M${x} ${y}H${x + run}V${y + drop}`);
    vias.push(`<circle cx="${x}" cy="${y}" r="5"/>`);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">` +
    `<g fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.13">` +
    traces.map((d) => `<path d="${d}"/>`).join("") +
    `</g><g fill="#fff" opacity="0.16">${vias.join("")}</g></svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The four bindings, as the CLI prints them once the studio is up. */
const BINDINGS = [
  { kind: "D1", name: "demo-db" },
  { kind: "KV", name: "sessions" },
  { kind: "R2", name: "uploads" },
  { kind: "DO", name: "Counter" },
];

export default function OpengraphImage() {
  const logo = logoWhiteDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: ORANGE,
          // Satori has no radial-gradient, so the warmth is a linear one.
          backgroundImage: "linear-gradient(135deg, #ff9538 0%, #f6821f 45%, #dd6109 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM. */}
        <img
          src={circuitDataUri()}
          alt=""
          width={size.width}
          height={size.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 58,
          }}
        >
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM.
              <img src={logo} alt="" width={54} height={42} />
            ) : (
              <div style={{ fontSize: 34, fontWeight: 700, color: WHITE }}>cf</div>
            )}
            <div style={{ fontSize: 31, fontWeight: 600, color: WHITE, letterSpacing: -0.4 }}>
              local-cf
            </div>
          </div>

          {/* Claim, and the thing the claim is about */}
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
              {/*
               * Four rows rather than one string with a <br />: the break counts
               * as another child node, and Satori rejects any element with more
               * than one child unless it declares `display` itself.
               */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 53,
                  fontWeight: 700,
                  color: WHITE,
                  lineHeight: 1.1,
                  letterSpacing: -1.6,
                }}
              >
                <div>See inside your</div>
                <div>Cloudflare Worker&rsquo;s</div>
                <div>storage, without</div>
                <div>leaving localhost.</div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 30,
                  alignSelf: "flex-start",
                  border: "1px solid rgba(255,255,255,0.45)",
                  borderRadius: 12,
                  padding: "12px 20px",
                  fontSize: 26,
                  color: WHITE,
                }}
              >
                <span style={{ opacity: 0.7 }}>$</span>
                <span style={{ fontWeight: 600 }}>npx local-cf</span>
              </div>
            </div>

            {/* Terminal, cut down to what reads at 380px wide */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 444,
                backgroundColor: INK,
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 16,
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div style={{ display: "flex", gap: 7 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "#3a3a3a" }} />
                  <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "#3a3a3a" }} />
                  <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "#3a3a3a" }} />
                </div>
                <div style={{ fontSize: 18, color: MUTED }}>~/my-worker</div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 18, fontSize: 22, color: WHITE }}>
                <span style={{ color: ORANGE }}>$</span>
                <span>npx local-cf dev</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", marginTop: 16, gap: 11 }}>
                {BINDINGS.map(({ kind, name }) => (
                  <div key={kind} style={{ display: "flex", alignItems: "center", fontSize: 22 }}>
                    <div style={{ width: 52, color: ORANGE, fontWeight: 600 }}>{kind}</div>
                    <div style={{ display: "flex", flex: 1, color: "rgba(255,255,255,0.92)" }}>
                      {name}
                    </div>
                    <div style={{ color: LIVE }}>live</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", marginTop: 18, fontSize: 19, color: MUTED }}>
                studio ready &rarr; localhost:8787
              </div>
            </div>
          </div>

          {/* The objection, answered before it is raised */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 23, color: "rgba(255,255,255,0.9)" }}>
              No Cloudflare account. No sign-up. Nothing leaves your machine.
            </div>
            <div style={{ fontSize: 23, color: "rgba(255,255,255,0.75)" }}>local-cf.com</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
