"use client";

import { signIn as clientSignIn } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { signUp } from "@/app/actions";

export default function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, null);
  // Controlled inputs keep everything the reader typed if validation fails.
  const [fields, setFields] = useState({ username: "", email: "", password: "", confirm: "" });
  const [clientError, setClientError] = useState<string>();
  const update = (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));

  useEffect(() => {
    if (!state?.ok) return;
    Promise.resolve()
      .then(() =>
        clientSignIn("credentials", {
          email: fields.email,
          password: fields.password,
          redirect: false,
        }),
      )
      .then((result) => {
        if (result?.error) {
          setClientError("Account created — sign in to continue.");
        } else {
          // Hard navigation: a soft route change can keep the intercepted
          // sign-in modal mounted and wouldn't pick up the new session cookie.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/");
        }
      })
      .catch(() => setClientError("Account created — sign in to continue."));
  }, [state, fields]);

  const busy = pending || (state?.ok === true && !clientError);
  const message = state?.ok === false ? state.message : clientError;

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
          value={fields.username}
          onChange={update}
        />
        {state?.errors?.username && <p className="field-error">{state.errors.username}</p>}
      </label>
      <label>
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={fields.email}
          onChange={update}
        />
        {state?.errors?.email && <p className="field-error">{state.errors.email}</p>}
      </label>
      <label>
        <span>Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={fields.password}
          onChange={update}
        />
        {state?.errors?.password && <p className="field-error">{state.errors.password}</p>}
      </label>
      <label>
        <span>Confirm password</span>
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          value={fields.confirm}
          onChange={update}
        />
        {state?.errors?.confirm && <p className="field-error">{state.errors.confirm}</p>}
      </label>
      <button type="submit" className="button" disabled={busy} aria-busy={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? "Creating account…" : "Create account"}
      </button>
      {message && (
        <p className="form-note error" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
