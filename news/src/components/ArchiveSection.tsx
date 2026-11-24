"use client";

import Link from "next/link";
import { useState } from "react";
import ArticleCard from "@/components/ArticleCard";
import type { Article } from "@/lib/api";
import { ARCHIVE_OPTIONS } from "@/lib/archive";

export default function ArchiveSection({ initial }: { initial: Article[] }) {
  const [days, setDays] = useState(7);
  const [articles, setArticles] = useState(initial);
  const [loading, setLoading] = useState(false);

  const pick = async (next: number) => {
    setDays(next);
    setLoading(true);
    try {
      const response = await fetch(`/api/archive?days=${next}`);

      
      if (response.ok) {
        const result = await response.json();
       
        setArticles(result.articles);
      }
    } finally {
      setLoading(false);
    }
  };

  const label = ARCHIVE_OPTIONS.find((o) => o.days === days)?.label ?? `${days} days`;

  return (
    <section className="section-block">
      <div className="section-head">
        <h2>News · {label}</h2>
        <div className="archive-controls">
          <label className="archive-picker">
            Period
            <select
              value={days}
              onChange={(event) => pick(Number(event.target.value))}
              aria-label="How far back"
            >
              {ARCHIVE_OPTIONS.map((option) => (
                <option key={option.days} value={option.days}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Link href={`/archive?days=${days}`} className="more">
            View all news →
          </Link>
        </div>
      </div>
      {articles.length > 0 ? (
        <div className="grid four" aria-busy={loading}>
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <p className="archive-empty">No stories in {label}.</p>
      )}
    </section>
  );
}
