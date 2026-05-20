import type { WispState } from "@/lib/demoTypes";

const COLORS: Record<WispState, { main: string; wing: string; glow: string; core: string }> = {
  idle:       { main: "#e5e7eb", wing: "rgba(148,163,184,0.18)", glow: "rgba(103,232,249,0.16)", core: "#67e8f9" },
  checking:   { main: "#67e8f9", wing: "rgba(103,232,249,0.18)", glow: "rgba(103,232,249,0.22)", core: "#67e8f9" },
  blocked:    { main: "#ef4444", wing: "rgba(239,68,68,0.16)",   glow: "rgba(239,68,68,0.18)",  core: "#ef4444" },
  sandboxing: { main: "#67e8f9", wing: "rgba(103,232,249,0.18)", glow: "rgba(103,232,249,0.22)", core: "#67e8f9" },
  approved:   { main: "#10b981", wing: "rgba(16,185,129,0.16)",  glow: "rgba(16,185,129,0.18)", core: "#10b981" },
  rollback:   { main: "#f59e0b", wing: "rgba(245,158,11,0.16)",  glow: "rgba(245,158,11,0.18)", core: "#f59e0b" },
};

export function Mascot({ state, size = 80 }: { state: WispState; size?: number }) {
  const c = COLORS[state];
  const scale = size / 80;

  return (
    <div
      className={`inline-block select-none wisp-state-${state}`}
      style={{ width: size, height: size * 1.1 }}
    >
      <svg
        viewBox="0 0 80 88"
        width={80 * scale}
        height={88 * scale}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Antenna */}
        <line x1="44" y1="26" x2="55" y2="8" stroke={c.main} strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
        <circle cx="56" cy="7" r="3.5" fill={c.glow}/>
        <circle cx="56" cy="7" r="2" fill={c.main}/>

        {/* Left wing */}
        <path
          d="M 20,44 C 0,30 2,58 17,52"
          fill={c.wing}
          stroke={c.main}
          strokeWidth="1"
          opacity="0.8"
        />
        {/* Right wing */}
        <path
          d="M 60,44 C 80,30 78,58 63,52"
          fill={c.wing}
          stroke={c.main}
          strokeWidth="1"
          opacity="0.8"
        />

        {/* Body glow halo */}
        <ellipse cx="40" cy="52" rx="26" ry="25" fill={c.glow} opacity="0.14"/>
        {/* Body */}
        <ellipse cx="40" cy="52" rx="22" ry="22" fill="#080e1c" stroke={c.main} strokeWidth="1.5"/>

        {/* Eye socket */}
        <circle cx="40" cy="46" r="11" fill="#030810" stroke={c.main} strokeWidth="1.2" opacity="0.9"/>
        {/* Iris */}
        <circle cx="40" cy="46" r="7" fill={c.main} opacity="0.9"/>
        {/* Pupil */}
        <circle cx="40" cy="46" r="3.5" fill="#030810"/>
        {/* Reflection dot */}
        <circle cx="43.5" cy="43" r="2" fill="white" opacity="0.65"/>

        {/* Core glow */}
        <circle cx="40" cy="59" r="7" fill={c.glow}/>
        <circle cx="40" cy="59" r="4" fill={c.core} opacity="0.9"/>
        <circle cx="40" cy="59" r="2" fill="white" opacity="0.7"/>

        {/* Legs */}
        <rect x="32" y="72" width="5" height="10" rx="2.5" fill={c.main} opacity="0.75"/>
        <rect x="43" y="72" width="5" height="10" rx="2.5" fill={c.main} opacity="0.75"/>

        {/* Sandboxing particles (only visible in sandboxing state via opacity trick) */}
        {state === "sandboxing" && (
          <g>
            <circle className="orbit-particle" cx="40" cy="52" r="3" fill="#67e8f9" opacity="0.75"/>
            <circle className="orbit-particle" cx="40" cy="52" r="2" fill="#e5e7eb" opacity="0.6"/>
            <circle className="orbit-particle" cx="40" cy="52" r="2.5" fill="#94a3b8" opacity="0.55"/>
          </g>
        )}

        {/* Blocked X badge */}
        {state === "blocked" && (
          <g>
            <circle cx="62" cy="24" r="9" fill="#ef4444" opacity="0.9"/>
            <line x1="58" y1="20" x2="66" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="66" y1="20" x2="58" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </g>
        )}

        {/* Approved check badge */}
        {state === "approved" && (
          <g>
            <circle cx="62" cy="24" r="9" fill="#10b981" opacity="0.9"/>
            <polyline points="57,24 61,28 67,20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>
        )}
      </svg>
    </div>
  );
}
