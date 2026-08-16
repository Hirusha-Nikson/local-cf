/**
 * The presentation half of a testimonial.
 *
 * Split out from testimonials.ts because the carousel is a client component,
 * and importing these helpers from the module that fetches the sheet would
 * drag `@opennextjs/cloudflare`, the KV cache and the CSV parser into the
 * browser bundle. Nothing in here touches a binding or the network.
 */

/**
 * The Google Form that collects reviews.
 *
 * Lives here rather than inline because it is linked from both the reviews
 * page and the footer, and a form URL that has drifted out of sync in one of
 * two places fails silently — the link still works, it just points at nothing
 * anyone is reading.
 */
export const REVIEW_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdI2YkYBe4XGPkJwG8CGOKNHyAanxpV6hqiMlR4pTLjUUvC3A/viewform?usp=publish-editor";

export type Testimonial = {
  name: string;
  role: string;
  quote: string;
  /** GitHub handle, already validated as a handle and not a URL. "" if none. */
  github: string;
  /**
   * Gravatar hash — never the email it was derived from.
   *
   * The sheet hashes before publishing, so the raw address stays on the
   * private Responses tab. See `cleanAvatarHash` for what happens if that
   * ever stops being true.
   */
  avatarHash: string;
};

/**
 * Where to fetch this person's face, if anywhere.
 *
 * GitHub wins when both are given: it is the one the person is more likely to
 * recognise as theirs, and it comes with a profile to link to.
 */
export function avatarUrlFor(testimonial: Testimonial): string | null {
  if (testimonial.github) return `https://github.com/${testimonial.github}.png?size=160`;

  // `d=blank` returns a transparent PNG when the address has no Gravatar,
  // which lets the initials rendered underneath show through untouched.
  if (testimonial.avatarHash) {
    return `https://gravatar.com/avatar/${testimonial.avatarHash}?s=160&d=blank`;
  }

  return null;
}

/** Up to two initials, so the badge stays the same size for every name. */
export function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";

  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";

  return `${first}${last}`.toUpperCase();
}
