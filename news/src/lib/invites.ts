import { collections, connect } from "./db";

// If an unclaimed admin invitation exists for this email, assign its role and
// mark it used. Runs after every sign-in and sign-up, so an invitation works
// whether the person already has an account or registers later.
export async function claimInvite(email: string): Promise<void> {
  await connect();
  const invite = await collections.invites.findOneAndUpdate(
    { email, claimedAt: null },
    { $set: { claimedAt: new Date() } },
  );
  if (invite) {
    await collections.users.updateOne({ email }, { $set: { role: invite.role } });
  }
}
