"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { setLetterTime, setNewsletter, subscribeLetter } from "@/app/actions";
import NewsletterSampleModal from "./NewsletterSampleModal";
import { nextIssueDate, type Newsletter } from "@/lib/newsletters";

function LockIcon({ size = 10 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// One newsletter edition card. Signed-in readers toggle with a button; guests
// get an email field that enrols that address in just this newsletter.
export default function NewsletterCard({
  letter,
  subscribed,
  signedIn,
  premium,
  initialFormat,
  initialTime,
  defaultTime,
}: {
  letter: Newsletter;
  subscribed: boolean;
  signedIn: boolean;
  premium: boolean;
  initialFormat?: string;
  initialTime?: string;
  /** The template's own send time ("HH:MM"); shown as the effective time when
   * the reader hasn't chosen their own. */
  defaultTime?: string;
}) {
  const [on, setOn] = useState(subscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [time, setTime] = useState(initialTime ?? "");
  const [showPreview, setShowPreview] = useState(false);
  const [state, action, pending] = useActionState(subscribeLetter, null);

  // The browser's zone is only knowable client-side — read it through a
  // subscribe-less external store so SSR renders "" and hydration fills it in.
  const zone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );

  const effectiveTime = time || defaultTime || "";

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

  // Saves the reader's delivery-time override; an empty value clears it. The
  // browser zone travels with it so delivery interprets the time locally.
  const pickTime = async (value: string) => {
    setTime(value);
    setError("");
    const result = await setLetterTime(
      letter.id,
      value,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if ("error" in result) {
      setError(result.error);
    }
  };

  const guestDone = Boolean(state?.ok);
  // Premium editions can't be subscribed to on a free plan; readers already
  // subscribed keep the toggle so they can still unsubscribe.
  const locked = Boolean(letter.premium) && !premium;

  return (
    <article
      className={`letter-card${letter.featured ? " featured" : ""}${on || guestDone ? " subscribed" : ""}${locked && !on ? " locked" : ""}`}
    >
      <div className="letter-body">
        <div className="letter-top">
          <span>{letter.tagline}</span>
          <span className="letter-cadence">
            {letter.cadence}
            {effectiveTime ? ` · ${effectiveTime}` : ""}
          </span>
        </div>
        <h3 className="letter-name">{letter.name}</h3>
        <p className="letter-topics">
          {letter.topics.join(" · ")}
          {letter.premium && (
            <span className="letter-tag">
              <LockIcon /> Premium
            </span>
          )}
        </p>
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

        {signedIn && on && (
          <div className="letter-time-block">
            <label className="letter-time">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              Send at
              <input
                type="time"
                value={effectiveTime}
                onChange={(event) => pickTime(event.target.value)}
                aria-label={`Delivery time for ${letter.name}`}
              />
              {time && defaultTime && time !== defaultTime && (
                <button
                  type="button"
                  className="letter-time-reset"
                  onClick={() => pickTime("")}
                  title={`Restore the default send time (${defaultTime})`}
                >
                  ↺ {defaultTime}
                </button>
              )}
            </label>
            <p className="letter-time-note">
              {zone ? `${zone} · ` : ""}Next edition {nextIssueDate(letter.cadence).toLowerCase()}
            </p>
          </div>
        )}

        {locked && !on && (
          <div className="letter-veil" aria-hidden="true">
            <LockIcon size={24} />
            <span>Members only</span>
          </div>
        )}
      </div>

      {locked && !on ? (
        <div className="letter-foot">
          <Link href="/subscribe" className="button">
            Upgrade to subscribe
          </Link>
          <p className="form-note">Desk editions are part of the paid plans.</p>
        </div>
      ) : signedIn ? (
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
