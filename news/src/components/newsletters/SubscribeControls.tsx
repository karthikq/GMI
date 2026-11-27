"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useState } from "react";
import { setNewsletter, subscribeLetter } from "@/app/actions";
import type { Newsletter } from "@/lib/newsletters";
import { CheckIcon, LockIcon } from "./icons";

const ManageSlot = dynamic(() => import("./ManageLetterModal"), { ssr: false });

// Shared subscribe/manage state for every newsletter row and card.
// subscription state lives here; presentation stays with the caller.
export function useLetterSubscription(
  letter: Newsletter,
  subscribed: boolean,
  onChange?: (on: boolean) => void,
) {
  const [on, setOnState] = useState(subscribed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setOn = (v: boolean) => {
    setOnState(v);
    onChange?.(v);
  };

  const toggle = async () => {
    setBusy(true);
    setError("");
    const result = await setNewsletter(letter.id, !on);
    if ("error" in result) setError(result.error);
    else setOn(!on);
    setBusy(false);
  };

  return { on, setOn, busy, error, toggle };
}

// Signed-out subscribe: a compact inline email row, same server action the
// old card used. Renders inside whatever container the caller provides.
export function GuestSubscribeForm({ letter }: { letter: Newsletter }) {
  const [state, action, pending] = useActionState(subscribeLetter, null);
  if (state?.ok) {
    return (
      <p className="form-note ok" role="status">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="nl-guest-form">
      <input type="hidden" name="letter" value={letter.id} />
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        aria-label={`Email address for ${letter.name}`}
      />
      <button type="submit" className="nl-btn" disabled={pending}>
        {pending ? "Sending…" : "Subscribe"}
      </button>
      {state && (
        <p className={state.ok ? "form-note ok" : "form-note error"} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

// The right-hand action cell shared by rows/cards:
//   subscribed → green check + Manage
//   free user on a premium letter → Upgrade link
//   guest → Subscribe (opens the email row)
//   otherwise → compact Subscribe button
export function LetterAction({
  letter,
  on,
  setOn,
  busy,
  toggle,
  signedIn,
  premium,
  initialFormat,
  supportedFormats,
  sendTime,
}: {
  letter: Newsletter;
  on: boolean;
  setOn: (v: boolean) => void;
  busy: boolean;
  toggle: () => Promise<void>;
  signedIn: boolean;
  premium: boolean;
  initialFormat?: string;
  supportedFormats?: string[];
  sendTime?: string | null;
}) {
  const [managing, setManaging] = useState(false);
  const [wantEmail, setWantEmail] = useState(false);
  const locked = Boolean(letter.premium) && !premium && !on;

  return (
    <>
      {on ? (
        <div className="nl-status">
          <span className="nl-check" title="Subscribed">
            <CheckIcon />
            Subscribed
          </span>
          <button type="button" className="nl-btn ghost" onClick={() => setManaging(true)}>
            Manage
          </button>
        </div>
      ) : locked ? (
        <Link href="/subscribe" className="nl-btn ghost">
          <LockIcon size={11} /> Premium
        </Link>
      ) : signedIn ? (
        <button type="button" className="nl-btn" onClick={toggle} disabled={busy}>
          {busy ? "Saving…" : "Subscribe"}
        </button>
      ) : wantEmail ? null : (
        <button type="button" className="nl-btn" onClick={() => setWantEmail(true)}>
          Subscribe
        </button>
      )}
      {!signedIn && !on && !locked && wantEmail && <GuestSubscribeForm letter={letter} />}
      {on && managing && (
        <ManageSlot
          letter={letter}
          onClose={() => setManaging(false)}
          onUnsubscribed={() => setOn(false)}
          signedIn={signedIn}
          premium={premium}
          initialFormat={initialFormat}
          supportedFormats={supportedFormats}
          sendTime={sendTime}
        />
      )}
    </>
  );
}
