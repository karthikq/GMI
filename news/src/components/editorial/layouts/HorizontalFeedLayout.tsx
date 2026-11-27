import HorizontalCard from "../cards/HorizontalCard";
import type { LayoutProps } from "./shared";

// F — thumbnail rows divided by rules; the shape of the paginated archive.
export default function HorizontalFeedLayout({ articles }: LayoutProps) {
  return (
    <div className="ed-feed">
      {articles.map((article) => (
        <HorizontalCard key={article.slug} article={article} />
      ))}
    </div>
  );
}
