"use client";

import { useState } from "react";

const targets = {
  x: (url: string, title: string) => `https://x.com/intent/post?url=${url}&text=${title}`,
  facebook: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
};

export default function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = (network: keyof typeof targets) => {
    const url = encodeURIComponent(window.location.href);
    window.open(targets[network](url, encodeURIComponent(title)), "_blank", "noopener,noreferrer,width=600,height=540");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused; the button simply stays as it was.
    }
  };

  return (
    <div className="share">
      <button type="button" aria-label="Share on X" onClick={() => share("x")}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          />
        </svg>
      </button>
      <button type="button" aria-label="Share on Facebook" onClick={() => share("facebook")}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21z" />
        </svg>
      </button>
      <button
        type="button"
        className={copied ? "copied" : undefined}
        aria-label={copied ? "Link copied" : "Copy link"}
        onClick={copy}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
