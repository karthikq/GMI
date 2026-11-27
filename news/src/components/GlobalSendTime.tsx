"use client";

import { useState, useSyncExternalStore } from "react";
import { setGlobalSendTime } from "@/app/actions";
import { GLOBAL_SEND_TIME } from "@/lib/scheduler";

// The single delivery-time control on /newsletters: one time that applies to
// every newsletter, shown as "your editions arrive at X" in the reader's zone.
export default function GlobalSendTime({
  initialTime,
  signedIn,
}: {
  /** The reader's saved global time, or null when they use the default. */
  initialTime: string | null;
  signedIn: boolean;
}) {
  const [time, setTime] = useState(initialTime ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const zone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );

  const effective = time || GLOBAL_SEND_TIME;

  const pick = async (value: string) => {
    setTime(value);
    setError("");
    setBusy(true);
    const result = await setGlobalSendTime(
      value,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if ("error" in result) setError(result.error);
    setBusy(false);
  };

  if (!signedIn) {
    return (
      <p className="sendtime-note">
        Editions are delivered at {GLOBAL_SEND_TIME} on their scheduled day.
      </p>
    );
  }

  return (
    <div className="sendtime">
      <label className="sendtime-label">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        Delivered at
        <input
          type="time"
          value={effective}
          onChange={(event) => pick(event.target.value)}
          disabled={busy}
          aria-label="Delivery time for all newsletters"
        />
        {time && time !== GLOBAL_SEND_TIME && (
          <button
            type="button"
            className="letter-time-reset"
            onClick={() => pick("")}
            title={`Restore the default send time (${GLOBAL_SEND_TIME})`}
          >
            ↺ {GLOBAL_SEND_TIME}
          </button>
        )}
      </label>
      <p className="sendtime-note">
        All your newsletters arrive at {effective}
        {zone ? ` (${zone})` : ""} on their scheduled day.
      </p>
      {error && (
        <p className="form-note error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
