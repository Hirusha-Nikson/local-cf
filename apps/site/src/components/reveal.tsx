"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveals its children once they scroll into view.
 *
 * IntersectionObserver plus two CSS classes rather than an animation library:
 * the whole effect is a transform and an opacity, which is not worth 40 KB of
 * JavaScript on a page whose job is to load fast.
 *
 * Nothing here runs when the visitor has asked for reduced motion — the content
 * is simply visible from the start, which is also the no-JS fallback.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Stagger, in milliseconds, for items revealed as a group. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Treat "no preference stated" as motion allowed, matching motion-safe:.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          // One-shot: re-animating on every scroll past is a nuisance.
          observer.disconnect();
        }
      },
      // Fire a little before the element is fully on screen.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={shown ? "true" : undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className ? `reveal ${className}` : "reveal"}
    >
      {children}
    </div>
  );
}
