"use client";

import type { Newsletter } from "@/lib/newsletters";
import { DeskIcon } from "./icons";
import { LetterAction, useLetterSubscription } from "./SubscribeControls";

// Compact flagship card: icon, serif title, two-line description, cadence
// and the shared subscribe/manage action. No taglines or decorative borders.
export default function LetterCompact({
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
  return (
    <article className={`nl-compact${sub.on ? " subscribed" : ""}`}>
      <div className="nl-compact-top">
        <span className="nl-icon">
          <DeskIcon id={letter.id} />
        </span>
        <span className="nl-cadence">{letter.cadence}</span>
      </div>
      <h3 className="nl-compact-name">{letter.name}</h3>
      <p className="nl-compact-blurb">{letter.blurb}</p>
      <div className="nl-compact-foot">
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
        {sub.error && (
          <p className="form-note error" role="status">
            {sub.error}
          </p>
        )}
      </div>
    </article>
  );
}
