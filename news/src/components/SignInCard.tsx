"use client";

import { useState } from "react";
import ProviderButtons from "./ProviderButtons";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";

export default function SignInCard({ oauthError }: { oauthError?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const signingIn = mode === "signin";

  return (
    <section className="auth">
      <p className="kicker">Reader account</p>
      <h1>{signingIn ? "Sign in to Good Morning Indian" : "Create your account"}</h1>
      <p className="dek">Save stories, follow desks and manage your briefing.</p>
      {oauthError && (
        <p className="form-note error" role="alert">
          {oauthError}
        </p>
      )}
      {signingIn ? <SignInForm /> : <SignUpForm />}
      <div className="auth-divider">
        <span>or continue with</span>
      </div>
      <ProviderButtons />
      <p className="auth-foot">
        {signingIn ? (
          <>
            New here?{" "}
            <button type="button" onClick={() => setMode("signup")}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        )}
      </p>
    </section>
  );
}
