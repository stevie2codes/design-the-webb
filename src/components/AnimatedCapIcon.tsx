import { useState } from "react";
import { useReducedMotion } from "../lib/useReducedMotion";

type IconName = "layers" | "barChart" | "compass" | "penTool";

interface AnimatedCapIconProps {
  name: IconName;
  isInView?: boolean;
  className?: string;
}

export default function AnimatedCapIcon({
  name,
  isInView = false,
  className = "",
}: AnimatedCapIconProps) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();

  const active = reduced ? false : hovered || isInView;

  return (
    <div
      className={`w-10 h-10 ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6 text-orange"
      >
        {name === "layers" && <LayersIcon active={active} />}
        {name === "barChart" && <BarChartIcon active={active} />}
        {name === "compass" && <CompassIcon active={active} />}
        {name === "penTool" && <PenToolIcon active={active} />}
      </svg>
    </div>
  );
}

/* ── Layers: 3 horizontal lines that spread vertically on hover ── */
function LayersIcon({ active }: { active: boolean }) {
  const offset = active ? 2 : 0;
  return (
    <g>
      <g style={{ transition: "transform 400ms ease-out", transform: `translateY(${-offset}px)` }}>
        <line x1="2" y1="8" x2="22" y2="8" />
      </g>
      <line x1="2" y1="12" x2="22" y2="12" />
      <g style={{ transition: "transform 400ms ease-out", transform: `translateY(${offset}px)` }}>
        <line x1="2" y1="16" x2="22" y2="16" />
      </g>
    </g>
  );
}

/* ── BarChart: 3 bars that grow from bottom on hover ── */
function BarChartIcon({ active }: { active: boolean }) {
  const scales = active ? [0.6, 1, 0.75] : [0, 0, 0];
  return (
    <g>
      {[
        { x: 4, scale: scales[0], delay: "0ms" },
        { x: 10, scale: scales[1], delay: "80ms" },
        { x: 16, scale: scales[2], delay: "160ms" },
      ].map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={6}
          width="4"
          height="16"
          rx="1"
          fill="currentColor"
          stroke="none"
          style={{
            transformOrigin: `${bar.x + 2}px 22px`,
            transition: `transform 400ms ease-out ${bar.delay}`,
            transform: `scaleY(${bar.scale})`,
          }}
        />
      ))}
      <line x1="2" y1="22" x2="22" y2="22" />
    </g>
  );
}

/* ── Compass: needle rotates 360deg on hover ── */
function CompassIcon({ active }: { active: boolean }) {
  return (
    <g
      style={{
        transformOrigin: "12px 12px",
        transition: active ? "transform 600ms ease-out" : "none",
        transform: active ? "rotate(360deg)" : "rotate(0deg)",
      }}
    >
      <circle cx="12" cy="12" r="10" />
      <polygon
        points="12,2 15,12 12,14 9,12"
        fill="currentColor"
        stroke="none"
      />
    </g>
  );
}

/* ── PenTool: stroke draws in via dashoffset on hover ── */
function PenToolIcon({ active }: { active: boolean }) {
  const pathLength = 80;
  return (
    <path
      d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586"
      strokeDasharray={pathLength}
      strokeDashoffset={active ? 0 : pathLength}
      style={{
        transition: "stroke-dashoffset 500ms ease-out",
      }}
    />
  );
}
