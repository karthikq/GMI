"use client";

import { useMemo, useState } from "react";
import GlobalSendTime from "@/components/GlobalSendTime";
import type { Newsletter } from "@/lib/newsletters";
import { GLOBAL_SEND_TIME } from "@/lib/scheduler";
import DeskRow from "./DeskRow";
import LetterCompact from "./LetterCompact";
import LetterFeatured from "./LetterFeatured";
import { GearIcon, LockIcon, SearchIcon } from "./icons";

type Tab = "all" | "mine" | "desk";

// Compact delivery-preferences row in the header — the saved time at a
// glance, with a settings toggle opening the existing GlobalSendTime editor.
function DeliveryPrefs({
  sendTime,
  signedIn,
}: {
  sendTime: string | null;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const effective = sendTime || GLOBAL_SEND_TIME;
  return (
    <div className="nl-prefs">
      <span className="nl-prefs-summary">
        Delivered at <strong>{effective}</strong> on each newsletter&apos;s scheduled day
      </span>
      {signedIn && (
        <button
          type="button"
          className="nl-prefs-gear"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Manage delivery preferences"
        >
          <GearIcon />
          Delivery settings
        </button>
      )}
      {open && signedIn && (
        <div className="nl-prefs-panel">
          <GlobalSendTime initialTime={sendTime} signedIn={signedIn} />
        </div>
      )}
    </div>
  );
}

export default function NewsletterExplorer({
  flagships,
  desks,
  subscribedIds,
  formats,
  supportedFormats,
  sendTime,
  signedIn,
  premium,
}: {
  flagships: Newsletter[];
  desks: Newsletter[];
  subscribedIds: string[];
  formats: Record<string, string>;
  supportedFormats: Record<string, string[]>;
  sendTime: string | null;
  signedIn: boolean;
  premium: boolean;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [subs, setSubs] = useState<Set<string>>(new Set(subscribedIds));

  const shared = useMemo(
    () => ({ signedIn, premium, sendTime }),
    [signedIn, premium, sendTime],
  );
  const markSubscribed = (letterId: string, on: boolean) =>
    setSubs((current) => {
      const next = new Set(current);
      if (on) next.add(letterId);
      else next.delete(letterId);
      return next;
    });

  const propsFor = (letter: Newsletter) => ({
    letter,
    subscribed: subs.has(letter.id),
    ...shared,
    initialFormat: formats[letter.id],
    supportedFormats: supportedFormats[letter.id],
    onChange: (on: boolean) => markSubscribed(letter.id, on),
  });

  const featured = flagships.find((letter) => letter.featured) ?? flagships[0];
  const compactFlagships = flagships.filter((letter) => letter !== featured);
  const subFlagships = flagships.filter((letter) => subs.has(letter.id));
  const subDesks = desks.filter((letter) => subs.has(letter.id));

  const needle = query.trim().toLowerCase();
  const visibleDesks = needle
    ? desks.filter(
        (letter) =>
          letter.name.toLowerCase().includes(needle) ||
          letter.topics.some((topic) => topic.toLowerCase().includes(needle)) ||
          letter.blurb.toLowerCase().includes(needle),
      )
    : desks;
  const mineDesks = needle ? visibleDesks.filter((letter) => subs.has(letter.id)) : subDesks;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "all", label: "All newsletters", count: flagships.length + desks.length },
    { id: "mine", label: "My subscriptions", count: subs.size },
    { id: "desk", label: "Desk editions", count: desks.length },
  ];

  const deskSection = (list: Newsletter[]) => (
    <section className="nl-section">
      <div className="nl-section-head">
        <h2>Desk editions</h2>
        <div className="nl-section-tools">
          {desks.every((letter) => letter.premium) && (
            <span className="nl-tier">
              <LockIcon size={11} /> Included with Premium
            </span>
          )}
          <label className="nl-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              placeholder="Search desks"
              aria-label="Search desk newsletters"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      </div>
      {list.length ? (
        <div className="nl-desk-list">
          {list.map((letter) => (
            <DeskRow key={letter.id} {...propsFor(letter)} />
          ))}
        </div>
      ) : (
        <p className="nl-empty">
          {needle
            ? `No desk editions match “${query}”.`
            : "No desk newsletters yet — check back soon."}
        </p>
      )}
    </section>
  );

  return (
    <>
      <header className="nl-head">
        <h1 className="nl-title">Newsletters</h1>
        <p className="nl-lede">
          Daily and weekly editions from our desks, straight to your inbox.
        </p>
        <DeliveryPrefs sendTime={sendTime} signedIn={signedIn} />
      </header>

      <nav className="nl-tabs" aria-label="Newsletter views">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nl-tab${tab === item.id ? " active" : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.count !== undefined && <span className="nl-tab-count">{item.count}</span>}
          </button>
        ))}
      </nav>

      {tab !== "desk" && tab !== "mine" && (
        <>
          <LetterFeatured {...propsFor(featured)} />
          <section className="nl-section">
            <div className="nl-section-head">
              <h2>Flagship editions</h2>
            </div>
            <div className="nl-compact-grid">
              {compactFlagships.map((letter) => (
                <LetterCompact key={letter.id} {...propsFor(letter)} />
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "mine" &&
        (subs.size ? (
          <>
            {subFlagships.length > 0 && (
              <section className="nl-section">
                <div className="nl-section-head">
                  <h2>Flagship editions</h2>
                </div>
                <div className="nl-compact-grid">
                  {subFlagships.map((letter) => (
                    <LetterCompact key={letter.id} {...propsFor(letter)} />
                  ))}
                </div>
              </section>
            )}
            {deskSection(mineDesks)}
          </>
        ) : (
          <div className="nl-empty nl-empty-block">
            <p>
              You haven&apos;t subscribed to any newsletters yet.
              {signedIn ? " Pick one from All newsletters." : " Sign in to manage your picks."}
            </p>
            <button type="button" className="nl-btn" onClick={() => setTab("all")}>
              Browse newsletters
            </button>
          </div>
        ))}

      {tab !== "mine" && deskSection(visibleDesks)}
    </>
  );
}
