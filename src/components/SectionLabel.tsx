import { useRef, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap-init";
import { useReducedMotion } from "../lib/useReducedMotion";

// djb2 string hash → deterministic seed
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

// Seeded PRNG (simple LCG)
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateSparklinePath(seed: string): string {
  const rand = seededRandom(hashString(seed));
  const points = 5;
  const segments: string[] = [];

  const pts = Array.from({ length: points }, (_, i) => ({
    x: (i / (points - 1)) * 100,
    y: 1 + rand() * 6,
  }));

  segments.push(`M ${pts[0].x} ${pts[0].y}`);

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx1 = prev.x + (curr.x - prev.x) / 3;
    const cpx2 = prev.x + ((curr.x - prev.x) * 2) / 3;
    segments.push(
      `C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`
    );
  }

  return segments.join(" ");
}

export default function SectionLabel({
  children,
  className = "mb-20",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const reduced = useReducedMotion();
  const seed = typeof children === "string" ? children : "section";
  const d = useMemo(() => generateSparklinePath(seed), [seed]);

  useGSAP(() => {
    const path = pathRef.current;
    if (!path || reduced) return;

    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    gsap.to(path, {
      strokeDashoffset: 0,
      duration: 1.2,
      ease: "power2.out",
      scrollTrigger: {
        trigger: path,
        start: "top 85%",
        once: true,
      },
    });
  }, { dependencies: [reduced, d] });

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="text-xs font-medium tracking-[0.2em] uppercase text-orange whitespace-nowrap">
        {children}
      </span>
      <svg
        className="flex-1"
        width="100%"
        height="8"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          ref={pathRef}
          d={d}
          stroke="var(--color-line)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
