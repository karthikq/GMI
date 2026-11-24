"use client";

import { useEffect, useRef, useState } from "react";
import {
  EditorContent,
  Extension,
  mergeAttributes,
  Node,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Youtube, getEmbedUrlFromYoutubeUrl, isValidYoutubeUrl } from "@tiptap/extension-youtube";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { uploadArticleImage } from "@/lib/image";
import { ADULT_WORDS_PATTERN } from "@/lib/censor";

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ");

// A block with no text still matters when it carries media (image, video, table, rule).
const hasMedia = (el: Element) =>
  Boolean(el.querySelector("img, iframe, table, hr, video, audio, embed, object"));

// Splits the editor's HTML into the top-level blocks the API stores.
// Runs inside event handlers only — it needs a live DOM.
function toBlocks(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.children)
    .filter(
      (el) => stripHtml(el.outerHTML).replace(/&nbsp;/g, " ").trim() || hasMedia(el),
    )
    .map((el) => el.outerHTML);
}

/* Find & replace: matches are highlighted with inline decorations driven by
   plugin state; the toolbar UI below pushes {query, active} through meta. */

const findKey = new PluginKey<{ query: string; active: number }>("findReplace");

function findMatches(doc: PMNode, query: string) {
  const matches: { from: number; to: number }[] = [];
  const needle = query.trim().toLowerCase();
  if (!needle) return matches;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const haystack = node.text.toLowerCase();
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
      matches.push({ from: pos + at, to: pos + at + needle.length });
    }
  });
  return matches;
}

const FindReplace = Extension.create({
  name: "findReplace",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: findKey,
        state: {
          init: () => ({ query: "", active: -1 }),
          apply: (tr, state) =>
            tr.getMeta(findKey) ?? (tr.docChanged ? { ...state, active: -1 } : state),
        },
        props: {
          decorations: (state) => {
            const { query, active } = findKey.getState(state) ?? { query: "", active: -1 };
            return DecorationSet.create(
              state.doc,
              findMatches(state.doc, query).map((m, i) =>
                Decoration.inline(m.from, m.to, {
                  class: i === active ? "find-hit is-current" : "find-hit",
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

/* Words blocked on publish (lib/censor) are underlined as the writer types so
   the offending text is already visible when the publish check fails. */

const FlaggedWords = Extension.create({
  name: "flaggedWords",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const hits: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const m of node.text.matchAll(ADULT_WORDS_PATTERN)) {
                const at = m.index ?? 0;
                hits.push(
                  Decoration.inline(pos + at, pos + at + m[0].length, {
                    class: "flagged-word",
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, hits);
          },
        },
      }),
    ];
  },
});

/* Images live inside a <figure> with an editable caption, matching the
   story-figure/figcap markup the article page already styles. A saved
   width persists as max-width so it stays responsive on narrow screens. */

const MIN_IMAGE_WIDTH = 160;
const MAX_IMAGE_WIDTH = 1600;

const parseWidth = (el: HTMLElement): number | null => {
  const raw =
    el.style?.maxWidth ||
    el.getAttribute("data-width") ||
    el.style?.width ||
    el.getAttribute("width");
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Shared by the toolbar insert and the in-figure replace picker.
async function readImageFile(file: File | undefined) {
  if (!file) return null;
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
    window.alert("Choose an image under 20 MB.");
    return null;
  }
  try {
    return { src: await uploadArticleImage(file), alt: file.name.replace(/\.[^.]+$/, "") };
  } catch (err) {
    window.alert(err instanceof Error ? err.message : "The image couldn't be uploaded. Try again.");
    return null;
  }
}

const promptYoutubeUrl = () => {
  const url = window.prompt("YouTube URL", "https://www.youtube.com/watch?v=");
  if (url && isValidYoutubeUrl(url)) return url;
  if (url) window.alert("Enter a valid YouTube link.");
  return null;
};

// Accepts a plain embed URL or a full <iframe src="…"> snippet; only http(s)
// sources are kept so javascript: URLs can't slip into published stories.
const promptEmbedSrc = () => {
  const input = window.prompt("Embed URL or <iframe> code", "https://");
  if (!input) return null;
  let src = input.trim();
  const iframe = src.match(/<iframe[^>]*\bsrc=["']([^"']+)["']/i);
  if (iframe) src = iframe[1];
  if (!/^https?:\/\//i.test(src)) {
    window.alert("Enter a valid embed URL or iframe code.");
    return null;
  }
  return src;
};

/* Floating-toolbar figure, modeled on the Tiptap image-node-pro component:
   selecting the image shows an overlay bar (align + options menu) and a
   corner drag handle; the caption field sits below the media. */

const ALIGN_ICONS: Record<"left" | "center" | "right", React.ReactNode> = {
  left: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="13" y2="12" /><line x1="4" y1="18" x2="17" y2="18" />
    </svg>
  ),
  center: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="6" y1="18" x2="18" y2="18" />
    </svg>
  ),
  right: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="11" y1="12" x2="20" y2="12" /><line x1="7" y1="18" x2="20" y2="18" />
    </svg>
  ),
};

function FigureView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const media = useRef<HTMLDivElement>(null);
  const captionField = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const menuWrap = useRef<HTMLDivElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const width = dragWidth ?? node.attrs.width ?? null;
  const align = (node.attrs.align as "left" | "right" | null) ?? null;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuWrap.current?.contains(e.target as globalThis.Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const setAlign = (dir: "left" | "center" | "right") => {
    updateAttributes({
      // Alignment only shows on a sized figure — pin the rendered width first.
      width: node.attrs.width ?? media.current?.offsetWidth ?? null,
      align: dir === "center" ? null : dir,
    });
  };

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const start = media.current?.offsetWidth ?? node.attrs.width ?? 600;
    const clamp = (x: number) =>
      Math.round(Math.max(MIN_IMAGE_WIDTH, Math.min(start + x - startX, MAX_IMAGE_WIDTH)));
    const onMove = (e: PointerEvent) => setDragWidth(clamp(e.clientX));
    const onUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragWidth(null);
      updateAttributes({ width: clamp(e.clientX) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const replaceImage = async (file: File | undefined) => {
    const image = await readImageFile(file);
    if (image) updateAttributes(image);
  };

  return (
    <NodeViewWrapper
      as="figure"
      className="story-figure"
      data-selected={selected || undefined}
      data-align={align ?? undefined}
      style={{
        ...(width ? { maxWidth: width } : {}),
        // Inline margins beat the stylesheet's auto-centering, so the
        // alignment is visible in the editor as well as on the page.
        ...(align === "left" ? { marginLeft: 0 } : {}),
        ...(align === "right" ? { marginRight: 0 } : {}),
      }}
    >
      <div className="figure-media" ref={media} contentEditable={false}>
        {/* Editor-only preview of the raw uploaded image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={node.attrs.src} alt={node.attrs.alt ?? ""} draggable={false} />
        {selected && (
          <div className="figtools" onMouseDown={(event) => event.preventDefault()}>
            {(["left", "center", "right"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                className={`figtool${(align ?? "center") === dir ? " is-active" : ""}`}
                title={`Align ${dir}`}
                onClick={() => setAlign(dir)}
              >
                {ALIGN_ICONS[dir]}
              </button>
            ))}
            <span className="figtool-sep" />
            <div className="figtool-menu-wrap" ref={menuWrap}>
              <button
                type="button"
                className="figtool"
                title="Image options"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
              {menuOpen && (
                <div className="figmenu" role="menu">
                  <button
                    type="button"
                    className="figmenu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      captionField.current?.focus();
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    Edit Caption
                  </button>
                  <button
                    type="button"
                    className="figmenu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      replaceInput.current?.click();
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L6 20" />
                    </svg>
                    Replace Image
                  </button>
                  <button
                    type="button"
                    className="figmenu-item"
                    disabled={node.attrs.width == null}
                    onClick={() => {
                      setMenuOpen(false);
                      updateAttributes({ width: null, align: null });
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                    Full Width
                  </button>
                  <button
                    type="button"
                    className="figmenu-item is-danger"
                    onClick={() => {
                      setMenuOpen(false);
                      deleteNode();
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                    Delete Image
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {selected && (
          <span
            className="resize-handle"
            role="separator"
            aria-label="Drag to resize image"
            title="Drag to resize"
            onPointerDown={startDrag}
          />
        )}
      </div>
      <div className="figcap-row" contentEditable={false}>
        <input
          ref={captionField}
          className="figcap-field"
          type="text"
          value={node.attrs.caption}
          placeholder="Add a caption — include the credit"
          aria-label="Image caption"
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => updateAttributes({ caption: event.target.value })}
        />
        <input
          ref={replaceInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (event) => {
            await replaceImage(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}

const FigureImage = Image.extend({
  name: "figure",

  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: "" },
      width: { default: null, parseHTML: (el) => parseWidth(el as HTMLElement) },
      align: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          const img = el.querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            caption: el.querySelector("figcaption")?.textContent ?? "",
            width: parseWidth(el as HTMLElement),
            align: el.getAttribute("data-align"),
          };
        },
      },
      { tag: "img[src]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, width, align, ...imgAttrs } = HTMLAttributes;
    return [
      "figure",
      {
        class: "story-figure",
        ...(width ? { style: `max-width: ${width}px` } : {}),
        ...(align ? { "data-align": align } : {}),
      },
      ["img", mergeAttributes(this.options.HTMLAttributes, imgAttrs)],
      ...(caption ? ([["figcaption", { class: "figcap" }, caption]] as const) : []),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});

/* YouTube embeds get the same corner-handle resize; embedWidth lives on the
   wrapper div as max-width so the iframe keeps its responsive styling. */

function YoutubeView({ node, updateAttributes, selected }: NodeViewProps) {
  const media = useRef<HTMLDivElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? node.attrs.embedWidth ?? null;
  const align = (node.attrs.align as "left" | "right" | null) ?? null;
  const embedUrl = node.attrs.src
    ? getEmbedUrlFromYoutubeUrl({ url: node.attrs.src, nocookie: true })
    : null;

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const start = media.current?.offsetWidth ?? node.attrs.embedWidth ?? 640;
    const clamp = (x: number) =>
      Math.round(Math.max(MIN_IMAGE_WIDTH, Math.min(start + x - startX, MAX_IMAGE_WIDTH)));
    const onMove = (e: PointerEvent) => setDragWidth(clamp(e.clientX));
    const onUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragWidth(null);
      updateAttributes({ embedWidth: clamp(e.clientX) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper
      className="youtube-embed"
      data-youtube-video=""
      data-selected={selected || undefined}
      data-align={align ?? undefined}
      style={{
        ...(width ? { maxWidth: width } : {}),
        ...(align === "left" ? { marginLeft: 0 } : {}),
        ...(align === "right" ? { marginRight: 0 } : {}),
      }}
    >
      <div className="figure-media" ref={media} contentEditable={false}>
        {embedUrl && (
          <iframe
            src={embedUrl}
            width={node.attrs.width}
            height={node.attrs.height}
            allowFullScreen
            title="YouTube video"
          />
        )}
        {selected && (
          <span
            className="resize-handle"
            role="separator"
            aria-label="Drag to resize video"
            title="Drag to resize"
            onPointerDown={startDrag}
          />
        )}
      </div>
      {node.attrs.embedWidth != null && (
        <div className="figcap-row" contentEditable={false}>
          {(["left", "center", "right"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              className={`figcap-reset${(align ?? "center") === dir ? " is-active" : ""}`}
              title={`Align ${dir}`}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => updateAttributes({ align: dir === "center" ? null : dir })}
            >
              {dir[0].toUpperCase() + dir.slice(1)}
            </button>
          ))}
          <button
            type="button"
            className="figcap-reset"
            title="Back to full width"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => updateAttributes({ embedWidth: null, align: null })}
          >
            Full width
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

const ResizableYoutube = Youtube.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      embedWidth: {
        default: null,
        rendered: false,
        parseHTML: (el) =>
          parseWidth((el.closest("[data-youtube-video]") as HTMLElement | null) ?? el),
      },
      align: {
        default: null,
        rendered: false,
        parseHTML: (el) =>
          ((el.closest("[data-youtube-video]") as HTMLElement | null) ?? el).getAttribute(
            "data-align",
          ),
      },
    };
  },

  renderHTML(props) {
    const { embedWidth, ...rest } = props.HTMLAttributes;
    const spec = this.parent?.({ ...props, HTMLAttributes: rest });
    const width = (embedWidth ?? props.node.attrs.embedWidth) as number | null;
    const align = props.node.attrs.align as string | null;
    if (
      (width || align) &&
      Array.isArray(spec) &&
      typeof spec[1] === "object" &&
      spec[1] !== null &&
      !Array.isArray(spec[1])
    ) {
      spec[1] = mergeAttributes(spec[1] as Record<string, string>, {
        ...(width ? { style: `max-width: ${width}px` } : {}),
        ...(align ? { "data-align": align } : {}),
      });
    }
    return spec ?? ["div"];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView);
  },
});

/* Generic iframe embeds (Vimeo, Dailymotion, any provider's <iframe> code)
   get the same corner-handle resize as YouTube videos. */

function EmbedView({ node, updateAttributes, selected }: NodeViewProps) {
  const media = useRef<HTMLDivElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? node.attrs.embedWidth ?? null;
  const align = (node.attrs.align as "left" | "right" | null) ?? null;
  const src = node.attrs.src as string | null;

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const start = media.current?.offsetWidth ?? node.attrs.embedWidth ?? 640;
    const clamp = (x: number) =>
      Math.round(Math.max(MIN_IMAGE_WIDTH, Math.min(start + x - startX, MAX_IMAGE_WIDTH)));
    const onMove = (e: PointerEvent) => setDragWidth(clamp(e.clientX));
    const onUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragWidth(null);
      updateAttributes({ embedWidth: clamp(e.clientX) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper
      className="generic-embed"
      data-embed=""
      data-selected={selected || undefined}
      data-align={align ?? undefined}
      style={{
        ...(width ? { maxWidth: width } : {}),
        ...(align === "left" ? { marginLeft: 0 } : {}),
        ...(align === "right" ? { marginRight: 0 } : {}),
      }}
    >
      <div className="figure-media" ref={media} contentEditable={false}>
        {src && <iframe src={src} allowFullScreen title="Embedded video" loading="lazy" />}
        {selected && (
          <span
            className="resize-handle"
            role="separator"
            aria-label="Drag to resize embed"
            title="Drag to resize"
            onPointerDown={startDrag}
          />
        )}
      </div>
      {node.attrs.embedWidth != null && (
        <div className="figcap-row" contentEditable={false}>
          {(["left", "center", "right"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              className={`figcap-reset${(align ?? "center") === dir ? " is-active" : ""}`}
              title={`Align ${dir}`}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => updateAttributes({ align: dir === "center" ? null : dir })}
            >
              {dir[0].toUpperCase() + dir.slice(1)}
            </button>
          ))}
          <button
            type="button"
            className="figcap-reset"
            title="Back to full width"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => updateAttributes({ embedWidth: null, align: null })}
          >
            Full width
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

const IframeEmbed = Node.create({
  name: "iframeEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      embedWidth: {
        default: null,
        rendered: false,
        parseHTML: (el) =>
          parseWidth((el.closest("[data-embed]") as HTMLElement | null) ?? el),
      },
      align: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-embed]",
        getAttrs: (el) => ({
          src: el.querySelector("iframe")?.getAttribute("src"),
          align: el.getAttribute("data-align"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = node.attrs.embedWidth as number | null;
    const align = node.attrs.align as string | null;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-embed": "",
        ...(width ? { style: `max-width: ${width}px` } : {}),
        ...(align ? { "data-align": align } : {}),
      }),
      ["iframe", { src: node.attrs.src, allowfullscreen: "true", loading: "lazy", title: "Embedded video" }],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
});

const keep = (event: React.MouseEvent) => event.preventDefault();

function Btn({
  title,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={keep}
      onClick={onClick}
      className={active ? "is-active" : ""}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="editor-sep" aria-hidden="true" />;

export default function ArticleEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (blocks: string[]) => void;
}) {
  const lastEmitted = useRef(html);
  const imageInput = useRef<HTMLInputElement>(null);
  const findField = useRef<HTMLInputElement>(null);

  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [cursor, setCursor] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
        heading: { levels: [2, 3, 4] },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FigureImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      ResizableYoutube.configure({ nocookie: true, width: 640, height: 360 }),
      IframeEmbed,
      FindReplace,
      FlaggedWords,
    ],
    content: html,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "editor-area",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Story body",
        "data-placeholder":
          "Write the story. Most important details first — editors cut from the bottom.",
      },
    },
    onUpdate: ({ editor }) => {
      const blocks = toBlocks(editor.getHTML());
      // The parent hands back blocks.join("") — compare against that exact
      // string, or the round-trip through DOMParser looks like an external
      // change and setContent below slams the caret to the end of the doc.
      lastEmitted.current = blocks.join("");
      onChange(blocks);
    },
  });

  // Outside changes (draft restore, revision restore) replace the editor content;
  // the editor's own input events never feed back into itself.
  useEffect(() => {
    if (editor && html !== lastEmitted.current) {
      lastEmitted.current = html;
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [editor, html]);

  // Push the find state into the decoration plugin.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(findKey, { query: findOpen ? query : "", active: cursor }),
    );
  }, [editor, findOpen, query, cursor]);

  useEffect(() => {
    if (findOpen) findField.current?.focus();
  }, [findOpen]);

  const block = (tag: string) => {
    if (!editor) return;
    let chain = editor.chain().focus();
    if (editor.isActive("bulletList")) chain = chain.toggleBulletList();
    if (editor.isActive("orderedList")) chain = chain.toggleOrderedList();
    chain = chain.clearNodes();
    if (tag === "blockquote") chain.toggleBlockquote().run();
    else if (tag === "p") chain.setParagraph().run();
    else chain.setHeading({ level: Number(tag[1]) as 2 | 3 | 4 }).run();
  };

  const link = () => {
    if (!editor) return;
    const url = window.prompt("Link URL", "https://");
    if (url && /^https?:\/\//i.test(url)) editor.chain().focus().setLink({ href: url }).run();
    else if (url) window.alert("Links must start with http:// or https://");
  };

  const pickImage = async (file: File | undefined) => {
    const image = await readImageFile(file);
    if (image) editor?.chain().focus().setImage(image).run();
  };

  const addVideo = () => {
    const url = promptYoutubeUrl();
    if (url) editor?.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const addEmbed = () => {
    const src = promptEmbedSrc();
    if (src) editor?.chain().focus().insertContent({ type: "iframeEmbed", attrs: { src } }).run();
  };

  // Find & replace state — recomputed on every render while the bar is open.
  const matches = findOpen && editor && query.trim() ? findMatches(editor.state.doc, query) : [];
  const activeIdx = matches.length ? Math.min(cursor, matches.length - 1) : -1;

  const jump = (dir: 1 | -1) => {
    if (!editor || !matches.length) return;
    const i = (activeIdx + dir + matches.length) % matches.length;
    setCursor(i);
    const m = matches[i];
    editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  };

  const replaceCurrent = () => {
    if (!editor || activeIdx < 0) return;
    const m = matches[activeIdx];
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replacement).run();
  };

  const replaceAll = () => {
    if (!editor || !matches.length) return;
    const chain = editor.chain().focus();
    // Back to front so earlier positions stay valid within one transaction.
    [...matches]
      .reverse()
      .forEach((m) => chain.insertContentAt({ from: m.from, to: m.to }, replacement));
    chain.run();
  };

  const blockValue = editor?.isActive("heading", { level: 2 })
    ? "h2"
    : editor?.isActive("heading", { level: 3 })
      ? "h3"
      : editor?.isActive("heading", { level: 4 })
        ? "h4"
        : editor?.isActive("blockquote")
          ? "blockquote"
          : "p";

  const active = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false;

  const text = editor?.getText() ?? "";
  const words = text.split(/\s+/).filter(Boolean).length;

  return (
    <div className="editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
        <Btn title="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M3 7v6h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Btn>
        <Btn title="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M21 7v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Btn>
        <Sep />
        <select
          className="editor-block"
          value={blockValue}
          aria-label="Text style"
          onMouseDown={keep}
          onChange={(event) => block(event.target.value)}
        >
          <option value="p">Normal text</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="h4">Minor heading</option>
          <option value="blockquote">Quote</option>
        </select>
        <Btn title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} active={active("bold")}>
          <b>B</b>
        </Btn>
        <Btn title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} active={active("italic")}>
          <i>I</i>
        </Btn>
        <Btn title="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()} active={active("underline")}>
          <u>U</u>
        </Btn>
        <Btn title="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()} active={active("strike")}>
          <s>S</s>
        </Btn>
        <Btn title="Inline code" onClick={() => editor?.chain().focus().toggleCode().run()} active={active("code")}>
          <code>&lt;/&gt;</code>
        </Btn>
        <Btn title="Code block" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={active("codeBlock")}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="m8 6-6 6 6 6M16 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Link" onClick={link} active={active("link")}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M10 14a5 5 0 0 0 7.1 0l2.5-2.5a5 5 0 0 0-7-7.1l-1.4 1.4M14 10a5 5 0 0 0-7.1 0l-2.5 2.5a5 5 0 0 0 7 7.1l1.4-1.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </Btn>
        <Btn title="Remove link" onClick={() => editor?.chain().focus().unsetLink().run()} disabled={!active("link")}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M10 14a5 5 0 0 0 7.1 0l2.5-2.5a5 5 0 0 0-7-7.1l-1.4 1.4M14 10a5 5 0 0 0-7.1 0l-2.5 2.5a5 5 0 0 0 7 7.1l1.4-1.4M4 4l16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Bullets" onClick={() => editor?.chain().focus().toggleBulletList().run()} active={active("bulletList")}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="4.5" cy="6" r="1.6" fill="currentColor" />
            <circle cx="4.5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="4.5" cy="18" r="1.6" fill="currentColor" />
          </svg>
        </Btn>
        <Btn title="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={active("orderedList")}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M10 6h10M10 12h10M10 18h10M4 5.5V10M3.6 5.7 4 5.4l.5-.2M3.5 15.5h2l-2 2.5h2M3.5 17h2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Align left" onClick={() => editor?.chain().focus().setTextAlign("left").run()} active={editor?.isActive({ textAlign: "left" })}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M4 6h16M4 10h10M4 14h16M4 18h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Btn>
        <Btn title="Align center" onClick={() => editor?.chain().focus().setTextAlign("center").run()} active={editor?.isActive({ textAlign: "center" })}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M4 6h16M7 10h10M4 14h16M7 18h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Btn>
        <Btn title="Align right" onClick={() => editor?.chain().focus().setTextAlign("right").run()} active={editor?.isActive({ textAlign: "right" })}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M4 6h16M10 10h10M4 14h16M10 18h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Insert image" onClick={() => imageInput.current?.click()}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <path d="m21 15-5-5L5 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Btn>
        <Btn
          title="Insert table"
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          active={active("table")}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M3 10h18M3 15h18M9 10v10M15 10v10" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </Btn>
        <Btn title="Embed YouTube video" onClick={addVideo}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" />
          </svg>
        </Btn>
        <Btn title="Embed iframe video" onClick={addEmbed}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="m8 6-6 6 6 6M16 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Btn>
        <Btn title="Horizontal rule" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M4 7h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".45" />
            <path d="M4 12h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Find and replace" onClick={() => { setFindOpen(!findOpen); setCursor(0); }} active={findOpen}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Btn>
        <Btn title="Clear formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="m5 5 7 7m0-7-7 7M13 20h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Btn>
      </div>

      {findOpen && (
        <div className="editor-find" role="search">
          <input
            ref={findField}
            type="search"
            value={query}
            placeholder="Find"
            aria-label="Find"
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jump(event.shiftKey ? -1 : 1);
              }
            }}
          />
          <span className="find-count" aria-live="polite">
            {matches.length ? `${activeIdx + 1}/${matches.length}` : "0/0"}
          </span>
          <Btn title="Previous match" onClick={() => jump(-1)} disabled={!matches.length}>↑</Btn>
          <Btn title="Next match" onClick={() => jump(1)} disabled={!matches.length}>↓</Btn>
          <input
            type="text"
            value={replacement}
            placeholder="Replace with"
            aria-label="Replace with"
            onChange={(event) => setReplacement(event.target.value)}
          />
          <button type="button" onClick={replaceCurrent} disabled={activeIdx < 0}>
            Replace
          </button>
          <button type="button" onClick={replaceAll} disabled={!matches.length}>
            All
          </button>
          <button
            type="button"
            aria-label="Close find"
            onClick={() => {
              setFindOpen(false);
              setQuery("");
            }}
          >
            ×
          </button>
        </div>
      )}

      {editor?.isActive("table") && (
        <div className="editor-tablebar" role="toolbar" aria-label="Table">
          <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().addRowAfter().run()}>
            + Row
          </button>
          <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().deleteRow().run()}>
            − Row
          </button>
          <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Column
          </button>
          <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().deleteColumn().run()}>
            − Column
          </button>
          <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
            Header row
          </button>
          <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().mergeOrSplit().run()}>
            Merge/split
          </button>
          <button type="button" className="danger" onMouseDown={keep} onClick={() => editor.chain().focus().deleteTable().run()}>
            Delete table
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="editor-status">
        {words} words · {text.length} characters
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          pickImage(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
