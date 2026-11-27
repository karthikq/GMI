"use client";

import { useState } from "react";
import { unsubscribeLetter } from "@/app/actions";

// Confirmation button for the signed unsubscribe link — a real POST through a
// server action, so mail scanners prefetching the URL never unsubscribe.
export default function UnsubscribeForm({
  email,
  letter,
  token,
}: {
  email: string;
  letter: string;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p className="form-note ok" role="status">
        {done}
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await unsubscribeLetter({ email, letter, token });
          if ("error" in result) setError(result.error);
          else setDone(result.message);
          setBusy(false);
        }}
      >
        {busy ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
