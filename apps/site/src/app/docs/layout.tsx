import type { ReactNode } from "react";
import { DocsMeta, DocsNav, DocsPager } from "../../components/docs-nav";
import { TableOfContents } from "../../components/table-of-contents";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    /*
     * Three columns from `xl` (nav / article / contents), two from `md`, and a
     * single stack below that where the nav collapses behind the page name.
     * The article column is capped so prose never runs past a comfortable
     * measure on a wide screen.
     */
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10 md:py-10 xl:grid-cols-[13rem_minmax(0,1fr)_14rem]">
      <div className="md:min-w-0">
        <DocsNav />
      </div>

      <article className="min-w-0 max-w-3xl">
        <DocsMeta />
        {children}
        <DocsPager />
      </article>

      <div className="hidden xl:block">
        <TableOfContents />
      </div>
    </main>
  );
}
