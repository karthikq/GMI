"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/actions";
import PasswordInput, { PasswordRules } from "@/components/PasswordInput";
import { PASSWORD_MAX } from "@/lib/passwordRules";

const EMPTY = { current: "", next: "", confirm: "" };

// Change-password section on the edit-profile page. Only rendered for
// accounts that have a local password (not Google-only sign-ins).
export default function ChangePasswordForm() {
  const [fields, setFields] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDone(false);
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const mismatch = Boolean(fields.confirm) && fields.confirm !== fields.next;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await changePassword(fields);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setFields(EMPTY);
      setDone(true);
    });
  };

  return (
    <form className="password-form" onSubmit={submit}>
      <div className="edit-profile-grid">
        <label className="cms-field wide" data-invalid={errors.current ? "" : undefined}>
          <span className="cms-label">Current password</span>
          <PasswordInput
            name="current"
            required
            autoComplete="current-password"
            value={fields.current}
            onChange={update}
          />
          {errors.current && <p className="field-error">{errors.current}</p>}
        </label>
        <label className="cms-field" data-invalid={errors.next ? "" : undefined}>
          <span className="cms-label">New password</span>
          <PasswordInput
            name="next"
            required
            minLength={8}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            value={fields.next}
            onChange={update}
          />
          {errors.next && <p className="field-error">{errors.next}</p>}
        </label>
        <label className="cms-field" data-invalid={mismatch || errors.confirm ? "" : undefined}>
          <span className="cms-label">Confirm new password</span>
          <PasswordInput
            name="confirm"
            required
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            value={fields.confirm}
            onChange={update}
          />
          {(mismatch || errors.confirm) && (
            <p className="field-error">{errors.confirm ?? "Passwords don’t match."}</p>
          )}
        </label>
        {fields.next && (
          <div className="wide">
            <PasswordRules password={fields.next} />
          </div>
        )}
      </div>
      <div className="password-form-actions">
        {errors.form && (
          <p className="form-note error" role="alert">
            {errors.form}
          </p>
        )}
        {done && (
          <p className="form-note ok" role="status">
            Password updated.
          </p>
        )}
        <button type="submit" className="button" disabled={pending || mismatch}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
