import { docsSchema, homeSchema, type JsonLdGraph } from "@/lib/schema";

/**
 * Serialise a graph into a script tag.
 *
 * `dangerouslySetInnerHTML` is the only way to emit raw JSON here — React would
 * otherwise escape the string into HTML entities and every parser would choke on
 * `&quot;` where a quote should be. The `<` replacement is what makes that safe:
 * a literal `</script>` anywhere inside a value would end the tag early, and
 * `<` is valid JSON that no browser mistakes for markup. All of this input
 * is static today; the escape is here so it stays safe when some of it isn't.
 *
 * Emitted in the body rather than the head, which JSON-LD explicitly allows and
 * which is the only option Next gives a page component. Server-rendered, so the
 * markup is in the HTML a crawler gets on the first request, with no JavaScript
 * involved.
 */
function JsonLd({ data }: { data: JsonLdGraph }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** The product graph. Home page only — it describes the site as a whole. */
export function HomeJsonLd({ featureList }: { featureList: readonly string[] }) {
  return <JsonLd data={homeSchema(featureList)} />;
}

/**
 * The per-page docs graph: article, breadcrumbs and the product it documents.
 *
 * Placed in each `page.mdx` rather than in the docs layout because a layout is
 * not told which page it is wrapping, and because `description` should come from
 * the page's own `metadata` export — the sentence a human already wrote for the
 * search result, not a second one written for the crawler.
 */
export function DocsJsonLd({ path, description }: { path: string; description?: string }) {
  return <JsonLd data={docsSchema(path, description)} />;
}
