import PremiumCard from "../cards/PremiumCard";
import type { LayoutProps } from "./shared";

// J — premium/longform cards inside the dark editorial band. Non-premium
// stories render here too when configured, but without a lock badge.
export default function PremiumCollectionLayout({ articles }: LayoutProps) {
  return (
    <div className="ed-premium-grid">
      {articles.map((article) => (
        <PremiumCard key={article.slug} article={article} />
      ))}
    </div>
  );
}
