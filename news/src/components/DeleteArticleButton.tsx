"use client";

import { useState, useTransition } from "react";
import { deleteStory } from "@/app/actions";

export default function DeleteArticleButton({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!window.confirm("Delete this story? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStory(slug);
      if (result?.message) setError(result.message);
    });
  };

  return (
    <>
      <button type="button" className="button danger" onClick={remove} disabled={pending}>
        {pending ? "Deleting…" : "Delete story"}
      </button>
      {error && (
        <p className="form-note error" role="status">
          {error}
        </p>
      )}
    </>
  );
}
