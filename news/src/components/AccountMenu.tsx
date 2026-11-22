"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type AccountMenuProps = {
  name: string;
  email: string;
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
  const avatar = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={avatarClass} />
  ) : (
    <span className={`${avatarClass} topbar-initials`} aria-hidden="true">
      {name
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
          <div className="account-menu-head">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          <Link href="/profile" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            Your profile
          </Link>
          <a href="/auth/signout" className="account-menu-item" role="menuitem">
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}
