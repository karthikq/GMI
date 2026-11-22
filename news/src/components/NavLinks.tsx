"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import type { Section } from "@/lib/api";

export default function NavLinks({ sections }: { sections: Section[] }) {
  const pathname = usePathname();

  // On the home page, jump to the section's block instead of leaving the page.
  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (pathname !== "/") return;
    const target = document.getElementById(slug);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${slug}`);
  };

  return (
    <ul className="nav-links">
      {sections.map((section) => {
        const href = `/section/${section.slug}`;
        return (
          <li key={section.slug}>
            <Link
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={(event) => scrollToSection(event, section.slug)}
            >
              {section.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
