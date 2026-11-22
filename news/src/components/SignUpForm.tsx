"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions";

export default function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, null);

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Username</span>
        <input
          type="text"
          name="username"
          required
          minLength={2}
          maxLength={20}
          pattern="[A-Za-z0-9_.]+"
          title="2–20 letters, numbers, dots or underscores"
          autoComplete="username"
        />
      </label>
      <label>
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>
      <label>
        <span>Password</span>
        <input type="password" name="password" required minLength={8} autoComplete="new-password" />
      </label>
      <label>
        <span>Confirm password</span>
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" />
      </label>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      {state && (
        <p className={state.ok ? "form-note ok" : "form-note error"} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
