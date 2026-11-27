import Link from "next/link";
import SectionRenderer from "@/components/editorial/SectionRenderer";
import SubsectionNav from "@/components/SubsectionNav";
import type { Section } from "@/lib/api";
import type { SectionBundle } from "@/lib/queries";

type Props = {
  section: Section;
  subsection?: Section;
  items: Section[];
  bundle: SectionBundle;
  page: number;
  signedIn?: boolean;
  savedSlugs?: ReadonlySet<string>;
};

// BreadcrumbList structured data for the section/subsection page.
function BreadcrumbJsonLd({ section, subsection }: { section: Section; subsection?: Section }) {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: base },
    {
      "@type": "ListItem",
      position: 2,
      name: section.name,
      item: `${base}/${section.slug}`,
    },
  ];
  if (subsection) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: subsection.name,
      item: `${base}/${section.slug}/${subsection.slug}`,
    });
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items }),
      }}
    />
  );
}

// The shared body of every section and subsection page: heading, the
// subsection strip, then the configured editorial block program.
export default function SectionListing({ section, subsection, items, bundle, page, signedIn, savedSlugs }: Props) {
  const current = subsection ?? section;
  const basePath = `/${section.slug}${subsection ? `/${subsection.slug}` : ""}`;

  return (
    <>
      <BreadcrumbJsonLd section={section} subsection={subsection} />
      <header className="page-head">
        {subsection && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> · <Link href={`/${section.slug}`}>{section.name}</Link> ·{" "}
            <span>{subsection.name}</span>
          </nav>
        )}
        <h1>{current.name}</h1>
        {current.blurb && <p>{current.blurb}</p>}
        {items.length > 0 && (
          <SubsectionNav section={section} items={items} activeSlug={subsection?.slug} />
        )}
      </header>

      <SectionRenderer
        bundle={bundle}
        page={page}
        basePath={basePath}
        signedIn={signedIn}
        savedSlugs={savedSlugs}
      />
    </>
  );
}
