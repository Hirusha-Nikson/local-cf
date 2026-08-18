import { renderTabIcon } from "@/lib/tab-icon";

/**
 * The tab icon Google looks for.
 *
 * 96 is 2 x 48, and Google asks for a favicon that is a square multiple of
 * 48px. The `.ico` does contain a 48px copy, but Next builds its `<link>` from
 * the first directory entry in the file and so declares `sizes="16x16"` —
 * a weaker claim than the file actually supports. This states it plainly.
 *
 * No background colour, unlike apple-icon.tsx: iOS composites transparency onto
 * black and needs an opaque tile, a browser tab does not, and favicon.ico is a
 * transparent mark. Painting a square here would give the tab a different icon
 * depending on which link the browser picked.
 */
export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  return renderTabIcon(size.width);
}
