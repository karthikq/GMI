import type { Metadata } from "next";
import { Suspense } from "react";
import NewsletterExplorer from "@/components/newsletters/NewsletterExplorer";
import { PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";
import { getTemplates } from "@/lib/deliveryEngine";
import { DESK_NEWSLETTERS, FLAGSHIP_NEWSLETTERS } from "@/lib/newsletters";
import { normalizeFormatList } from "@/lib/newsletterFormats";
import {
  fetchSubscriberFormats,
  fetchSubscriberLetters,
  fetchSubscriberSendTime,
} from "@/lib/queries";

export const metadata: Metadata = { title: "Newsletters" };

async function Letters() {
  const user = await getSessionUser();
  const [letterIds, formats, sendTime] = user
    ? await Promise.all([
        fetchSubscriberLetters(user.email),
        fetchSubscriberFormats(user.email),
        fetchSubscriberSendTime(user.email),
      ])
    : [[], {} as Record<string, string>, { time: null, timeZone: null }];
  const templates = await getTemplates().catch(() => []);
  const premium = user?.plan === "premium" || user?.plan === "premium-plus";
  // Which formats each newsletter's template enables — the picker only
  // offers those; letters without a template offer all eight.
  const supported = Object.fromEntries(
    templates.map((t) => [t.id, normalizeFormatList(t.formats)]),
  );

  return (
    <NewsletterExplorer
      flagships={FLAGSHIP_NEWSLETTERS}
      desks={DESK_NEWSLETTERS}
      subscribedIds={letterIds}
      formats={formats}
      supportedFormats={supported}
      sendTime={sendTime.time}
      signedIn={Boolean(user)}
      premium={premium}
    />
  );
}

export default function NewslettersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Letters />
    </Suspense>
  );
}
