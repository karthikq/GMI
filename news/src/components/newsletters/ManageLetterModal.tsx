"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { setNewsletter } from "@/app/actions";
import Modal from "@/components/Modal";
import NewsletterSampleModal from "@/components/NewsletterSampleModal";
import { EMAIL_FORMATS, type Newsletter } from "@/lib/newsletters";
import { GLOBAL_SEND_TIME } from "@/lib/scheduler";
import { CheckIcon } from "./icons";

// Manage view for a subscribed newsletter: description, the reader's chosen
// format (with preview + change), delivery details and unsubscribe. The
// format picker modal is reused for preview/change so the subscriber sees
// the exact same renderer the mailer uses.
export default function ManageLetterModal({
  letter,
  onClose,
  onUnsubscribed,
  signedIn,
  premium,
  initialFormat,
  supportedFormats,
  sendTime,
}: {
  letter: Newsletter;
  onClose: () => void;
  onUnsubscribed: () => void;
  signedIn: boolean;
  premium: boolean;
  initialFormat?: string;
  supportedFormats?: string[];
  sendTime?: string | null;
}) {
  const [formatModal, setFormatModal] = useState<"picker" | "preview" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const formatId = initialFormat ?? EMAIL_FORMATS[0].id;
  const formatName = EMAIL_FORMATS.find((item) => item.id === formatId)?.name ?? EMAIL_FORMATS[0].name;

  const unsubscribe = () =>
    startTransition(async () => {
      setError("");
      const result = await setNewsletter(letter.id, false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onUnsubscribed();
      onClose();
    });

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Format",
      value: (
        <>
          {formatName}
          <span className="nl-manage-inline">
            <button type="button" className="nl-link" onClick={() => setFormatModal("preview")}>
              Preview
            </button>
            <button type="button" className="nl-link" onClick={() => setFormatModal("picker")}>
              Change format
            </button>
          </span>
        </>
      ),
    },
    { label: "Delivery time", value: `${sendTime || GLOBAL_SEND_TIME} daily on scheduled days` },
    { label: "Frequency", value: letter.cadence },
  ];

  return createPortal(
    <>
      <Modal label={`${letter.name} — Manage`} onClose={onClose}>
        <div className="nl-manage">
          <p className="nl-manage-desc">{letter.blurb}</p>
          <dl className="nl-manage-rows">
            {rows.map((row) => (
              <div key={row.label} className="nl-manage-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          {error && (
            <p className="form-note error" role="alert">
              {error}
            </p>
          )}

          <div className="nl-manage-foot">
            {!confirm ? (
              <button type="button" className="nl-btn ghost" onClick={() => setConfirm(true)}>
                Unsubscribe
              </button>
            ) : (
              <span className="nl-manage-confirm">
                Unsubscribe from {letter.name}?
                <button type="button" className="nl-btn" onClick={unsubscribe} disabled={pending}>
                  {pending ? "Removing…" : "Yes, unsubscribe"}
                </button>
                <button type="button" className="nl-btn ghost" onClick={() => setConfirm(false)} disabled={pending}>
                  Keep it
                </button>
              </span>
            )}
            <span className="nl-manage-ok">
              <CheckIcon /> You&apos;re subscribed
            </span>
          </div>
        </div>
      </Modal>
      {formatModal && (
        <NewsletterSampleModal
          letter={letter}
          onClose={() => setFormatModal(null)}
          signedIn={signedIn}
          premium={premium}
          initialFormat={formatId}
          supportedFormats={supportedFormats}
          startInPreview={formatModal === "preview"}
        />
      )}
    </>,
    document.body,
  );
}
