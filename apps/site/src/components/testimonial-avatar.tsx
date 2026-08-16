import { avatarUrlFor, initialsOf, type Testimonial } from "@/lib/testimonial-display";

/**
 * Initials, with a photo layered over them when we have one.
 *
 * The initials are not a placeholder that gets replaced — they sit underneath
 * permanently. A GitHub handle that no longer exists 404s and a Gravatar-less
 * address returns a transparent pixel, and in both cases what shows through is
 * the initials rather than a broken-image icon. No JavaScript, no `onError`.
 *
 * A plain `<img>` rather than `next/image`: these are small and already the
 * right size, so routing them through image optimisation on the Worker would
 * add a request hop and buy nothing.
 *
 * No `"use client"` here — it holds no state, so it renders on the server for
 * the reviews page and compiles into the bundle for the carousel.
 */
export function TestimonialAvatar({
  testimonial,
  size = "sm",
}: {
  testimonial: Testimonial;
  /** `lg` is the carousel's centrepiece; `sm` sits beside a name in a list. */
  size?: "sm" | "lg";
}) {
  const src = avatarUrlFor(testimonial);
  const large = size === "lg";

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-tint font-mono text-fg-subtle ring ring-line ${
        large ? "size-16 text-lg sm:size-20 sm:text-xl" : "size-9 text-xs"
      }`}
    >
      {initialsOf(testimonial.name)}
      {src ? (
        <img
          src={src}
          alt=""
          width={large ? 80 : 36}
          height={large ? 80 : 36}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full rounded-full object-cover"
        />
      ) : null}
    </span>
  );
}
