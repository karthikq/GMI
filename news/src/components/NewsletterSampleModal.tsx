"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { chooseEmailFormat } from "@/app/actions";
import EmailSheet from "./EmailSheets";
import Modal from "./Modal";
import { EMAIL_FORMATS, type EmailFormat, type Newsletter } from "@/lib/newsletters";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LockedPanel({ format }: { format: EmailFormat }) {
  return (
    <div className="fmt-locked">
      <span className="fmt-locked-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
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

// Lets the reader preview each newsletter in the available email formats.
// The default (first) format is free for everyone; the rest unlock with a
// paid plan. A signed-in reader saves their pick with the Save button.
export default function NewsletterSampleModal({
  letter,
  onClose,
  signedIn,
  premium,
  initialFormat,
}: {
  letter: Newsletter;
  onClose: () => void;
  signedIn: boolean;
  premium: boolean;
  initialFormat?: string;
}) {
  const [format, setFormat] = useState(initialFormat ?? EMAIL_FORMATS[0].id);
  const [saved, setSaved] = useState(initialFormat ?? EMAIL_FORMATS[0].id);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: React.ReactNode } | null>(null);
  const [pending, startTransition] = useTransition();
  const active = EMAIL_FORMATS.find((item) => item.id === format) ?? EMAIL_FORMATS[0];
  const allowed = !active.premium || premium;

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
      const result = await chooseEmailFormat(active.id);
      if ("error" in result) {
        setNote({ kind: "error", text: result.error });
        return;
      }
      setSaved(active.id);
      setNote({
        kind: "ok",
        text: `Format saved — your ${letter.name} emails will use ${active.name}.`,
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

        <div className="fmt-body">
          <div className="fmt-tabs" role="tablist" aria-label="Email format">
            {EMAIL_FORMATS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={format === item.id}
                className="fmt-tab"
                onClick={() => select(item)}
              >
                {item.premium && <LockIcon />}
                {item.name}
                {item.premium && <span className="fmt-tab-tag">Paid</span>}
              </button>
            ))}
          </div>

          <div className="fmt-preview">
            {allowed ? <EmailSheet format={active.id} letter={letter} /> : <LockedPanel format={active} />}
          </div>
        </div>

        {allowed && (
          <div className="fmt-actions">
            {note && (
              <p className={`form-note ${note.kind}`} role="status">
                {note.text}
              </p>
            )}
            <button
              type="button"
              className="button"
              onClick={save}
              disabled={pending || (signedIn && saved === format)}
            >
              {pending ? "Saving…" : signedIn && saved === format ? "Saved ✓" : "Save format"}
            </button>
          </div>
        )}
      </div>
    </Modal>,
    document.body,
  );
}
