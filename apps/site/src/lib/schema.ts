/**
 * The site's JSON-LD graphs.
 *
 * Structured data is the machine-readable half of every page: it is what tells
 * Google this is a free developer tool rather than an article about one, and it
 * is what a crawler or an assistant reads when it wants facts instead of prose.
 *
 * Two rules hold everything here together:
 *
 * 1. **Nothing is claimed that the page does not show.** Every value below is
 *    either visible on the page, in the metadata, or in `package.json`. Marking
 *    up things a human cannot see on the page is what earns a manual action.
 * 2. **No filesystem, no process, no request-time work.** Same constraint as
 *    `app/sitemap.ts` — these builders run inside a Worker. `routes.json` is a
 *    build artefact, imported as data, which is the only reason `dateModified`
 *    can be honest without touching git at runtime.
 *
 * Each page emits one `@graph` that stands on its own, repeating the author and
 * website nodes rather than pointing at `@id`s defined on some other page. It
 * costs a few hundred bytes and means any single URL parses correctly in
 * isolation, which is how validators — and crawlers that only fetch one page —
 * actually see it.
 */
import { DOC_PAGES } from "./docs";
import routes from "./routes.json";
import { absoluteUrl, GITHUB_URL, NPM_URL, SITE_DESCRIPTION, SITE_URL } from "./site";

/** A single JSON-LD node. Loose by design — schema.org is not a closed shape. */
type Node = Record<string, unknown>;

/** A `@graph` document, ready to be serialised into a script tag. */
export interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": Node[];
}

/*
 * Stable identifiers, so the nodes on one page are understood as the same
 * things as the nodes on another. Fragment ids on the site URL are the
 * conventional form and never resolve to a real document, which is fine — an
 * `@id` is a name, not a link.
 */
const AUTHOR_ID = `${SITE_URL}#author`;
const WEBSITE_ID = `${SITE_URL}#website`;
const SOFTWARE_ID = `${SITE_URL}#software`;

const AUTHOR: Node = {
  "@type": "Person",
  "@id": AUTHOR_ID,
  name: "H Nikson",
  url: "https://github.com/Hirusha-Nikson",
  sameAs: ["https://github.com/Hirusha-Nikson"],
};

const WEBSITE: Node = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: "local-cf",
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  author: { "@id": AUTHOR_ID },
  publisher: { "@id": AUTHOR_ID },
};

/** `lastModified` for a route, from the same build artefact the sitemap uses. */
function lastModified(path: string): string | undefined {
  return routes.find((entry) => entry.route === path)?.lastModified;
}

/**
 * The home page: the product itself.
 *
 * `featureList` is passed in from the page rather than duplicated here, so the
 * list a crawler reads is literally the list of feature headings a visitor
 * reads. If the section is edited, the markup follows.
 */
export function homeSchema(featureList: readonly string[]): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [
      AUTHOR,
      WEBSITE,
      {
        "@type": "SoftwareApplication",
        "@id": SOFTWARE_ID,
        name: "local-cf",
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        applicationCategory: "DeveloperApplication",
        applicationSubCategory: "Database browser for Cloudflare Workers",
        operatingSystem: "macOS, Windows, Linux",
        softwareRequirements: "Node.js 20.11 or newer",
        /*
         * There is no installer and no hosted app — `npx local-cf` fetches the
         * package, so npm is both the download and the install location.
         */
        downloadUrl: NPM_URL,
        installUrl: NPM_URL,
        softwareHelp: {
          "@type": "WebPage",
          "@id": `${absoluteUrl("/docs")}#docs`,
          url: absoluteUrl("/docs"),
          name: "local-cf documentation",
        },
        license: "https://opensource.org/licenses/MIT",
        /*
         * MIT and free, and `offers` with a zero price is how schema.org says
         * that — `isAccessibleForFree` alone leaves search engines guessing
         * whether there is a paid tier behind it.
         */
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [...featureList],
        // The static card in src/app. The extension is part of the URL — when
        // this was a generated `opengraph-image.tsx` the route was extensionless,
        // and leaving the old path here would have put a 404 in the markup.
        image: absoluteUrl("/opengraph-image.png"),
        sameAs: [GITHUB_URL, NPM_URL],
        author: { "@id": AUTHOR_ID },
        publisher: { "@id": AUTHOR_ID },
        isPartOf: { "@id": WEBSITE_ID },
      },
    ],
  };
}

/**
 * Home → Docs → this page.
 *
 * The docs index gets a two-item trail rather than a self-referential third
 * item; Google drops single-item lists and duplicated ones.
 */
function breadcrumbs(path: string, label: string): Node {
  const trail: Array<{ name: string; url: string }> = [
    { name: "Home", url: SITE_URL },
    { name: "Documentation", url: absoluteUrl("/docs") },
  ];
  if (path !== "/docs") trail.push({ name: label, url: absoluteUrl(path) });

  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumbs`,
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * A documentation page.
 *
 * `TechArticle` rather than `Article`: these are reference pages for developers,
 * and the type carries `dependencies` and `proficiencyLevel`, which is closer to
 * what they are than "news story".
 *
 * The heading comes from `DOC_PAGES` — the same list the sidebar and the pager
 * walk — so a page renamed in one place cannot keep its old name in the markup.
 * `description` is passed in from the page's own `metadata` export for the same
 * reason: one sentence, written once, used by both the meta tag and this.
 */
export function docsSchema(path: string, description?: string): JsonLdGraph {
  const label = DOC_PAGES.find((page) => page.href === path)?.label ?? "Documentation";
  const url = absoluteUrl(path);
  const modified = lastModified(path);

  const article: Node = {
    "@type": "TechArticle",
    "@id": `${url}#article`,
    headline: label,
    name: label,
    url,
    mainEntityOfPage: url,
    inLanguage: "en",
    // Omitted rather than guessed when the build artefact has no entry for the
    // route: a wrong date is worse than no date.
    ...(modified ? { dateModified: modified } : {}),
    ...(description ? { description } : {}),
    about: { "@id": SOFTWARE_ID },
    isPartOf: { "@id": WEBSITE_ID },
    author: { "@id": AUTHOR_ID },
    publisher: { "@id": AUTHOR_ID },
    /*
     * Docs are free to read and the whole page is in the HTML — stating it
     * explicitly is what keeps a paywall heuristic from guessing otherwise.
     */
    isAccessibleForFree: true,
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      AUTHOR,
      WEBSITE,
      /*
       * A stub of the software node, so `about` resolves on a page that a
       * crawler reached without ever seeing the home page. Only the identifying
       * fields — the full description of the product belongs on one URL.
       */
      {
        "@type": "SoftwareApplication",
        "@id": SOFTWARE_ID,
        name: "local-cf",
        url: SITE_URL,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "macOS, Windows, Linux",
      },
      article,
      breadcrumbs(path, label),
    ],
  };
}
