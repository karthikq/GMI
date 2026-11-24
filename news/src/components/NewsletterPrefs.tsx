"use client";

import { useState } from "react";
import { setNewsletter } from "@/app/actions";

export type NewsletterPref = {
  id: string;
  name: string;
  blurb: string;
  on: boolean;
};

// Checkbox list of newsletters on the profile page. Signed-in readers toggle
// live (saved against their email); the sample guest view is read-only.
export default function NewsletterPrefs({
  items,
  editable,
}: {
  items: NewsletterPref[];
  editable: boolean;
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
      {items.map((item) => (
        <li key={item.id}>
          <label>
            <input
              type="checkbox"
              checked={on[item.id] ?? false}
              disabled={!editable}
              onChange={(event) => toggle(item.id, event.target.checked)}
            />
            <span>
              <strong>{item.name}</strong>
              {item.blurb}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
