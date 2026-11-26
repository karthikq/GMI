import OpinionCard from "../cards/OpinionCard";
import type { LayoutProps } from "./shared";

// I — columnist cards in a row; any count forms rows of three.
export default function OpinionLayout({ articles }: LayoutProps) {
  return (
    <div className="ed-opinion-grid">
      {articles.map((article) => (
        <OpinionCard key={article.slug} article={article} />
      ))}
    </div>
  );
}
