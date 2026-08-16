import { ImageResponse } from "next/og";
import { BRAND, logoDataUri } from "@/lib/brand";

/**
 * The icon iOS uses when someone adds local-cf to their home screen.
 *
 * 180x180 is the size Apple asks for. It has to be a real PNG with an opaque
 * background: iOS ignores transparency and composites whatever is behind onto
 * black, which would turn the mark's transparent margin into a hard square.
 * iOS applies its own rounded corners, so none are drawn here.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const logo = logoDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BRAND.ink,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM.
          <img src={logo} alt="" width={122} height={94} />
        ) : (
          // Fallback if the logo file could not be read at build time.
          <div style={{ fontSize: 74, fontWeight: 700, color: BRAND.orange }}>cf</div>
        )}
      </div>
    ),
    size,
  );
}
