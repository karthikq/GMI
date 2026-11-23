import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EditProfileForm from "@/components/EditProfileForm";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  return (
    <section className="section-block edit-profile-page">
      <header className="page-head">
        <h1>Edit profile</h1>
        <p>Update your display name, photo and account details.</p>
      </header>
      <EditProfileForm
        name={user.name}
        dob={user.dob}
        gender={user.gender}
        country={user.country}
        state={user.state}
        avatar={user.avatar}
        picture={user.picture}
      />
    </section>
  );
}
