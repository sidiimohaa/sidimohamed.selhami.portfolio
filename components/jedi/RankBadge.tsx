import type { RankId } from "../jediProgression";

// Original emblems for the five ranks, drawn as line art so they glow like holograms.
const emblems: Record<RankId, React.ReactNode> = {
  initiate: (
    <>
      <circle cx="32" cy="32" r="20" />
      <path d="M32 22 L38 32 L32 42 L26 32 Z" />
    </>
  ),
  padawan: (
    <>
      <circle cx="32" cy="32" r="21" />
      <path d="M32 12 V48" />
      <path d="M32 30 C25 30 20 26 17 20 M32 30 C39 30 44 26 47 20" />
      <circle cx="32" cy="50" r="2.5" />
    </>
  ),
  knight: (
    <>
      <circle cx="32" cy="32" r="22" />
      <circle cx="32" cy="32" r="15" opacity="0.55" />
      <path d="M32 8 V56" />
      <path d="M22 44 L32 34 L42 44" />
      <path d="M18 24 C24 26 28 29 32 34 C36 29 40 26 46 24" />
    </>
  ),
  master: (
    <>
      <circle cx="32" cy="32" r="23" />
      <path d="M32 9 L35 27 L53 32 L35 37 L32 55 L29 37 L11 32 L29 27 Z" />
      <path d="M14 18 C22 22 26 24 32 30 C38 24 42 22 50 18" opacity="0.7" />
      <circle cx="32" cy="32" r="5" />
    </>
  ),
  chosen: (
    <>
      <circle cx="32" cy="32" r="24" />
      <circle cx="32" cy="32" r="18" opacity="0.6" />
      <path d="M32 14 A18 18 0 0 1 32 50 A9 9 0 0 1 32 32 A9 9 0 0 0 32 14 Z" className="rank-badge-light" />
      <path d="M32 4 V12 M32 52 V60 M4 32 H12 M52 32 H60 M12 12 L18 18 M46 46 L52 52 M52 12 L46 18 M12 52 L18 46" />
    </>
  ),
};

export function RankBadge({ rank, size = 56, label }: { rank: RankId; size?: number; label?: string }) {
  return (
    <svg
      className={`rank-badge rank-${rank}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {emblems[rank]}
    </svg>
  );
}

// Small line icons for the missions.
const icons: Record<string, React.ReactNode> = {
  dark: <path d="M12 3 L14 9 L20 9 L15 13 L17 20 L12 16 L7 20 L9 13 L4 9 L10 9 Z" />,
  stars: <path d="M3 12 H9 M15 12 H21 M12 3 V9 M12 15 V21 M6 6 L9 9 M15 15 L18 18 M18 6 L15 9 M9 15 L6 18" />,
  droid: (
    <>
      <path d="M7 11 A5 5 0 0 1 17 11 Z" />
      <path d="M7 11 V18 H17 V11 M5 13 V20 M19 13 V20" />
      <circle cx="11" cy="8.5" r="1" />
    </>
  ),
  archive: <path d="M4 5 H20 V9 H4 Z M5 9 V19 H19 V9 M10 13 H14" />,
  saber: <path d="M6 18 L17 7 M5 19 L7 17 M8 20 L4 16 M17 7 L20 4" />,
  holocron: <path d="M12 3 L20 8 V16 L12 21 L4 16 V8 Z M12 3 V21 M4 8 L20 16 M20 8 L4 16" />,
  map: <path d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z M9 4 V18 M15 6 V20" />,
  empire: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4 V9 M12 15 V20 M4 12 H9 M15 12 H20" />
    </>
  ),
  crystal: <path d="M12 2 L17 9 L12 22 L7 9 Z M7 9 H17" />,
  hologram: (
    <>
      <path d="M8 21 L12 15 L16 21 Z" />
      <circle cx="12" cy="7" r="3" />
      <path d="M8 13 C9 11 15 11 16 13" />
    </>
  ),
};

export function MissionIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {icons[icon]}
    </svg>
  );
}
