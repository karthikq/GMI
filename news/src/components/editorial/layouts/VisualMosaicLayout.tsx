import VisualCard from "../cards/VisualCard";
import type { LayoutProps } from "./shared";

// G — image-led mosaic: one large tile left, a medium tile upper-right and
// two small tiles lower-right. Extra articles flow into a visual grid.
export default function VisualMosaicLayout({ articles }: LayoutProps) {
  const [big, ...rest] = articles;
  const medium = rest[0];
  const small = rest.slice(1, 3);
  const tail = rest.slice(3);
  return (
    <>
      <div className="ed-mosaic">
        <div className="ed-mosaic-big">{big && <VisualCard article={big} />}</div>
        {medium && (
          <div className="ed-mosaic-med">
            <VisualCard article={medium} />
          </div>
        )}
        <div className="ed-mosaic-small">
          {small.map((article) => (
            <VisualCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
      {tail.length > 0 && (
        <div className="ed-visual-grid">
          {tail.map((article) => (
            <VisualCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </>
  );
}
