import { renderTabIcon } from "@/lib/tab-icon";

/**
 * The size a tab actually draws on a 2x display.
 *
 * A second file rather than a second entry in `generateImageMetadata` — see
 * lib/tab-icon.tsx for why that API cannot be used here. Next emits numbered
 * `icon<n>` files as additional `<link rel="icon">` tags, so a browser gets
 * both this and the 96px one and picks.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon32() {
  return renderTabIcon(size.width);
}
