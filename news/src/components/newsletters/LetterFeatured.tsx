"use client";

import type { Newsletter } from "@/lib/newsletters";
import { DeskIcon } from "./icons";
import { LetterAction, useLetterSubscription } from "./SubscribeControls";

// Small wireframe illustration of the edition — a decorative mock of the
// Morning Briefing's masthead, a lead line and three story rows.
function PreviewIllustration() {
  return (
    <div className="nl-illus" aria-hidden="true">
      <svg viewBox="0 0 220 150" role="presentation">
        <rect x="0" y="0" width="220" height="150" rx="4" fill="var(--surface, #fff)" stroke="var(--line, #dcdad3)" />
        <rect x="0" y="0" width="220" height="26" rx="4" fill="var(--panel, #14171c)" />
        <rect x="62" y="9" width="96" height="8" rx="2" fill="#f5f4f0" />
        <rect x="12" y="38" width="120" height="10" rx="2" fill="var(--ink, #14171c)" />
        <rect x="12" y="54" width="196" height="6" rx="2" fill="var(--line, #dcdad3)" />
        <rect x="12" y="64" width="160" height="6" rx="2" fill="var(--line, #dcdad3)" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={12} y={82 + i * 20} width="14" height="10" rx="2" fill="var(--accent, #c8102e)" opacity={0.85} />
            <rect x={32} y={82 + i * 20} width="150" height="7" rx="2" fill="var(--ink-soft, #4a5059)" opacity={0.55} />
            <rect x={32} y={91 + i * 20} width="110" height="5" rx="2" fill="var(--line, #dcdad3)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// The Morning Briefing as a horizontal feature card — the only newsletter
// that gets this layout; the rest of the flagship set uses LetterCompact.
export default function LetterFeatured({
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
    <article className={`nl-feature${sub.on ? " subscribed" : ""}`}>
      <div className="nl-feature-main">
        <div className="nl-feature-meta">
          <span className="nl-icon">
            <DeskIcon id={letter.id} />
          </span>
          <span className="nl-cadence">{letter.cadence}</span>
          <span className={`nl-tier${letter.premium ? "" : " free"}`}>
            {letter.premium ? "Premium" : "Free"}
          </span>
        </div>
        <h3 className="nl-feature-name">{letter.name}</h3>
        <p className="nl-feature-blurb">{letter.blurb}</p>
        {sub.error && (
          <p className="form-note error" role="status">
            {sub.error}
          </p>
        )}
      </div>
      <div className="nl-feature-side">
        <PreviewIllustration />
        <div className="nl-feature-actions">
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
      </div>
    </article>
  );
}
