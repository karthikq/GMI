"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function Modal({
  children,
  label,
  onClose,
  size = "default",
}: {
  children: React.ReactNode;
  label: string;
  // Route modals close via router.back(); in-page modals pass their own onClose.
  onClose?: () => void;
  size?: "default" | "wide";
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => (onClose ? onClose() : router.back());

  useEffect(() => {
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, router]);

  return (
    <div className="modal">
      <button
        type="button"
        className="modal-scrim"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
      />
      <div
        className={`modal-panel${size === "wide" ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button
          ref={closeRef}
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={close}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
