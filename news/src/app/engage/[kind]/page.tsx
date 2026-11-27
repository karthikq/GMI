import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { collections, connect } from "@/lib/db";
import { getTemplates } from "@/lib/deliveryEngine";

export const metadata: Metadata = { title: "Newsletter poll" };

// Landing page for the poll/quiz links inside newsletter emails (mainly the
// Reader's Edition). Email never runs scripts or forms, so each option is a
// link here; the choice is recorded as an engagement and a plain
// confirmation/thank-you is shown.
export default function EngagePage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense>
      <EngageResult params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EngageResult({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind } = await params;
  const query = await searchParams;
  if (kind !== "poll" && kind !== "quiz") notFound();

  const letterId = String(query.l ?? "");
  const option = Number(String(query.o ?? ""));
  const template = (await getTemplates()).find((t) => t.id === letterId);
  const pair = template?.content?.[kind] as
    | { question: string; options: string[]; answer?: number }
    | undefined;

  if (!template || !pair || !Number.isInteger(option) || option < 0 || option >= pair.options.length) {
    notFound();
  }

  const label = pair.options[option];
  const correct = kind === "quiz" && pair.answer != null ? option === pair.answer : undefined;

  await connect();
  await collections.engagements
    .insertOne({
      kind,
      letterId,
      question: pair.question,
      option,
      label,
      ...(correct !== undefined ? { correct } : {}),
      at: new Date(),
    })
    .catch(() => {});

  return (
    <div className="page-body" style={{ maxWidth: 640, margin: "0 auto", padding: "60px 20px" }}>
      <p className="kicker">{kind === "poll" ? "Reader poll" : "Daily quiz"}</p>
      <h1>{pair.question}</h1>
      <p style={{ fontSize: 16, lineHeight: 1.6 }}>
        You picked <strong>{label}</strong>.
        {correct === true && " Correct — well spotted."}
        {correct === false &&
          ` Not quite — the answer was ${pair.answer != null ? pair.options[pair.answer] : "another option"}.`}
      </p>
      <p style={{ fontSize: 14, color: "var(--ink-soft, #4a5059)" }}>
        Thanks — your {kind === "poll" ? "vote" : "answer"} counts toward{" "}
        <strong>{template.name}</strong> reader results in a future edition.
      </p>
      <p style={{ marginTop: 24 }}>
        <Link href="/newsletters" className="button outline">
          Manage your newsletters
        </Link>
      </p>
    </div>
  );
}

