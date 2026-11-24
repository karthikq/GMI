"use client";

import { useState } from "react";
import { PASSWORD_RULES } from "@/lib/passwordRules";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

// Password field with a show/hide toggle. Renders inside the caller's <label>.
export default function PasswordInput({ className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`password-input${className ? ` ${className}` : ""}`}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((value) => !value)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}

// Live checklist of the password rules, ticking each one as it's met.
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="password-rules" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={ok ? "ok" : undefined}>
            {rule.label}
            <span className="sr-only">{ok ? " (met)" : " (not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
