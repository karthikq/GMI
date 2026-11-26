// Loading placeholder with the card's image+text silhouette — used where a
// block suspends. Matches .skeleton styling so the page doesn't jump.
export default function ArticleCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="ed-skel-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ed-skel">
          <div className="ed-skel-image" />
          <div className="ed-skel-line" />
          <div className="ed-skel-line short" />
        </div>
      ))}
    </div>
  );
}
