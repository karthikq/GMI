"use client";

import { useActionState } from "react";
import { subscribe } from "@/app/actions";

export default function SubscribeForm() {
  const [state, action, pending] = useActionState(subscribe, null);

  return (
    <form action={action} className="subscribe-form">
      <div className="subscribe-row">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
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
  );
}
