"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createArticle,
  searchArticles,
  updateStory,
  type ArticleInput,
  type RelatedPick,
} from "@/app/actions";
import ArticleEditor from "@/components/ArticleEditor";
import Modal from "@/components/Modal";
import { ADULT_WORDS_MESSAGE, hasAdultWords } from "@/lib/censor";
import type { EditableArticle, Section } from "@/lib/api";
import { uploadArticleImage } from "@/lib/image";

const DRAFT_KEY = "meridian-cms-draft";
const REVISIONS_KEY = "meridian-cms-revisions";
const MAX_REVISIONS = 10;
const MAX_TAGS = 8;
const MAX_SOURCES = 8;
const MAX_RELATED = 3;

type Source = { label: string; url: string };

type Snapshot = {
  savedAt: number;
  title: string;
  dek: string;
  lead: string;
  body: string[];
  section: string;
  tags: string[];
  author: string;
  city: string;
};

type Draft = Snapshot & {
  slug: string;
  slugTouched: boolean;
  publishAt: string;
  breaking: boolean;
  seoTitle: string;
  seoDesc: string;
  related: RelatedPick[];
  sources: Source[];
  imageData: string | null;
};

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ");

const timeLabel = (savedAt: number) =>
  new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

// localStorage is ~5 MB and drafts can carry embedded images, so writes fail
// soft — the draftFull note tells the writer autosave has stopped.
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const hint = (text: string) => <small className="compose-hint">{text}</small>;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cms-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

// With `initial` the form edits an existing story: it starts from the stored
// values and never touches the new-story draft in localStorage.
export default function ArticleForm({ sections, initial }: { sections: Section[]; initial?: EditableArticle }) {
  const editing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(editing);
  const [dek, setDek] = useState(initial?.dek ?? "");
  const [lead, setLead] = useState(initial?.lead ?? "");
  const [blocks, setBlocks] = useState<string[]>(initial?.body ?? []);
  const [section, setSection] = useState(initial?.section ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [breaking, setBreaking] = useState(initial?.breaking ?? false);
  const [imageData, setImageData] = useState<string | null>(initial?.image ?? null);
  const [seoTitle, setSeoTitle] = useState(initial?.seo.title ?? "");
  const [seoDesc, setSeoDesc] = useState(initial?.seo.description ?? "");
  const [related, setRelated] = useState<RelatedPick[]>(initial?.related ?? []);
  const [sources, setSources] = useState<Source[]>(initial?.sources ?? []);

  const [revisions, setRevisions] = useState<Snapshot[]>([]);
  const [autosavedAt, setAutosavedAt] = useState<Date | null>(null);
  const [draftFull, setDraftFull] = useState(false);
  const [restored, setRestored] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(handle);
  }, [toast]);

  const [picks, setPicks] = useState<RelatedPick[]>([]);
  const [pickQuery, setPickQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const restoredOnce = useRef(false);
  const lastSnapshot = useRef(0);

  const currentDraft = (): Draft => ({
    savedAt: Date.now(),
    title,
    dek,
    lead,
    body: blocks,
    section,
    tags,
    author,
    city,
    slug,
    slugTouched,
    publishAt,
    breaking,
    seoTitle,
    seoDesc,
    related,
    sources,
    imageData,
  });

  // Restore any saved draft once, after hydration. The flag lives inside the
  // timeout so StrictMode's remount (which cancels the first one) doesn't
  // permanently block the restore.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (restoredOnce.current) return;
      restoredOnce.current = true;
      const saved = editing ? null : readJson<Draft>(DRAFT_KEY);
      if (saved && (saved.title || saved.body?.length)) {
        setTitle(saved.title);
        setSlug(saved.slug);
        setSlugTouched(saved.slugTouched);
        setDek(saved.dek);
        setLead(saved.lead);
        setBlocks(saved.body ?? []);
        setSection(saved.section);
        setAuthor(saved.author);
        setCity(saved.city);
        setTags(saved.tags ?? []);
        setPublishAt(saved.publishAt ?? "");
        setBreaking(Boolean(saved.breaking));
        setSeoTitle(saved.seoTitle ?? "");
        setSeoDesc(saved.seoDesc ?? "");
        setRelated(saved.related ?? []);
        setSources(saved.sources ?? []);
        setImageData(saved.imageData ?? null);
        setRestored(saved.savedAt);
      }
      setRevisions(readJson<Snapshot[]>(REVISIONS_KEY) ?? []);
    }, 0);
    return () => clearTimeout(handle);
  }, [editing]);

  // Drops the oldest snapshots until the list fits localStorage.
  const storeRevisions = (snapshot: Snapshot) =>
    setRevisions((current) => {
      for (
        let next = [snapshot, ...current].slice(0, MAX_REVISIONS);
        next.length;
        next = next.slice(0, -1)
      ) {
        if (writeJson(REVISIONS_KEY, next)) return next;
      }
      return current;
    });

  // Debounced autosave: the current draft plus a dated revision snapshot.
  useEffect(() => {
    if (!restoredOnce.current || editing) return;
    const handle = setTimeout(() => {
      if (!title && !blocks.length && !dek && !lead) return;
      const draft = currentDraft();
      const saved = writeJson(DRAFT_KEY, draft);
      setAutosavedAt(saved ? new Date() : null);
      setDraftFull(!saved);
      if (saved && Date.now() - lastSnapshot.current > 30_000) {
        lastSnapshot.current = Date.now();
        storeRevisions({
          savedAt: draft.savedAt,
          title,
          dek,
          lead,
          body: blocks,
          section,
          tags,
          author,
          city,
        });
      }
    }, 1200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, dek, lead, blocks, section, tags, author, city, slug, publishAt, breaking, seoTitle, seoDesc, related, sources, imageData]);

  // Debounced related-article search.
  useEffect(() => {
    const handle = setTimeout(async () => {
      setPicks((await searchArticles(pickQuery)).filter((p) => !related.some((r) => r.slug === p.slug)));
    }, 300);
    return () => clearTimeout(handle);
  }, [pickQuery, related]);

  const saveDraft = () => {
    const saved = writeJson(DRAFT_KEY, currentDraft());
    setDraftFull(!saved);
    lastSnapshot.current = Date.now();
    storeRevisions({
      savedAt: Date.now(),
      title,
      dek,
      lead,
      body: blocks,
      section,
      tags,
      author,
      city,
    });
    if (saved) setAutosavedAt(new Date());
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(REVISIONS_KEY);
    setRevisions([]);
    setRestored(null);
    setAutosavedAt(null);
    setDraftFull(false);
  };

  // Empties every field and deletes the saved draft + revision snapshots so a
  // cleared story doesn't reappear on refresh.
  const clearForm = () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setDek("");
    setLead("");
    setBlocks([]);
    setSection("");
    setAuthor("");
    setCity("");
    setTags([]);
    setTagInput("");
    setPublishAt("");
    setBreaking(false);
    setImageData(null);
    setSeoTitle("");
    setSeoDesc("");
    setRelated([]);
    setSources([]);
    setError(null);
    setPreview(false);
    discardDraft();
    setConfirmClear(false);
  };

  const restoreRevision = (revision: Snapshot) => {
    setTitle(revision.title);
    setDek(revision.dek);
    setLead(revision.lead);
    setBlocks(revision.body);
    setSection(revision.section);
    setTags(revision.tags);
    setAuthor(revision.author);
    setCity(revision.city);
    setPreview(false);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) setTags([...tags, tag]);
    setTagInput("");
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      setError("Choose an image under 20 MB.");
      return;
    }
    setError(null);
    try {
      setImageData(await uploadArticleImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The image couldn't be uploaded. Try again.");
    }
  };

  const wordCount = stripHtml(blocks.join(" ")).split(/\s+/).filter(Boolean).length;

  const validate = () => {
    if (title.trim().length < 10) return "Give the story a headline of at least 10 characters.";
    if (!section) return "Choose a desk for the story.";
    if (dek.trim().length < 10) return "Write a standfirst of at least 10 characters.";
    if (!author.trim()) return "Add a byline.";
    if (!city.trim()) return "Add a dateline city.";
    if (lead.trim().length < 30) return "The lead needs at least 30 characters.";
    if (!blocks.length) return "Write at least one body block after the lead.";
    return null;
  };

  const publish = () => {
    if (hasAdultWords([title, dek, lead, ...blocks, ...tags, seoTitle, seoDesc].join(" "))) {
      setToast(ADULT_WORDS_MESSAGE);
      return;
    }
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (!editing) discardDraft();
    const payload: ArticleInput = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      section,
      dek: dek.trim(),
      author: author.trim(),
      city: city.trim(),
      lead: lead.trim(),
      body: blocks,
      tags,
      sources: sources.filter((s) => s.label.trim() && s.url.trim()),
      related: related.map((r) => r.slug),
      seo: {
        title: seoTitle.trim() || undefined,
        description: seoDesc.trim() || undefined,
      },
      breaking,
      publishAt: publishAt || null,
      // An unchanged image is left out so the update keeps the stored one.
      image: imageData === (initial?.image ?? null) ? undefined : imageData ? { data: imageData } : null,
    };
    startTransition(async () => {
      const result = initial ? await updateStory(initial.slug, payload) : await createArticle(payload);
      if (result?.message) setToast(result.message);
    });
  };

  const sectionName = sections.find((s) => s.slug === section)?.name ?? section;

  // Cancel only warns when there's something to lose.
  const dirty = Boolean(
    title.trim() || dek.trim() || lead.trim() || blocks.length || imageData,
  );
  const exitTo = initial ? `/article/${initial.slug}` : "/";
  const cancel = () => (dirty ? setConfirmCancel(true) : router.push(exitTo));
  const submitLabel = editing ? "Save changes" : "Publish";
  const busyLabel = editing ? "Saving…" : "Publishing…";

  const previewBody = [`<p>${lead.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`, ...blocks];

  return (
    <section className="cms">
      {toast && (
        <div className="toast" role="alert" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
      <div className="cms-top">
        <div>
          <p className="kicker">Newsroom</p>
          <h1>{editing ? "Edit story" : "Article page"}</h1>
        </div>
        <div className="cms-actions">
          {autosavedAt && <span className="cms-saved">Saved {timeLabel(autosavedAt.getTime())}</span>}
          {!editing && (
            <button type="button" className="button outline" onClick={saveDraft}>
              Save draft
            </button>
          )}
          <button type="button" className="button outline" onClick={() => setPreview(true)}>
            Preview
          </button>
          <button type="button" className="button outline" onClick={cancel}>
            Cancel
          </button>
          {!editing && (
            <button type="button" className="button outline" onClick={() => setConfirmClear(true)}>
              Clear
            </button>
          )}
          <button type="button" className="button" onClick={publish} disabled={pending}>
            {pending ? busyLabel : submitLabel}
          </button>
        </div>
      </div>

      {restored && (
        <p className="cms-note" role="status">
          Restored your draft from {timeLabel(restored)}.
          <button type="button" onClick={discardDraft}>
            Discard
          </button>
        </p>
      )}
      {draftFull && (
        <p className="cms-note" role="status">
          This draft is too large for browser storage, so it isn&apos;t being autosaved. Publish
          soon or remove an image.
        </p>
      )}
      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      <div className="cms-grid">
        <div className="cms-main">
          <label className="cms-field">
            <span>
              Headline <em>Name your story</em>
            </span>
            <input
              type="text"
              value={title}
              maxLength={200}
              placeholder="The story in one line"
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value).slice(0, 80));
              }}
            />
            {hint("Clear, specific and informative — skip clever wordplay that hides the news.")}
          </label>

          <label className="cms-field">
            <span>
              Standfirst <em>A short excerpt shown under the headline</em>
            </span>
            <textarea
              value={dek}
              maxLength={300}
              rows={2}
              placeholder="One or two sentences summarizing the story"
              onChange={(event) => setDek(event.target.value)}
            />
          </label>

          <label className="cms-field">
            <span>
              Lead <em>The opening paragraph</em>
            </span>
            <textarea
              value={lead}
              maxLength={600}
              rows={4}
              placeholder="Who did what, where, when, why and how — the whole story in one paragraph"
              onChange={(event) => setLead(event.target.value)}
            />
            {hint("A reader who only reads this paragraph should still know the news.")}
          </label>

          <div className="cms-field">
            <span>
              Content <em>Write your story</em>
            </span>
            <ArticleEditor html={blocks.join("")} onChange={setBlocks} />
            {hint(`${wordCount} words · about ${Math.max(1, Math.round(wordCount / 60))} min to read`)}
          </div>
        </div>

        <aside className="cms-side">
          <Panel title="Publish">
            <label className="cms-field small">
              <span>Publish date</span>
              <input
                type="datetime-local"
                value={publishAt}
                onChange={(event) => setPublishAt(event.target.value)}
              />
              {hint("Leave empty for now; a future date schedules the story.")}
            </label>
            <label className="cms-switch">
              <input
                type="checkbox"
                checked={breaking}
                onChange={(event) => setBreaking(event.target.checked)}
              />
              <span className="switch" aria-hidden="true" />
              <span>
                Breaking news <em>Pins the story to the live ticker</em>
              </span>
            </label>
          </Panel>

          <Panel title="Slug">
            <label className="cms-field small">
              <span>URL</span>
              <input
                type="text"
                value={slug}
                maxLength={200}
                disabled={editing}
                placeholder="auto-generated"
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value).slice(0, 200));
                }}
              />
              {hint(`/article/${slug || "…"}`)}
            </label>
          </Panel>

          <Panel title="Desk & tags">
            <label className="cms-field small">
              <span>Category</span>
              <select value={section} onChange={(event) => setSection(event.target.value)}>
                <option value="" disabled>
                  Choose a desk
                </option>
                {sections.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="cms-field small">
              <span>Tags</span>
              <div className="chips">
                {tags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {tags.length < MAX_TAGS && (
                  <input
                    type="text"
                    value={tagInput}
                    placeholder="Add tag"
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                  />
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Featured image">
            <div
              className="cms-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                pickImage(event.dataTransfer.files[0]);
              }}
            >
              {imageData ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageData} alt="Featured preview" />
                  <button type="button" className="button outline" onClick={() => setImageData(null)}>
                    Remove image
                  </button>
                </>
              ) : (
                <>
                  <p>Drag and drop an image, or</p>
                  <button
                    type="button"
                    className="button outline"
                    onClick={() => fileInput.current?.click()}
                  >
                    Upload image
                  </button>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => pickImage(event.target.files?.[0])}
              />
            </div>
            {hint("Optional — a generated photo is used when none is uploaded.")}
          </Panel>

          <Panel title="Author">
            <label className="cms-field small">
              <span>Byline</span>
              <input
                type="text"
                value={author}
                maxLength={80}
                autoComplete="name"
                placeholder="Your name"
                onChange={(event) => setAuthor(event.target.value)}
              />
            </label>
            <label className="cms-field small">
              <span>Dateline</span>
              <input
                type="text"
                value={city}
                maxLength={80}
                placeholder="City"
                onChange={(event) => setCity(event.target.value)}
              />
              {hint("Where the story is reported from.")}
            </label>
          </Panel>

          <Panel title="SEO">
            <label className="cms-field small">
              <span>Meta title</span>
              <input
                type="text"
                value={seoTitle}
                maxLength={70}
                placeholder="Defaults to the headline"
                onChange={(event) => setSeoTitle(event.target.value)}
              />
              {hint(`${seoTitle.length}/70`)}
            </label>
            <label className="cms-field small">
              <span>Meta description</span>
              <textarea
                value={seoDesc}
                maxLength={160}
                rows={3}
                placeholder="Defaults to the standfirst"
                onChange={(event) => setSeoDesc(event.target.value)}
              />
              {hint(`${seoDesc.length}/160`)}
            </label>
          </Panel>

          <Panel title="Related articles">
            <div className="cms-field small">
              <span>Search stories</span>
              <input
                type="text"
                value={pickQuery}
                placeholder="Find a story to link"
                onChange={(event) => setPickQuery(event.target.value)}
              />
            </div>
            {picks.length > 0 && related.length < MAX_RELATED && (
              <ul className="cms-picks">
                {picks.map((pick) => (
                  <li key={pick.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        setRelated([...related, pick]);
                        setPickQuery("");
                      }}
                    >
                      <strong>{pick.title}</strong>
                      <em>{pick.sectionName}</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ul className="chips list">
              {related.map((pick) => (
                <li key={pick.slug} className="chip">
                  {pick.title}
                  <button
                    type="button"
                    aria-label={`Remove ${pick.title}`}
                    onClick={() => setRelated(related.filter((r) => r.slug !== pick.slug))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {hint(`Up to ${MAX_RELATED} stories; empty means automatic picks from the same desk.`)}
          </Panel>

          <Panel title="Sources">
            {sources.map((source, index) => (
              <div className="source-row" key={index}>
                <input
                  type="text"
                  value={source.label}
                  placeholder="Label"
                  onChange={(event) =>
                    setSources(
                      sources.map((s, i) => (i === index ? { ...s, label: event.target.value } : s)),
                    )
                  }
                />
                <input
                  type="url"
                  value={source.url}
                  placeholder="https://"
                  onChange={(event) =>
                    setSources(
                      sources.map((s, i) => (i === index ? { ...s, url: event.target.value } : s)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Remove source"
                  onClick={() => setSources(sources.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            {sources.length < MAX_SOURCES && (
              <button
                type="button"
                className="button outline"
                onClick={() => setSources([...sources, { label: "", url: "" }])}
              >
                Add source
              </button>
            )}
            {hint("Links listed at the end of the story.")}
          </Panel>

          <Panel title="Revisions">
            {revisions.length === 0 ? (
              hint("Snapshots appear here as you write.")
            ) : (
              <ul className="cms-revisions">
                {revisions.map((revision, index) => (
                  <li key={revision.savedAt}>
                    <span>
                      {index === 0 ? "Latest · " : ""}
                      {timeLabel(revision.savedAt)}
                    </span>
                    <button type="button" onClick={() => restoreRevision(revision)}>
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      {confirmCancel && (
        <Modal label="Discard changes" onClose={() => setConfirmCancel(false)}>
          <div className="modal-confirm">
            <h2>Discard your changes?</h2>
            <p>
              Your changes will be lost — the story hasn&apos;t been published or saved to
              drafts.
            </p>
            <div className="modal-confirm-actions">
              <button
                type="button"
                className="button outline"
                onClick={() => setConfirmCancel(false)}
              >
                Keep editing
              </button>
              <button type="button" className="button danger" onClick={() => router.push(exitTo)}>
                Discard changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmClear && (
        <Modal label="Clear story" onClose={() => setConfirmClear(false)}>
          <div className="modal-confirm">
            <h2>Clear everything?</h2>
            <p>
              This empties every field and deletes the saved draft and its
              revision history. This can&apos;t be undone.
            </p>
            <div className="modal-confirm-actions">
              <button
                type="button"
                className="button outline"
                onClick={() => setConfirmClear(false)}
              >
                Keep editing
              </button>
              <button type="button" className="button danger" onClick={clearForm}>
                Clear story
              </button>
            </div>
          </div>
        </Modal>
      )}

      {preview && (
        <Modal label="Story preview" size="wide" onClose={() => setPreview(false)}>
          <div className="modal-preview">
            <div className="cms-top">
              <div>
                <p className="kicker">Newsroom</p>
                <h1>Preview</h1>
              </div>
              <div className="cms-actions">
                <button
                  type="button"
                  className="button outline"
                  onClick={() => setPreview(false)}
                >
                  Back to editing
                </button>
                <button type="button" className="button" onClick={publish} disabled={pending}>
                  {pending ? busyLabel : submitLabel}
                </button>
              </div>
            </div>
            {error && (
              <p className="form-note error" role="alert">
                {error}
              </p>
            )}
            <article className="story cms-preview">
              <header className="story-head">
                <p className="story-kicker">
                  <span className="tag solid">{sectionName || "Desk"}</span>
                  {breaking && <span className="tag live">Breaking</span>}
                  {city}
                </p>
                <h1>{title || "Untitled story"}</h1>
                <p className="dek">{dek}</p>
                <div className="byrow">
                  <span className="avatar" aria-hidden="true">
                    {(author || "?").slice(0, 1)}
                  </span>
                  <div className="by-info">
                    <p className="by-name">By {author || "—"}</p>
                    <p className="by-meta">
                      {city} · {Math.max(1, Math.round((wordCount + lead.split(/\s+/).filter(Boolean).length) / 60))} min read
                    </p>
                  </div>
                </div>
              </header>
              {imageData && (
                <figure className="story-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageData} alt="" />
                </figure>
              )}
              <div className="story-body">
                {previewBody.map((block, index) => (
                  <div key={index} dangerouslySetInnerHTML={{ __html: block }} />
                ))}
                {tags.length > 0 && (
                  <ul className="story-tags" aria-label="Topics">
                    {tags.map((tag) => (
                      <li key={tag} className="tag ink">
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
                {sources.some((s) => s.label && s.url) && (
                  <section className="story-sources">
                    <h2>Sources</h2>
                    <ul>
                      {sources
                        .filter((s) => s.label && s.url)
                        .map((source, index) => (
                          <li key={index}>
                            <a href={source.url} target="_blank" rel="noopener">
                              {source.label}
                            </a>
                          </li>
                        ))}
                    </ul>
                  </section>
                )}
              </div>
            </article>
          </div>
        </Modal>
      )}
    </section>
  );
}
