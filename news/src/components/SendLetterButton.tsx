"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendLetterNow } from "@/app/actions";

// "Send now" control on the admin dashboard chips — fires the issue email for
// one address/newsletter pair right away, then refreshes so the chip shows
// its new status.
export default function SendLetterButton({ email, letter }: { email: string; letter: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await sendLetterNow(email, letter);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <>
      <button type="button" className="send-now" onClick={send} disabled={pending}>
        {pending ? "Sending…" : "Send now"}
      </button>
      {error && <em className="send-now-error">{error}</em>}
    </>
  );
}
