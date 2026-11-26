"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewSectionLayout,
  resetSectionLayout,
  saveSectionLayout,
} from "@/app/actions";
import SectionBlock from "@/components/editorial/SectionBlock";
import type { Section } from "@/lib/api";
import {
  ARTICLE_SOURCES,
  BLOCK_SORTS,
  LAYOUT_TYPES,
  LAYOUTS,
  defaultSectionConfig,
  type CollectionsConfig,
  type LayoutBlock,
  type LayoutType,
  type SectionLayoutConfig,
} from "@/lib/layouts";
import type { SectionBundle } from "@/lib/queries";

const SOURCE_LABELS: Record<string, string> = {
  featured: "Featured / editors' picks",
  latest: "Latest",
  subsection: "Subsection",
  "most-read": "Most read",
  premium: "Premium / exclusive",
  manual: "Manual selection",
  all: "All articles (paginated feed)",
};

let seq = 0;
const newId = () => `b${Date.now().toString(36)}${(seq += 1).toString(36)}`;

// Tiny wireframe sketch of a layout's structure for the picker.
function LayoutThumb({ layout }: { layout: LayoutType }) {
  const cell = <i />;
  switch (layout) {
    case "lead-story":
      return (
        <span className="lthumb">
          <b /> <i /> <i />
        </span>
      );
    case "balanced-editorial":
      return (
        <span className="lthumb balanced">
          <b /> <i /> <i /> <i /> <i />
        </span>
      );
    case "three-column":
      return (
        <span className="lthumb cols3">
          <i /> <i /> <i />
        </span>
      );
    case "four-column":
      return (
        <span className="lthumb cols4">
          <i /> <i /> <i /> <i />
        </span>
      );
    case "featured-headlines":
      return (
        <span className="lthumb headlines">
          <b /> <u /> <u /> <u /> <u />
        </span>
      );
    case "horizontal-feed":
      return (
        <span className="lthumb feed">
          <u /> <u /> <u />
        </span>
      );
    case "visual-mosaic":
      return (
        <span className="lthumb mosaic">
          <b /> <i /> <i /> <i />
        </span>
      );
    case "magazine":
      return (
        <span className="lthumb mag">
          <b /> <b />
        </span>
      );
    case "opinion-columns":
      return (
        <span className="lthumb opinion">
          <i /> <i /> <i />
        </span>
      );
    case "premium-collection":
      return (
        <span className="lthumb premium">
          <i /> <i /> <i />
        </span>
      );
    default:
      return cell;
  }
}

// The /admin/layouts editor — pick a scope, arrange blocks, preview, save.
export default function LayoutManager({
  sections,
  docs,
}: {
  sections: Section[];
  docs: Record<string, SectionLayoutConfig> | null;
}) {
  const router = useRouter();

  // Flattened scope list: each section, then each of its subsections.
  const scopes = useMemo(
    () =>
      sections.flatMap((section) => [
        { key: section.slug, label: section.name, section, subsection: undefined as Section | undefined },
        ...(section.children ?? []).map((child) => ({
          key: `${section.slug}/${child.slug}`,
          label: `${section.name} — ${child.name}`,
          section,
          subsection: child as Section | undefined,
        })),
      ]),
    [sections],
  );

  const configFor = (key: string): SectionLayoutConfig => {
    const stored = docs?.[key];
    if (stored) return structuredClone(stored);
    const scope = scopes.find((item) => item.key === key);
    const name = scope?.subsection?.name ?? scope?.section.name ?? key;
    const config = defaultSectionConfig(scope?.section.slug ?? key, name);
    if (scope?.subsection) config.subsectionSlug = scope.subsection.slug;
    return config;
  };

  const [key, setKey] = useState(scopes[0]?.key ?? "");
  const [draft, setDraft] = useState<SectionLayoutConfig>(() => configFor(scopes[0]?.key ?? ""));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SectionBundle | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const scope = scopes.find((item) => item.key === key);
  const subOptions = scope?.section.children ?? [];

  const pickScope = (next: string) => {
    setKey(next);
    setDraft(configFor(next));
    setDirty(false);
    setPreview(null);
    setMessage(null);
    setError(null);
  };

  const update = (fn: (config: SectionLayoutConfig) => SectionLayoutConfig) => {
    setDraft((current) => fn(structuredClone(current)));
    setDirty(true);
  };

  const setBlock = (index: number, patch: Partial<LayoutBlock>) =>
    update((config) => {
      config.blocks[index] = { ...config.blocks[index], ...patch };
      return config;
    });

  const moveBlock = (from: number, to: number) =>
    update((config) => {
      const [item] = config.blocks.splice(from, 1);
      config.blocks.splice(to, 0, item);
      config.blocks.forEach((block, i) => (block.displayOrder = i + 1));
      return config;
    });

  const addBlock = () =>
    update((config) => {
      config.blocks.push({
        id: newId(),
        title: "New block",
        layout: "three-column",
        source: "latest",
        articleCount: 3,
        sort: "newest",
        displayOrder: config.blocks.length + 1,
        enabled: true,
      });
      return config;
    });

  const removeBlock = (index: number) =>
    update((config) => {
      config.blocks.splice(index, 1);
      config.blocks.forEach((block, i) => (block.displayOrder = i + 1));
      return config;
    });

  const setCollections = (patch: Partial<CollectionsConfig>) =>
    update((config) => {
      config.collections = { ...config.collections, ...patch };
      return config;
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await saveSectionLayout({
        sectionSlug: scope?.section.slug ?? "",
        subsectionSlug: scope?.subsection?.slug ?? null,
        blocks: draft.blocks,
        collections: draft.collections,
      });
      if ("error" in result) setError(result.error);
      else {
        setMessage("Layout saved.");
        setDirty(false);
        router.refresh();
      }
    });

  const reset = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await resetSectionLayout({
        sectionSlug: scope?.section.slug ?? "",
        subsectionSlug: scope?.subsection?.slug ?? null,
      });
      if ("error" in result) setError(result.error);
      else {
        setDraft(configFor(key));
        setDirty(false);
        setMessage("Back to the default layout.");
        router.refresh();
      }
    });

  const runPreview = () =>
    startTransition(async () => {
      setError(null);
      const result = await previewSectionLayout({
        sectionSlug: scope?.section.slug ?? "",
        subsectionSlug: scope?.subsection?.slug ?? null,
        blocks: draft.blocks,
        collections: draft.collections,
      });
      if (result && "error" in result) setError(result.error);
      else setPreview(result);
    });

  const layoutPicker = (value: LayoutType, onPick: (layout: LayoutType) => void) => (
    <div className="lm-layouts" role="radiogroup" aria-label="Layout">
      {LAYOUT_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={value === type}
          className={`lm-layout${value === type ? " sel" : ""}`}
          onClick={() => onPick(type)}
          title={LAYOUTS[type].blurb}
        >
          <LayoutThumb layout={type} />
          <span>{LAYOUTS[type].name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="lm">
      <div className="lm-toolbar">
        <label className="cms-field small">
          <span>Section or subsection</span>
          <select value={key} onChange={(event) => pickScope(event.target.value)}>
            {scopes.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="lm-actions">
          <button type="button" className="button outline" onClick={reset} disabled={pending}>
            Reset to default
          </button>
          <button type="button" className="button outline" onClick={runPreview} disabled={pending}>
            Preview
          </button>
          <button type="button" className="button" onClick={save} disabled={pending || !dirty}>
            Save layout
          </button>
        </div>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-note" role="status">
          {message}
        </p>
      )}

      <div className="lm-blocks" aria-label="Content blocks">
        {draft.blocks.map((block, index) => (
          <div
            key={block.id}
            className={`lm-block${block.enabled ? "" : " off"}${dragIndex === index ? " dragging" : ""}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) moveBlock(dragIndex, index);
              setDragIndex(null);
            }}
          >
            <div className="lm-block-head">
              <span className="lm-grip" aria-hidden="true" title="Drag to reorder">
                ⠿
              </span>
              <span className="lm-ord">#{index + 1}</span>
              <input
                type="text"
                className="lm-title"
                value={block.title}
                maxLength={60}
                aria-label="Block heading"
                onChange={(event) => setBlock(index, { title: event.target.value })}
              />
              <label className="cms-switch">
                <input
                  type="checkbox"
                  checked={block.enabled}
                  onChange={(event) => setBlock(index, { enabled: event.target.checked })}
                />
                <span className="switch" aria-hidden="true" />
                <span>Enabled</span>
              </label>
              <div className="lm-block-tools">
                <button
                  type="button"
                  className="cat-move"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, index - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="cat-move"
                  aria-label="Move down"
                  disabled={index === draft.blocks.length - 1}
                  onClick={() => moveBlock(index, index + 1)}
                >
                  ↓
                </button>
                <button type="button" className="cat-delete" onClick={() => removeBlock(index)}>
                  Remove
                </button>
              </div>
            </div>

            <div className="lm-block-body">
              {layoutPicker(block.layout, (layout) => setBlock(index, { layout }))}
              <div className="lm-fields">
                <label className="cms-field small">
                  <span>Source</span>
                  <select
                    value={block.source}
                    onChange={(event) =>
                      setBlock(index, { source: event.target.value as LayoutBlock["source"] })
                    }
                  >
                    {ARTICLE_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {SOURCE_LABELS[source] ?? source}
                      </option>
                    ))}
                  </select>
                </label>
                {block.source === "subsection" && (
                  <label className="cms-field small">
                    <span>Subsection</span>
                    <select
                      value={block.subsectionSlug ?? ""}
                      onChange={(event) => setBlock(index, { subsectionSlug: event.target.value })}
                    >
                      <option value="">Choose…</option>
                      {subOptions.map((sub) => (
                        <option key={sub.slug} value={sub.slug}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="cms-field small">
                  <span>Max articles</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={block.articleCount}
                    onChange={(event) =>
                      setBlock(index, { articleCount: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="cms-field small">
                  <span>Sort</span>
                  <select
                    value={block.sort ?? "newest"}
                    onChange={(event) =>
                      setBlock(index, { sort: event.target.value as LayoutBlock["sort"] })
                    }
                  >
                    {BLOCK_SORTS.map((sort) => (
                      <option key={sort} value={sort}>
                        {sort === "newest" ? "Newest first" : sort === "oldest" ? "Oldest first" : "Most read"}
                      </option>
                    ))}
                  </select>
                </label>
                {(block.source === "most-read" || block.sort === "most-read") && (
                  <label className="cms-field small">
                    <span>Time range (days, blank = all time)</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={block.timeRangeDays ?? ""}
                      onChange={(event) =>
                        setBlock(index, {
                          timeRangeDays: event.target.value ? Number(event.target.value) : undefined,
                        })
                      }
                    />
                  </label>
                )}
                {(block.source === "featured" || block.source === "manual") && (
                  <label className="cms-field small lm-wide">
                    <span>Pinned article slugs (comma separated, shown first)</span>
                    <input
                      type="text"
                      value={(block.selectedArticles ?? []).join(", ")}
                      placeholder="e.g. monsoon-pact-signed, budget-2026"
                      onChange={(event) =>
                        setBlock(index, {
                          selectedArticles: event.target.value
                            .split(",")
                            .map((slug) => slug.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="button outline lm-add" onClick={addBlock}>
          + Add block
        </button>
      </div>

      <section className="lm-collections" aria-label="Subsection collections">
        <div className="section-head">
          <h2>Subsection collections</h2>
        </div>
        <div className="lm-block">
          <div className="lm-block-head">
            <label className="cms-switch">
              <input
                type="checkbox"
                checked={draft.collections.enabled}
                onChange={(event) => setCollections({ enabled: event.target.checked })}
              />
              <span className="switch" aria-hidden="true" />
              <span>
                Auto collections <em>Featured subsections get their own block</em>
              </span>
            </label>
          </div>
          {draft.collections.enabled && (
            <div className="lm-block-body">
              {layoutPicker(draft.collections.layout, (layout) => setCollections({ layout }))}
              <div className="lm-fields">
                <label className="cms-field small">
                  <span>Max collections</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={draft.collections.max}
                    onChange={(event) => setCollections({ max: Number(event.target.value) })}
                  />
                </label>
                <label className="cms-field small">
                  <span>Articles each</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={draft.collections.articleCount}
                    onChange={(event) => setCollections({ articleCount: Number(event.target.value) })}
                  />
                </label>
                <label className="cms-field small">
                  <span>Position (display order)</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={draft.collections.displayOrder}
                    onChange={(event) => setCollections({ displayOrder: Number(event.target.value) })}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="lm-preview-wrap" aria-label="Preview">
        <div className="section-head">
          <h2>Preview</h2>
          <div className="lm-viewports" role="radiogroup" aria-label="Viewport">
            {(["desktop", "tablet", "mobile"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={viewport === mode}
                className={`cat-flag${viewport === mode ? " on" : ""}`}
                onClick={() => setViewport(mode)}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {preview ? (
          <div
            className={`lm-preview lm-${viewport}`}
            style={{ maxWidth: viewport === "mobile" ? 400 : viewport === "tablet" ? 780 : "none" }}
          >
            {preview.blocks.map(({ block, articles, viewAll }) => (
              <SectionBlock
                key={block.id}
                title={block.title}
                viewAll={viewAll}
                layout={block.layout}
                articles={articles}
              />
            ))}
            {preview.feed && (
              <SectionBlock
                title={preview.feed.block.title}
                layout={preview.feed.block.layout}
                articles={preview.feed.articles}
              />
            )}
            {!preview.blocks.length && !preview.feed?.articles.length && (
              <p className="side-note">No published stories to preview yet.</p>
            )}
          </div>
        ) : (
          <p className="side-note">
            Press “Preview” to render this draft with live articles.
          </p>
        )}
      </section>
    </div>
  );
}
