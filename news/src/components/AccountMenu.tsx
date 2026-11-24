"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutUser } from "@/app/actions";
import AvatarImg from "./AvatarImg";

type AccountMenuProps = {
  name?: string;
  email?: string;
  image?: string;
  variant: "topbar" | "nav";
};

export default function AccountMenu({ name, email, image, variant }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const avatarClass = variant === "nav" ? "nav-avatar-img" : "topbar-avatar";
  const avatar =
    variant === "nav" && !name ? (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ) : image ? (
      <AvatarImg src={image} className={avatarClass} />
    ) : (
      <span className={`${avatarClass} topbar-initials`} aria-hidden="true">
        {(name ?? "")
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </span>
    );

  if (variant === "topbar") {
    return (
      <Link href="/profile" className="topbar-signin" aria-label="Your profile" title={name}>
        {avatar}
      </Link>
    );
  }

  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        className="nav-avatar"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {avatar}
      </button>
      {open && (
        <div className="account-menu-panel" role="menu">
          {name ? (
            <>
              <div className="account-menu-head">
                <strong>{name}</strong>
                <span>{email}</span>
              </div>
              <Link
                href="/profile"
                className="account-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                Your profile
              </Link>
              <form action={signOutUser}>
                <button type="submit" className="account-menu-item" role="menuitem">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="account-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
