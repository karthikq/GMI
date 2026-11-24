"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteStory } from "@/app/actions";
import Modal from "./Modal";

export default function OwnerActions({
  slug,
  published,
}: {
  slug: string;
  published: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"edit" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteStory(slug);
      if (result?.message) setError(result.message);
    });
  };

  return (
    <div className="share">
      <button
        type="button"
        aria-label="Edit story"
        title="Edit story"
        onClick={() => setConfirm("edit")}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Delete story"
        title="Delete story"
        onClick={() => setConfirm("delete")}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 5v6m4-6v6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {confirm === "edit" && (
        <Modal label="Edit story" onClose={() => setConfirm(null)}>
          <div className="modal-confirm">
            <h2>Edit this story?</h2>
            <p>
              {published
                ? "This story is already published — any changes you save will update the live story readers see."
                : "You'll be taken to the editor to update this story."}
            </p>
            <div className="modal-confirm-actions">
              <button type="button" className="button outline" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button"
                onClick={() => router.push(`/article/${slug}/edit`)}
              >
                Edit story
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirm === "delete" && (
        <Modal label="Delete story" onClose={() => setConfirm(null)}>
          <div className="modal-confirm">
            <h2>Delete this story?</h2>
            <p>This permanently removes the story from the site. This can&apos;t be undone.</p>
            {error && (
              <p className="form-note error" role="status">
                {error}
              </p>
            )}
            <div className="modal-confirm-actions">
              <button
                type="button"
                className="button outline"
                onClick={() => setConfirm(null)}
                disabled={pending}
              >
                Keep story
              </button>
              <button
                type="button"
                className="button danger"
                onClick={remove}
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete story"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
