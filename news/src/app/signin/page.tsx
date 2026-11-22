import type { Metadata } from "next";
import { Suspense } from "react";
import SignInCard from "@/components/SignInCard";

export const metadata: Metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<{ error?: string }>;
};

async function Form({ searchParams }: Props) {
  const { error } = await searchParams;
  const oauthError =
    error === "google"
      ? "Google sign-in didn't complete. Please try again."
      : undefined;
  return <SignInCard oauthError={oauthError} />;
}

export default function SignInPage(props: Props) {
  return (
    <Suspense>
      <Form {...props} />
    </Suspense>
  );
}
