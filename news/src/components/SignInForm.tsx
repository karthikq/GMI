"use client";

import { signIn as clientSignIn } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { signIn } from "@/app/actions";
import PasswordInput from "@/components/PasswordInput";

export default function SignInForm() {
  const [state, action, pending] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientError, setClientError] = useState<string>();

  useEffect(() => {
    if (!state?.ok) return;
    Promise.resolve()
      .then(() => clientSignIn("credentials", { email, password, redirect: false }))
      .then((result) => {
        if (result?.error) {
          setClientError("Incorrect email or password.");
        } else {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/");
        }
      })
      .catch(() => setClientError("Couldn't complete sign-in. Try again."));
  }, [state, email, password]);

  const busy = pending || (state?.ok === true && !clientError);
  const message = state?.ok === false ? state.message : clientError;

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {state?.errors?.email && <p className="field-error">{state.errors.email}</p>}
      </label>
      <label>
        <span>Password</span>
        <PasswordInput
          name="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {state?.errors?.password && <p className="field-error">{state.errors.password}</p>}
      </label>
      <button type="submit" className="button" disabled={busy} aria-busy={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {message && (
        <p className="form-note error" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
