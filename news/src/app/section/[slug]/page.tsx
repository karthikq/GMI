import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Sections moved from /section/<slug> to /<slug>; keep old links working
// with a permanent redirect that carries the query string (e.g. ?page=2).
async function LegacyRedirect({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.size ? `?${qs.toString()}` : "";
  permanentRedirect(`/${slug}${suffix}`);
  return null;
}

export default function LegacySectionPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <LegacyRedirect {...props} />
    </Suspense>
  );
}
