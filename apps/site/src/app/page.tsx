import Link from "next/link";

const FEATURES = [
  {
    title: "The same bindings, not a copy",
    body: "In dev mode the studio runs inside the same workerd process as your worker, wired to the same D1, KV, R2 and Durable Object instances. Not a mirror synced over disk — the same objects.",
  },
  {
    title: "Fully offline",
    body: "The dashboard is a static build shipped inside the npm package and served by the sidecar itself. No hosted domain, no account, no network.",
  },
  {
    title: "Honest about fidelity",
    body: "Attach mode shares files, not memory. Every binding says which it is, so you always know whether you are looking at live Durable Object state or yesterday's flush.",
  },
  {
    title: "Migrations, seeding, snapshots",
    body: "Apply and track D1 migrations, import and export KV, and snapshot the whole local state before a risky change — then restore it in one click.",
  },
  {
    title: "Typed end to end",
    body: "The sidecar is a Hono app and the dashboard consumes it through hc<ApiType>. Routes and UI cannot drift, with no OpenAPI document in between.",
  },
  {
    title: "Audit log with undo",
    body: "Every write made through the dashboard is recorded, and the ones with a recoverable inverse can be undone.",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 pb-12 pt-16">
        <p className="mb-3 text-sm font-medium text-orange-600">Local-first developer tooling</p>
        <h1 className="max-w-3xl text-4xl font-semibold sm:text-5xl">
          See inside your Cloudflare Worker&rsquo;s storage, without leaving localhost.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-fg-subtle">
          <code className="rounded-md bg-recessed px-1.5 py-0.5 font-mono text-[0.9em]">
            local-cf
          </code>{" "}
          boots your worker and a studio sidecar in one runtime, so the dashboard reads and writes
          the exact same D1, KV, R2, Durable Objects and Queues your code does.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-recessed px-4 py-2.5 font-mono text-sm ring ring-line">
            npx local-cf
          </code>
          <Link
            href="/docs"
            className="group relative inline-flex overflow-hidden rounded-lg bg-accent-fill px-4 py-2.5 text-sm font-medium text-white ring ring-accent-ring"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[inherit] bg-linear-to-b from-accent-grad to-accent shadow-[inset_0_1px_0_0_var(--color-accent-fill)] group-hover:from-accent-fill"
            />
            <span className="relative">Read the docs</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-px overflow-hidden rounded-xl bg-hairline ring ring-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="bg-surface px-5 py-4">
              <h2 className="font-semibold text-fg-strong">{feature.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-fg-subtle">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="text-xl font-semibold text-fg-strong">Three modes, stated plainly</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-sm text-fg-subtle hairline">
                <th className="py-2 pr-4 font-medium">Mode</th>
                <th className="py-2 pr-4 font-medium">Command</th>
                <th className="py-2 pr-4 font-medium">D1 / KV / R2</th>
                <th className="py-2 font-medium">Durable Objects &amp; Queues</th>
              </tr>
            </thead>
            <tbody className="text-fg">
              <tr className="border-b hairline">
                <td className="py-2.5 pr-4 font-medium">A — shared runtime</td>
                <td className="py-2.5 pr-4 font-mono text-sm">local-cf</td>
                <td className="py-2.5 pr-4">Same live objects</td>
                <td className="py-2.5">Live, including in-memory state</td>
              </tr>
              <tr className="border-b hairline">
                <td className="py-2.5 pr-4 font-medium">B — attached</td>
                <td className="py-2.5 pr-4 font-mono text-sm">local-cf attach</td>
                <td className="py-2.5 pr-4">Same files on disk</td>
                <td className="py-2.5">Not available across processes</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium">C — remote</td>
                <td className="py-2.5 pr-4 font-mono text-sm">local-cf remote</td>
                <td className="py-2.5 pr-4">Your real Cloudflare account</td>
                <td className="py-2.5">No REST API equivalent</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
