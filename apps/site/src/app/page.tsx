import {
  ArrowRight,
  Boxes,
  FileClock,
  GitBranch,
  Layers,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { DashboardMock } from "../components/dashboard-mock";
import { HomeJsonLd } from "../components/json-ld";
import {
  BROWSE_COMMAND,
  CommandPair,
  EDIT_COMMAND,
  HeroTerminal,
  InstallCommand,
} from "../components/install-command";
import { ModeTabs } from "../components/mode-tabs";
import { Reveal } from "../components/reveal";
import { Testimonials } from "../components/testimonials";

const FEATURES = [
  {
    icon: Layers,
    title: "The same bindings, not a copy",
    body: "In dev mode the studio runs inside the same workerd process as your worker, wired to the same D1, KV, R2 and Durable Object instances. Not a mirror synced over disk — the same objects.",
    wide: true,
  },
  {
    icon: WifiOff,
    title: "Fully offline",
    body: "A static build shipped inside the npm package and served by the sidecar itself. No hosted domain, no account, no network.",
  },
  {
    icon: ShieldCheck,
    title: "Honest about fidelity",
    body: "Attach mode shares files, not memory. Every binding says which it is, so you always know whether you are looking at live Durable Object state or yesterday's flush.",
  },
  {
    icon: GitBranch,
    title: "Migrations and seeding",
    body: "Apply and track D1 migrations, import and export KV, and snapshot the whole local state before a risky change.",
  },
  {
    icon: Boxes,
    title: "Typed end to end",
    body: "The sidecar is a Hono app and the dashboard consumes it through hc<ApiType>. Routes and UI cannot drift, with no OpenAPI document in between.",
  },
  {
    icon: FileClock,
    title: "Audit log with undo",
    body: "Every write made through the dashboard is recorded, and the ones with a recoverable inverse can be undone.",
    wide: true,
  },
];

const BINDINGS = ["D1", "KV", "R2", "Durable Objects", "Queues"];

/**
 * Testimonials are approved in a Google Sheet rather than in the repo, so the
 * page has to be able to change without a deploy.
 *
 * Fifteen minutes, matching `REFRESH_AFTER_MS` in lib/testimonials.ts. Next
 * takes the lower of this and any fetch revalidate inside the render, so the
 * two have to agree or this number is decorative. Google caches published CSV
 * for around five minutes on its own, which sets the real floor.
 */
export const revalidate = 900;

export default function HomePage() {
  return (
    <main>
      {/*
        The product, described for machines. `featureList` is the same array the
        feature grid below renders from, so the markup cannot describe a version
        of this page that no longer exists.
      */}
      <HomeJsonLd featureList={FEATURES.map((feature) => feature.title)} />

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="hero-glow absolute inset-x-0 top-0 -z-10 h-152"
        />

        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm text-fg-subtle ring ring-line">
                <span className="size-1.5 rounded-full bg-orange-600" />
                Local-first developer tooling
              </p>

              <h1 className="mt-5 text-4xl font-semibold text-balance text-fg-strong sm:text-5xl">
                See inside your Cloudflare Worker&rsquo;s storage, without
                leaving localhost.
              </h1>

              <p className="mt-5 max-w-xl text-lg text-pretty text-fg-subtle">
                Attach to the dev server you already have running, or let
                local-cf boot your worker and the studio in one runtime — where
                the dashboard reads and writes the exact same D1, KV, R2,
                Durable Objects and Queues your code does.
              </p>

              {/*
                One action row. The second command is a quiet line underneath
                rather than a second box — two bordered panels side by side with
                the terminal made the hero read as three competing cards.
              */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <InstallCommand command={BROWSE_COMMAND} />
                <Link
                  href="/docs/getting-started"
                  className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg bg-accent hover:bg-accent-hover px-4 py-2.5 text-sm font-medium text-white ring ring-accent-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[inherit] group-hover:from-accent-fill"
                  />
                  <span className="relative">Get started</span>
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="relative size-4"
                  />
                </Link>
              </div>

              <p className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-subtle">
                <span>
                  Read-only, so a first run cannot break anything. To edit, run
                </span>
                <code className="font-mono text-fg">{EDIT_COMMAND}</code>
              </p>

              <p className="mt-4 text-sm text-fg-muted">
                No Cloudflare account. No sign-up. Nothing leaves your machine.
              </p>
            </div>

            <Reveal>
              <HeroTerminal />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Bindings strip */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-sm text-fg-muted">Browse and edit</span>
          {BINDINGS.map((binding) => (
            <span key={binding} className="font-mono text-sm text-fg-subtle">
              {binding}
            </span>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- Product visual */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <DashboardMock />
        </Reveal>
      </section>

      {/* ------------------------------------------------------------- Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold text-balance text-fg-strong sm:text-3xl">
              A real view of local state, not an approximation
            </h2>
            <p className="mt-3 text-fg-subtle">
              Everything the studio shows comes from the runtime your worker is
              actually using.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={index * 60}
              className={feature.wide ? "lg:col-span-2" : undefined}
            >
              <article className="h-full rounded-xl bg-surface px-6 py-5 ring ring-line">
                <feature.icon
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-5 text-orange-600"
                />
                <h3 className="mt-3.5 font-semibold text-fg-strong">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-fg-subtle">
                  {feature.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Modes */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold text-balance text-fg-strong sm:text-3xl">
              Three modes, stated plainly
            </h2>
            <p className="mt-3 text-fg-subtle">
              Each one is honest about what it can and cannot reach. Pick the
              one that matches how you work.
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-8">
          <ModeTabs />
        </Reveal>
      </section>

      {/* --------------------------------------------------------- Testimonials */}
      {/* Renders nothing until at least one response has been approved. */}
      <Testimonials />

      {/* ------------------------------------------------------------------ CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-2xl bg-surface px-6 py-14 text-center ring ring-line">
            <div
              aria-hidden="true"
              className="hero-glow absolute inset-0 -z-10"
            />
            <h2 className="text-2xl font-semibold text-balance text-fg-strong sm:text-3xl">
              Two commands. No account.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-pretty text-fg-subtle">
              Run either one in your worker&rsquo;s directory and the studio
              opens on the state you already have.
            </p>

            {/*
              The explicit pair belongs here rather than in the hero: this block
              is centred, full width, and has nothing beside it to compete with.
            */}
            <div className="mx-auto mt-7 max-w-xl text-left">
              <CommandPair />
            </div>

            <div className="mt-6 flex justify-center">
              <Link
                href="/docs"
                className="rounded-lg bg-surface px-4 py-2.5 text-sm font-medium text-fg ring ring-line hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Read the docs
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
