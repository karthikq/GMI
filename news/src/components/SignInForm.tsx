"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";

export default function SignInForm() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Email</span>
        <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />
      </label>
      <label>
        <span>Password</span>
        <input type="password" name="password" required minLength={8} autoComplete="current-password" />
      </label>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state && (
        <p className={state.ok ? "form-note ok" : "form-note error"} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
