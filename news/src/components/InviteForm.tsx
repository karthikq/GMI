"use client";

import { useActionState } from "react";
import { inviteEditorial } from "@/app/actions";

// Admin-only form: invites a journalist, editor or admin by email. The role is
// granted the next time that address signs in or registers (see claimInvite).
export default function InviteForm() {
  const [state, action, pending] = useActionState(inviteEditorial, null);

  return (
    <form action={action} className="invite-form">
      <input
        type="email"
        name="email"
        required
        placeholder="colleague@example.com"
        aria-label="Email address"
      />
      <select name="role" defaultValue="journalist" aria-label="Role">
        <option value="journalist">Journalist</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Sending…" : "Invite"}
      </button>
      {state && (
        <p className={state.ok ? "form-note ok" : "form-note error"} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
