"use client";

import { useState, useTransition } from "react";
import { reviewEditionArticles } from "@/app/actions";

// Inline review for editions flagged insufficient-content: shows the reason
// and current slugs, and lets an admin append published article slugs. Adding
// stories marks the edition ready so its queued deliveries can proceed.
export default function EditionReview({
  editionId,
  slugs,
  reason,
}: {
  editionId: string;
  slugs: string[];
  reason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setNote(null);
      const result = await reviewEditionArticles({
        editionId,
        slugs: input.split(/[\s,]+/).filter(Boolean),
      });
      if ("error" in result) {
        setNote({ kind: "error", text: result.error });
      } else {
        setNote({ kind: "ok", text: `Added — edition now has ${result.articleCount} stories and is ready.` });
        setInput("");
      }
    });

  return (
    <div className="nc-review">
      <button type="button" className="cat-edit" onClick={() => setOpen(!open)}>
        {open ? "Close review" : "Review"}
      </button>
      {open && (
        <div className="nc-review-body">
          {reason && <p className="nc-reason">{reason}</p>}
          <p className="nc-reason">
            Current: {slugs.length ? slugs.join(", ") : "no stories picked"}
          </p>
          <div className="subscribe-row">
            <input
              value={input}
              placeholder="article slugs, comma-separated"
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="button" className="button outline" onClick={add} disabled={pending || !input.trim()}>
              {pending ? "Adding…" : "Add articles"}
            </button>
          </div>
          {note && (
            <p className={`form-note ${note.kind}`} role="status">
              {note.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
