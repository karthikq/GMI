"use client";

import Link from "next/link";
import { useState } from "react";
import { setNewsletter } from "@/app/actions";

export type NewsletterPref = {
  id: string;
  name: string;
  blurb: string;
  on: boolean;
  premium?: boolean;
};

// Checkbox list of newsletters on the profile page. Signed-in readers toggle
// live (saved against their email); the sample guest view is read-only.
// Premium (desk) editions stay locked until the reader is on a paid plan,
// unless they're already subscribed — so a lapsed plan can still unsubscribe.
export default function NewsletterPrefs({
  items,
  editable,
  premium,
}: {
  items: NewsletterPref[];
  editable: boolean;
  premium: boolean;
}) {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.on])),
  );

  const toggle = async (id: string, checked: boolean) => {
    setOn((prev) => ({ ...prev, [id]: checked }));
    const result = await setNewsletter(id, checked);
    if ("error" in result) {
      setOn((prev) => ({ ...prev, [id]: !checked }));
    }
  };

  return (
    <ul className="profile-prefs">
      {items.map((item) => {
        const locked = Boolean(item.premium) && !premium && !(on[item.id] ?? false);
        return (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={on[item.id] ?? false}
                disabled={!editable || locked}
                onChange={(event) => toggle(item.id, event.target.checked)}
              />
              <span>
                <strong>
                  {item.name}
                  {item.premium && <em className="letter-tag">Premium</em>}
                </strong>
                {item.blurb}
                {locked && (
                  <Link href="/subscribe" className="pref-upgrade">
                    Upgrade to subscribe
                  </Link>
                )}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
