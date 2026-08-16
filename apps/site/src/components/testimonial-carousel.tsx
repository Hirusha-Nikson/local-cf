"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Testimonial } from "@/lib/testimonial-display";
import { TestimonialAvatar } from "./testimonial-avatar";

const ADVANCE_INTERVAL_MS = 3_000;

/** Below this, a horizontal drag reads as a scroll or a tap, not a swipe. */
const SWIPE_THRESHOLD_PX = 48;

export function TestimonialCarousel({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  const count = testimonials.length;
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);

  /*
   * Autoplay stops for good at the first deliberate navigation, rather than
   * resuming a few seconds later. Hover and focus cover a mouse and a keyboard,
   * but a touch user has neither — without this the strip would keep moving
   * under their thumb with no way to stop it.
   */
  const [interacted, setInteracted] = useState(false);

  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (index: number) => {
      setInteracted(true);
      setActive(((index % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (interacted || hovered || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      // Advancing through a stack of quotes nobody is looking at just burns
      // battery and lands them somewhere arbitrary when they come back.
      if (document.hidden) return;
      setActive((current) => (current + 1) % count);
    }, ADVANCE_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [interacted, hovered, count]);

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="What people are saying about local-cf"
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") goTo(active - 1);
        if (event.key === "ArrowRight") goTo(active + 1);
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start === null || end === undefined) return;

        const travelled = end - start;
        if (Math.abs(travelled) < SWIPE_THRESHOLD_PX) return;
        goTo(active + (travelled < 0 ? 1 : -1));
      }}
    >
      {count > 1 ? (
        <>
          <StepButton direction="previous" onClick={() => goTo(active - 1)} />
          <StepButton direction="next" onClick={() => goTo(active + 1)} />
        </>
      ) : null}

      {/*
        Every quote occupies the same grid cell, so the row is as tall as the
        longest one and stays that height as the carousel advances. A fixed
        min-height would have to assume the 400-character worst case and leave
        a hole under every short quote; this reserves exactly what is needed.
      */}
      <div
        className="mx-auto grid max-w-3xl"
        // Announcing a new quote every seven seconds is disruptive, so the
        // live region only speaks once autoplay has stopped.
        aria-live={interacted || hovered ? "polite" : "off"}
      >
        {testimonials.map((testimonial, index) => {
          const current = index === active;

          return (
            <div
              key={`${testimonial.name}-${index}`}
              className={`col-start-1 row-start-1 flex flex-col items-center text-center transition-opacity duration-500 motion-reduce:transition-none ${
                current ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              // `inert` keeps the hidden profile links out of the tab order.
              // Without it you would tab into a quote you cannot see.
              inert={!current}
            >
              <TestimonialAvatar testimonial={testimonial} size="lg" />

              <blockquote className="mt-7 text-md leading-relaxed text-balance text-fg sm:text-xl sm:leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <figcaption className="mt-8">
                <span className="block font-medium text-orange-600">
                  {testimonial.github ? (
                    <a
                      href={`https://github.com/${testimonial.github}`}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      className="hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {testimonial.name}
                    </a>
                  ) : (
                    testimonial.name
                  )}
                </span>
                {testimonial.role ? (
                  <span className="mt-1 block text-xs font-medium text-fg-subtle dark:text-fg-muted">
                    {testimonial.role}
                  </span>
                ) : null}
              </figcaption>
            </div>
          );
        })}
      </div>

      {/*
        The arrows are hidden on small screens, where swiping replaces them —
        but a swipeable strip with no visible controls gives no hint that it is
        swipeable at all. The dots are that hint, and double as the position
        indicator the arrows do not provide.
      */}
      {count > 1 ? (
        <div className="mt-8 flex justify-center gap-2 lg:hidden">
          {testimonials.map((testimonial, index) => (
            <button
              key={`${testimonial.name}-${index}`}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show testimonial ${index + 1} of ${count}`}
              aria-current={index === active}
              className={`size-1.5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                index === active ? "bg-fg" : "bg-line"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StepButton({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} testimonial`}
      className={`absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg-subtle ring ring-line hover:bg-tint hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:flex ${
        direction === "previous" ? "left-0" : "right-0"
      }`}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
    </button>
  );
}
