import type { CSSProperties } from "react";

const COLORS = ["#c8102e", "#f39a1e", "#0f7a4d", "#1f6fb2", "#d9a11f", "#8a4baf"];

// Deterministic pseudo-random in [0,1) keyed on the piece index — keeps the
// render pure while still scattering the pieces.
function seeded(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// One-shot celebration burst for /subscribe?status=success — a pure CSS fall
// with pieces generated at render time, so there's nothing to hydrate.
export default function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 90 }, (_, i) => (
        <i
          key={i}
          style={
            {
              left: `${seeded(i, 1) * 100}%`,
              width: `${6 + seeded(i, 2) * 6}px`,
              height: `${9 + seeded(i, 3) * 9}px`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${seeded(i, 4) * 1.6}s`,
              animationDuration: `${2.4 + seeded(i, 5) * 2}s`,
              "--sway": `${(seeded(i, 6) - 0.5) * 180}px`,
              "--spin": `${540 + seeded(i, 7) * 540}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
