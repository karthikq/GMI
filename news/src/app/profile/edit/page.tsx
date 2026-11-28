import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import EditProfileForm from "@/components/EditProfileForm";
import { PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit profile" };

async function EditProfileContent() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  return (
    <>
      <EditProfileForm
        name={user.name}
        dob={user.dob}
        gender={user.gender}
        country={user.country}
        state={user.state}
        bio={user.bio}
        avatar={user.avatar}
        picture={user.picture}
      />
      <section className="password-card">
        <h2>Change password</h2>
        {user.hasPassword ? (
          <ChangePasswordForm />
        ) : (
          <p className="password-provider">
            Your credentials are saved with your auth provider
            {user.googleId ? " (Google)" : ""}. To change your password, manage it from your{" "}
            {user.googleId ? "Google account" : "sign-in provider"}.
          </p>
        )}
      </section>
    </>
  );
}

export default function EditProfilePage() {
  return (
    <section className="section-block edit-profile-page">
      <header className="page-head">
        <h1>Edit profile</h1>
        <p>Update your display name, photo and account details.</p>
      </header>
      <Suspense fallback={<PageSkeleton />}>
        <EditProfileContent />
      </Suspense>
    </section>
  );
}
