import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { TestimonialAvatar } from "@/components/testimonial-avatar";
import { REVIEW_FORM_URL } from "@/lib/testimonial-display";
import { getTestimonials } from "@/lib/testimonials";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "What developers say after running local-cf against their own Cloudflare Workers — unedited, in full.",
  alternates: { canonical: "/reviews" },
};

/** Same window as the homepage, so the two never disagree about who is here. */
export const revalidate = 900;

/**
 * Every approved testimonial, in full.
 *
 * A single column rather than a grid: these are paragraphs of prose, and a
 * two-column layout of unequal-length quotes either ragged-bottoms or forces a
 * masonry that reads in an order nobody expects. One column also means no
 * truncation, which is the point of the page — the carousel is the summary,
 * this is the record.
 */
export default async function ReviewsPage() {
  const testimonials = await getTestimonials();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Reveal>
        <h1 className="text-3xl font-semibold text-balance text-fg-strong sm:text-4xl">
          Reviews
        </h1>
        <p className="mt-4 text-lg text-pretty text-fg-subtle">
          Unedited notes from developers running local-cf against their own
          workers. Nothing here is solicited or paid for.
        </p>
        <p className="mt-4 text-sm text-pretty text-fg-subtle">
          And we&rsquo;d like to hear your own!
        </p>
        <Reveal className="mt-4 flex">
          <Link
            target="_blank"
            href={REVIEW_FORM_URL}
            className="rounded-lg flex items-center gap-2 bg-accent px-5 py-2.5 text-sm font-medium text-white ring ring-line hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus className="h-4 w-4" /> Add your review
          </Link>
        </Reveal>
      </Reveal>

      {testimonials.length === 0 ? (
        <p className="mt-12 text-fg-muted">
          No reviews have been published yet. Check back once a few are in.
        </p>
      ) : (
        <div className="mt-14 flex flex-col gap-4">
          {testimonials.map((testimonial, index) => (
            <Reveal key={`${testimonial.name}-${index}`}>
              <figure className="border hairline rounded-lg p-6">
                <blockquote className="text-md leading-relaxed text-pretty text-fg">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                <figcaption className="mt-6 flex items-center gap-3">
                  <TestimonialAvatar testimonial={testimonial} />

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg-strong">
                      {testimonial.github ? (
                        <a
                          href={`https://github.com/${testimonial.github}`}
                          rel="noopener noreferrer nofollow"
                          target="_blank"
                          className="hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {testimonial.name}
                        </a>
                      ) : (
                        testimonial.name
                      )}
                    </span>
                    {testimonial.role ? (
                      <span className="block truncate text-xs dark:text-fg-muted text-fb">
                        {testimonial.role}
                      </span>
                    ) : null}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      )}

      <div className="mt-16 border-t hairline pt-8">
        <Link
          href="/"
          className="text-sm text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ← Back to local-cf
        </Link>
      </div>
    </main>
  );
}
