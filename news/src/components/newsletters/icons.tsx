// Small stroke icons for newsletter/desk rows. Deterministic per desk slug,
// with a generic newspaper fallback. Pure SVG — no icon dependency.

function I({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const PATHS: Record<string, React.ReactNode> = {
  politics: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V10l7-6 7 6v11" />
      <path d="M9 21v-6h6v6" />
      <path d="M12 4v3" />
    </>
  ),
  business: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20v-7" />
      <path d="M11 20V9" />
      <path d="M16 20v-4" />
      <path d="M21 20V5" />
    </>
  ),
  economy: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20v-7" />
      <path d="M11 20V9" />
      <path d="M16 20v-4" />
      <path d="M21 20V5" />
    </>
  ),
  science: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v5L5 19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2L14 8V3" />
      <path d="M8 15h8" />
    </>
  ),
  sports: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
    </>
  ),
  entertainment: (
    <>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9Z" />
      <path d="M13 7v10" />
    </>
  ),
  culture: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12a4 4 0 1 1 8 0c0 1.5-1 2.5-2 3l-2 5-2-5c-1-.5-2-1.5-2-3Z" />
    </>
  ),
  lifestyle: (
    <>
      <path d="M5 8h11v7a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Z" />
      <path d="M16 9h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 5c0-1 .7-1.5.7-1.5M11 5c0-1 .7-1.5.7-1.5" />
    </>
  ),
  health: (
    <>
      <path d="M20 13c0 5-8 9-8 9s-8-4-8-9a4.5 4.5 0 0 1 8-3.5A4.5 4.5 0 0 1 20 13Z" />
      <path d="M6 12h3l2-3 2 5 2-2h3" />
    </>
  ),
  education: (
    <>
      <path d="m12 4 10 5-10 5L2 9l10-5Z" />
      <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
      <path d="M22 9v5" />
    </>
  ),
  environment: (
    <>
      <path d="M5 19c0-9 5-14 15-15-1 10-6 15-15 15Z" />
      <path d="M5 19c3-5 7-8 11-9" />
    </>
  ),
  travel: (
    <>
      <path d="m2 12 20-8-8 20-2.5-8.5L2 12Z" />
      <path d="M11.5 15.5 22 4" />
    </>
  ),
  automobile: (
    <>
      <path d="M5 16l1.5-6A2 2 0 0 1 8.5 8h7a2 2 0 0 1 2 2L19 16" />
      <rect x="4" y="16" width="16" height="3" rx="1" />
      <circle cx="8" cy="19" r="1.5" />
      <circle cx="16" cy="19" r="1.5" />
    </>
  ),
  gaming: (
    <>
      <rect x="3" y="8" width="18" height="9" rx="4.5" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="15.5" cy="11.5" r=".8" />
      <circle cx="17.5" cy="13.5" r=".8" />
    </>
  ),
  opinion: (
    <>
      <path d="M4 20h16" />
      <path d="M14 4l6 6-9.5 9.5H4.5V13.5L14 4Z" />
      <path d="M12.5 5.5l6 6" />
    </>
  ),
  "in-pictures": (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="m8 6 2-3h4l2 3" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  briefing: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  pulse: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </>
  ),
  markets: (
    <>
      <path d="M3 17l6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </>
  ),
  world: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.7 2.6 4 5.6 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.6-4-9s1.3-6.4 4-9Z" />
    </>
  ),
  weekend: (
    <>
      <path d="M2 6h20v14H2z" />
      <path d="M8 6c0 5 3 8 8 8h6" />
      <path d="M6 10h2M6 14h2" />
    </>
  ),
  india: (
    <>
      <path d="M12 3l7 8a7 7 0 1 1-14 0l7-8Z" />
      <path d="M9.5 11.5h5M12 9v5" />
    </>
  ),
};

const FALLBACK = (
  <>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </>
);

export function DeskIcon({ id, size = 18 }: { id: string; size?: number }) {
  return <I size={size}>{PATHS[id] ?? FALLBACK}</I>;
}

export function MailIcon({ size = 14 }: { size?: number }) {
  return (
    <I size={size}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </I>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <I size={size}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </I>
  );
}

export function GearIcon({ size = 15 }: { size?: number }) {
  return (
    <I size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.07.62.63 1.1 1.26 1.1H21a2 2 0 1 1 0 4h-.09c-.63 0-1.19.36-1.51.9Z" />
    </I>
  );
}

export function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <I size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </I>
  );
}

export function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <I size={size}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </I>
  );
}
