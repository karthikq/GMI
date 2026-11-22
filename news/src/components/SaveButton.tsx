"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleSave } from "@/app/actions";

export default function SaveButton({
  slug,
  section,
  initialSaved,
  signedIn,
}: {
  slug: string;
  section: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onClick = async () => {
    if (!signedIn) {
      router.push("/signin");
      return;
    }
    setBusy(true);
    const result = await toggleSave(slug, section);
    if ("saved" in result) setSaved(result.saved);
    setBusy(false);
  };

  return (
    <button
      type="button"
      className={`save-btn${saved ? " saved" : ""}`}
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved stories" : "Save this story"}
      title={saved ? "Saved — click to remove" : "Save for later"}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path
          d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
