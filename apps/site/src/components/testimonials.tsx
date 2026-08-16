import Link from "next/link";
import { getTestimonials } from "@/lib/testimonials";
import { Reveal } from "./reveal";
import { TestimonialCarousel } from "./testimonial-carousel";

/**
 * The testimonials section: one quote at a time, on the page rather than in a
 * card.
 *
 * The fetch stays here on the server — the quotes are in the initial HTML
 * where crawlers can see them, there is no waterfall after hydration, and the
 * published Google CSV never has to satisfy CORS because the browser never
 * asks it for anything. Only the carousel itself is a client component, and it
 * receives the data as props.
 *
 * Every string here is untrusted — anyone with the form link can submit one.
 * React escapes it on the way into the DOM, so the rule is simply that no
 * value from this data ever reaches `dangerouslySetInnerHTML`.
 */
export async function Testimonials() {
  const testimonials = await getTestimonials();

  // Nothing approved yet, or every source was unreachable on a cold isolate.
  // Dropping the section entirely beats rendering a heading over a void.
  if (testimonials.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <Reveal>
        <div className=" max-w-2xl">
          <h2 className="text-2xl font-semibold text-balance text-fg-strong sm:text-3xl">
            In their words
          </h2>
          <p className="mt-3 text-fg-subtle">
            Unedited notes from developers running local-cf against their own
            workers.
          </p>
        </div>
      </Reveal>

      <Reveal className="mt-14">
        <TestimonialCarousel testimonials={testimonials} />
      </Reveal>

      {/*
        Only worth offering once there is more to see than the carousel has
        already shown — a "more reviews" button leading to the same single
        quote reads as padding.
      */}
      {testimonials.length > 1 ? (
        <Reveal className="mt-12 flex justify-center">
          <Link
            href="/reviews"
            className="rounded-lg bg-surface px-5 py-2.5 text-sm font-medium text-fg ring ring-line hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            More reviews
          </Link>
        </Reveal>
      ) : null}
    </section>
  );
}
