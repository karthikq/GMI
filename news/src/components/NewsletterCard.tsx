"use client";

import { useActionState, useState } from "react";
import { setNewsletter, subscribeLetter } from "@/app/actions";
import NewsletterSampleModal from "./NewsletterSampleModal";
import type { Newsletter } from "@/lib/newsletters";

// One newsletter edition card. Signed-in readers toggle with a button; guests
// get an email field that enrols that address in just this newsletter.
export default function NewsletterCard({
  letter,
  subscribed,
  signedIn,
  premium,
  initialFormat,
}: {
  letter: Newsletter;
  subscribed: boolean;
  signedIn: boolean;
  premium: boolean;
  initialFormat?: string;
}) {
  const [on, setOn] = useState(subscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [state, action, pending] = useActionState(subscribeLetter, null);

  const toggle = async () => {
    setBusy(true);
    setError("");
    const result = await setNewsletter(letter.id, !on);
    if ("error" in result) {
      setError(result.error);
    } else {
      setOn(!on);
    }
    setBusy(false);
  };

  const guestDone = Boolean(state?.ok);

  return (
    <article
      className={`letter-card${letter.featured ? " featured" : ""}${on || guestDone ? " subscribed" : ""}`}
    >
      <div className="letter-top">
        <span>{letter.tagline}</span>
        <span>{letter.cadence}</span>
      </div>
      <h3 className="letter-name">{letter.name}</h3>
      <p className="letter-topics">{letter.topics.join(" · ")}</p>
      <p className="letter-blurb">{letter.blurb}</p>

      <button
        type="button"
        className="letter-sample-btn"
        onClick={() => setShowPreview(true)}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
        Choose format
      </button>

      {signedIn ? (
        <div className="letter-foot">
          <button
            type="button"
            className={on ? "button outline" : "button"}
            onClick={toggle}
            disabled={busy}
            aria-pressed={on}
          >
            {busy ? "Saving…" : on ? "Subscribed ✓" : "Subscribe"}
          </button>
          {error && (
            <p className="form-note error" role="status">
              {error}
            </p>
          )}
        </div>
      ) : state?.ok ? (
        <p className="form-note ok" role="status">
          {state.message}
        </p>
      ) : (
        <form action={action} className="letter-foot">
          <input type="hidden" name="letter" value={letter.id} />
          <div className="subscribe-row">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              aria-label={`Email address for ${letter.name}`}
            />
            <button type="submit" className="button" disabled={pending}>
              {pending ? "Sending…" : "Subscribe"}
            </button>
          </div>
          {state && (
            <p className={state.ok ? "form-note ok" : "form-note error"} role="status">
              {state.message}
            </p>
          )}
        </form>
      )}

      {showPreview && (
        <NewsletterSampleModal
          letter={letter}
          onClose={() => setShowPreview(false)}
          signedIn={signedIn}
          premium={premium}
          initialFormat={initialFormat}
        />
      )}
    </article>
  );
}
