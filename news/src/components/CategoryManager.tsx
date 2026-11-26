"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createCategory,
  editCategory,
  removeCategory,
  reorderCategory,
  setCategoryFlags,
} from "@/app/actions";
import Modal from "@/components/Modal";
import type { Section } from "@/lib/api";

type EditingState =
  | { mode: "create"; parentSlug: string | null }
  | { mode: "edit"; category: Section; parentSlug: string | null }
  | null;

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function Flag({
  on,
  label,
  onToggle,
  disabled,
}: {
  on: boolean;
  label: string;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`cat-flag${on ? " on" : ""}`}
      aria-pressed={on}
      title={label}
      disabled={disabled}
      onClick={() => onToggle(!on)}
    >
      {label}
    </button>
  );
}

// The /admin/categories manager — expandable section rows with their
// subsections, quick flag toggles, reordering and an edit dialog. Writes go
// through server actions that enforce the admin role again server-side.
export default function CategoryManager({ sections }: { sections: Section[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState>(null);
  const [confirmDelete, setConfirmDelete] = useState<Section | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Form state for the create/edit dialog.
  const [form, setForm] = useState({
    name: "",
    slug: "",
    slugTouched: false,
    blurb: "",
    parentSlug: null as string | null,
    active: true,
    showInNav: true,
    featured: false,
    seoTitle: "",
    seoDescription: "",
  });

  const openCreate = (parentSlug: string | null) => {
    setError(null);
    setForm({
      name: "",
      slug: "",
      slugTouched: false,
      blurb: "",
      parentSlug,
      active: true,
      showInNav: true,
      featured: false,
      seoTitle: "",
      seoDescription: "",
    });
    setEditing({ mode: "create", parentSlug });
  };

  const openEdit = (category: Section, parentSlug: string | null) => {
    setError(null);
    setForm({
      name: category.name,
      slug: category.slug,
      slugTouched: true,
      blurb: category.blurb ?? "",
      parentSlug,
      active: category.active !== false,
      showInNav: category.showInNav !== false,
      featured: Boolean(category.featured),
      seoTitle: category.seoTitle ?? "",
      seoDescription: category.seoDescription ?? "",
    });
    setEditing({ mode: "edit", category, parentSlug });
  };

  const run = (work: () => Promise<{ ok?: true; error?: string; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await work();
      const problem = "error" in result ? result.error : "message" in result ? result.message : undefined;
      if (problem) setError(problem ?? "Something went wrong.");
      else router.refresh();
    });
  };

  const save = () => {
    const input = {
      name: form.name,
      slug: form.slug || undefined,
      blurb: form.blurb,
      parentSlug: form.parentSlug,
      active: form.active,
      showInNav: form.showInNav,
      featured: form.featured,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
    };
    if (editing?.mode === "edit") {
      run(() => editCategory(editing.category.id!, input));
    } else {
      run(async () => {
        const result = await createCategory(input);
        if ("error" in result) return result;
        return { ok: true };
      });
    }
    setEditing(null);
  };

  const toggleExpand = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const needle = query.trim().toLowerCase();
  const matches = (item: Section) =>
    !needle ||
    item.name.toLowerCase().includes(needle) ||
    item.slug.toLowerCase().includes(needle);
  const visible = sections.filter((section) => {
    if (matches(section)) return true;
    return (section.children ?? []).some(matches);
  });

  const flags = (item: Section) => (
    <span className="cat-flags">
      <Flag
        on={item.active !== false}
        label={item.active === false ? "Inactive" : "Active"}
        disabled={pending}
        onToggle={(next) => run(() => setCategoryFlags(item.id!, { active: next }))}
      />
      <Flag
        on={item.showInNav !== false}
        label="In nav"
        disabled={pending}
        onToggle={(next) => run(() => setCategoryFlags(item.id!, { showInNav: next }))}
      />
      <Flag
        on={Boolean(item.featured)}
        label="Featured"
        disabled={pending}
        onToggle={(next) => run(() => setCategoryFlags(item.id!, { featured: next }))}
      />
    </span>
  );

  const controls = (item: Section, siblings: Section[], index: number, parentSlug: string | null) => (
    <span className="cat-controls">
      <button
        type="button"
        className="cat-move"
        aria-label={`Move ${item.name} up`}
        disabled={pending || index === 0}
        onClick={() => run(() => reorderCategory(item.id!, -1))}
      >
        ↑
      </button>
      <button
        type="button"
        className="cat-move"
        aria-label={`Move ${item.name} down`}
        disabled={pending || index === siblings.length - 1}
        onClick={() => run(() => reorderCategory(item.id!, 1))}
      >
        ↓
      </button>
      <button type="button" className="cat-edit" onClick={() => openEdit(item, parentSlug)}>
        Edit
      </button>
      <button
        type="button"
        className="cat-delete"
        onClick={() => setConfirmDelete(item)}
      >
        Delete
      </button>
    </span>
  );

  return (
    <div className="cat-manager">
      <div className="cat-toolbar">
        <input
          type="search"
          value={query}
          placeholder="Search categories"
          aria-label="Search categories"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="button" onClick={() => openCreate(null)}>
          Add section
        </button>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      <div className="cat-table" role="table" aria-label="Categories">
        <div className="cat-row cat-head" role="row">
          <span>Category</span>
          <span>Flags</span>
          <span className="cat-count">Stories</span>
          <span className="cat-actions">Actions</span>
        </div>
        {visible.map((section, index) => {
          const id = section.id ?? section.slug;
          const children = section.children ?? [];
          const shownChildren = children.filter(matches);
          const open = expanded.has(id);
          return (
            <div key={id} className="cat-group">
              <div className={`cat-row${section.active === false ? " off" : ""}`} role="row">
                <span className="cat-name">
                  <button
                    type="button"
                    className="cat-expand"
                    aria-expanded={open}
                    aria-label={`${open ? "Collapse" : "Expand"} ${section.name}`}
                    onClick={() => toggleExpand(id)}
                  >
                    {children.length ? (open ? "▾" : "▸") : "·"}
                  </button>
                  <span>
                    <strong>{section.name}</strong>
                    <em>/{section.slug}</em>
                  </span>
                </span>
                {flags(section)}
                <span className="cat-count">{section.articleCount ?? 0}</span>
                <span className="cat-actions">
                  {controls(section, visible, index, null)}
                  <button
                    type="button"
                    className="cat-add"
                    onClick={() => openCreate(section.slug)}
                  >
                    + Subsection
                  </button>
                </span>
              </div>
              {open &&
                shownChildren.map((child, childIndex) => (
                  <div
                    key={child.id ?? child.slug}
                    className={`cat-row cat-child${child.active === false ? " off" : ""}`}
                    role="row"
                  >
                    <span className="cat-name">
                      <span aria-hidden="true" className="cat-indent" />
                      <span>
                        <strong>{child.name}</strong>
                        <em>
                          /{section.slug}/{child.slug}
                        </em>
                      </span>
                    </span>
                    {flags(child)}
                    <span className="cat-count">{child.articleCount ?? 0}</span>
                    <span className="cat-actions">
                      {controls(child, shownChildren, childIndex, section.slug)}
                    </span>
                  </div>
                ))}
              {open && children.length > 0 && shownChildren.length === 0 && (
                <div className="cat-row cat-child" role="row">
                  <span className="cat-name">No subsections match “{query}”.</span>
                </div>
              )}
            </div>
          );
        })}
        {!visible.length && <p className="side-note">No categories match “{query}”.</p>}
      </div>

      {editing && (
        <Modal
          label={editing.mode === "edit" ? `Edit ${editing.category.name}` : "New category"}
          onClose={() => setEditing(null)}
        >
          <div className="cat-form">
            <h2>{editing.mode === "edit" ? `Edit ${editing.category.name}` : form.parentSlug ? "New subsection" : "New section"}</h2>
            <label className="cms-field small">
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                maxLength={80}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: current.slugTouched ? current.slug : slugify(event.target.value).slice(0, 80),
                  }));
                }}
              />
            </label>
            <label className="cms-field small">
              <span>Slug</span>
              <input
                type="text"
                value={form.slug}
                maxLength={80}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    slugTouched: true,
                    slug: slugify(event.target.value).slice(0, 80),
                  }))
                }
              />
              <small className="compose-hint">
                {form.parentSlug ? `/${form.parentSlug}/${form.slug || "…"}` : `/${form.slug || "…"}`}
              </small>
            </label>
            {editing.mode === "create" && (
              <label className="cms-field small">
                <span>Parent section</span>
                <select
                  value={form.parentSlug ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, parentSlug: event.target.value || null }))
                  }
                >
                  <option value="">None — this is a main section</option>
                  {sections.map((section) => (
                    <option key={section.slug} value={section.slug}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="cms-field small">
              <span>Description</span>
              <textarea
                value={form.blurb}
                maxLength={300}
                rows={2}
                onChange={(event) => setForm((current) => ({ ...current, blurb: event.target.value }))}
              />
            </label>
            <div className="cat-form-flags">
              <label className="cms-switch">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                <span className="switch" aria-hidden="true" />
                <span>
                  Active <em>Uncheck to hide it without deleting</em>
                </span>
              </label>
              <label className="cms-switch">
                <input
                  type="checkbox"
                  checked={form.showInNav}
                  onChange={(event) => setForm((current) => ({ ...current, showInNav: event.target.checked }))}
                />
                <span className="switch" aria-hidden="true" />
                <span>
                  Show in navigation <em>Listed in the site and subsection menus</em>
                </span>
              </label>
              <label className="cms-switch">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))}
                />
                <span className="switch" aria-hidden="true" />
                <span>
                  Featured <em>Shown before the “More” list in the subsection strip</em>
                </span>
              </label>
            </div>
            <label className="cms-field small">
              <span>SEO meta title</span>
              <input
                type="text"
                value={form.seoTitle}
                maxLength={70}
                placeholder="Defaults to the category name"
                onChange={(event) => setForm((current) => ({ ...current, seoTitle: event.target.value }))}
              />
            </label>
            <label className="cms-field small">
              <span>SEO meta description</span>
              <textarea
                value={form.seoDescription}
                maxLength={160}
                rows={2}
                placeholder="Defaults to the description"
                onChange={(event) => setForm((current) => ({ ...current, seoDescription: event.target.value }))}
              />
            </label>
            <div className="modal-confirm-actions">
              <button type="button" className="button outline" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="button" onClick={save} disabled={pending || !form.name.trim()}>
                {editing.mode === "edit" ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal label="Delete category" onClose={() => setConfirmDelete(null)}>
          <div className="modal-confirm">
            <h2>Delete {confirmDelete.name}?</h2>
            <p>
              Categories with stories or subsections can&apos;t be deleted — deactivate them
              instead. This only works while nothing references the category.
            </p>
            <div className="modal-confirm-actions">
              <button type="button" className="button outline" onClick={() => setConfirmDelete(null)}>
                Keep it
              </button>
              <button
                type="button"
                className="button danger"
                disabled={pending}
                onClick={() => {
                  run(async () => {
                    const result = await removeCategory(confirmDelete.id!);
                    setConfirmDelete(null);
                    return result;
                  });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
