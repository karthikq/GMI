"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { chooseEmailFormat } from "@/app/actions";
import EditionEmail, { FormatThumb } from "@/components/email/formats";
import Modal from "./Modal";
import {
  EMAIL_FORMATS,
  type EmailFormat,
  type Newsletter,
} from "@/lib/newsletters";
import { sampleEditionContent } from "@/lib/sampleEditionContent";

function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LockedPanel({ format }: { format: EmailFormat }) {
  return (
    <div className="fmt-locked">
      <span className="fmt-locked-icon" aria-hidden="true">
        <LockIcon size={26} />
      </span>
      <h3>Premium format</h3>
      <p>
        <strong>{format.name}</strong> ({format.style}) is part of the paid plans.
        Upgrade to send your newsletters in this format — plus premium stories,
        ad-free reading and more.
      </p>
      <Link href="/subscribe" className="button">
        See plans
      </Link>
    </div>
  );
}

// The format picker: a grid of cards — thumbnail, name, description, reading
// time, minimum stories, image availability, selected state and a preview
// action — then a full sample edition rendered by the exact same component
// the mailer uses. Save persists the pick on this newsletter's subscription.
export default function NewsletterSampleModal({
  letter,
  onClose,
  signedIn,
  premium,
  initialFormat,
  supportedFormats,
  startInPreview,
}: {
  letter: Newsletter;
  onClose: () => void;
  signedIn: boolean;
  premium: boolean;
  initialFormat?: string;
  // Formats the newsletter's template enables — defaults to all eight.
  supportedFormats?: string[];
  // Open straight into the full-edition preview instead of the picker grid.
  startInPreview?: boolean;
}) {
  const formats = supportedFormats?.length
    ? EMAIL_FORMATS.filter((item) => supportedFormats.includes(item.id))
    : EMAIL_FORMATS;
  const initial =
    formats.find((item) => item.id === initialFormat)?.id ?? formats[0].id;
  const [format, setFormat] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [previewing, setPreviewing] = useState(Boolean(startInPreview));
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: React.ReactNode } | null>(null);
  const [pending, startTransition] = useTransition();
  const active = formats.find((item) => item.id === format) ?? formats[0];
  const allowed = !active.premium || premium;
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const content = sampleEditionContent(letter, siteUrl);

  const select = (item: EmailFormat) => {
    setFormat(item.id);
    setNote(null);
  };

  const save = () => {
    if (!signedIn) {
      setNote({
        kind: "error",
        text: (
          <>
            Sign in to save your format. <Link href="/signin">Sign in</Link>
          </>
        ),
      });
      return;
    }
    setNote(null);
    startTransition(async () => {
      const result = await chooseEmailFormat(letter.id, active.id);
      if ("error" in result) {
        setNote({ kind: "error", text: result.error });
        return;
      }
      setSaved(active.id);
      setNote({
        kind: "ok",
        text: `Saved — your ${letter.name} emails will use ${active.name}.`,
      });
    });
  };

  // Portalled to <body> so the card it opens from can't trap the fixed
  // overlay (transforms/stacking) or leak its card styles into the preview.
  return createPortal(
    <Modal label={`${letter.name} — Choose format`} onClose={onClose} size="wide">
      <div className="email-preview-wrap">
        <div className="email-preview-badge">
          <span>Choose format</span>
          <strong>{letter.name}</strong>
          <span>Delivered {letter.cadence.toLowerCase()}</span>
        </div>

        {!previewing ? (
          <div className="fmt-grid" role="radiogroup" aria-label="Email format">
            {formats.map((item) => {
              const locked = item.premium && !premium;
              const selected = format === item.id;
              return (
                <div
                  key={item.id}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  className={`fmt-card${selected ? " selected" : ""}`}
                  onClick={() => select(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select(item);
                    }
                  }}
                >
                  <span className="fmt-card-thumb" aria-hidden="true">
                    <FormatThumb format={item.id} />
                  </span>
                  <span className="fmt-card-head">
                    <strong>
                      {locked && <LockIcon size={11} />} {item.name}
                    </strong>
                    {item.premium && <span className="fmt-card-tag">Paid</span>}
                    {selected && <span className="fmt-card-check">✓ Selected</span>}
                  </span>
                  <span className="fmt-card-desc">{item.description}</span>
                  <span className="fmt-card-meta">
                    <span>{item.readTime}</span>
                    <span>{item.minStories}+ stories</span>
                    <span>{item.hasImages ? "Images" : "Text only"}</span>
                  </span>
                  <span className="fmt-card-actions">
                    <span
                      className="fmt-card-preview"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        select(item);
                        setPreviewing(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          select(item);
                          setPreviewing(true);
                        }
                      }}
                    >
                      Preview edition
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fmt-preview-full">
            <div className="fmt-preview-bar">
              <button type="button" className="fmt-back" onClick={() => setPreviewing(false)}>
                ← All formats
              </button>
              <span>
                Previewing <strong>{active.name}</strong> — sample edition, {content.stories.length} stories
              </span>
            </div>
            {allowed ? (
              <div className="fmt-preview-frame">
                <EditionEmail format={active.id} c={content} logoSrc="/logo.png" />
              </div>
            ) : (
              <LockedPanel format={active} />
            )}
          </div>
        )}

        <div className="fmt-foot">
          {note && (
            <p className={`form-note ${note.kind}`} role="status">
              {note.text}
            </p>
          )}
          <button
            type="button"
            className="button"
            onClick={save}
            disabled={pending || !allowed || (signedIn && saved === format)}
          >
            {pending ? "Saving…" : signedIn && saved === format ? "Saved ✓" : `Use ${active.name}`}
          </button>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
