"use client";

import { useState } from "react";
import type { Newsletter } from "@/lib/newsletters";
import { DeskIcon } from "./icons";
import { LetterAction, useLetterSubscription } from "./SubscribeControls";

// One desk-edition row (~68px): icon, name, cadence, status and the shared
// subscribe/manage action. Expands for the blurb + topics on demand so the
// default list stays dense.
export default function DeskRow({
  letter,
  subscribed,
  signedIn,
  premium,
  initialFormat,
  supportedFormats,
  sendTime,
  onChange,
}: {
  letter: Newsletter;
  subscribed: boolean;
  signedIn: boolean;
  premium: boolean;
  initialFormat?: string;
  supportedFormats?: string[];
  sendTime?: string | null;
  onChange?: (on: boolean) => void;
}) {
  const sub = useLetterSubscription(letter, subscribed, onChange);
  const [open, setOpen] = useState(false);

  return (
    <div className={`nl-desk${sub.on ? " subscribed" : ""}${open ? " open" : ""}`}>
      <div className="nl-desk-row">
        <button
          type="button"
          className="nl-desk-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${letter.name} details`}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d={open ? "m6 14 6-6 6 6" : "m6 9 6 6 6-6"} />
          </svg>
        </button>
        <span className="nl-icon">
          <DeskIcon id={letter.id} />
        </span>
        <span className="nl-desk-name">{letter.name}</span>
        <span className="nl-cadence">{letter.cadence}</span>
        <LetterAction
          letter={letter}
          on={sub.on}
          setOn={sub.setOn}
          busy={sub.busy}
          toggle={sub.toggle}
          signedIn={signedIn}
          premium={premium}
          initialFormat={initialFormat}
          supportedFormats={supportedFormats}
          sendTime={sendTime}
        />
      </div>
      {sub.error && (
        <p className="form-note error nl-desk-error" role="status">
          {sub.error}
        </p>
      )}
      {open && (
        <div className="nl-desk-detail">
          <p>{letter.blurb}</p>
          <p className="nl-desk-topics">{letter.topics.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
