import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap-init";
import { useReducedMotion } from "../lib/useReducedMotion";

interface Stat {
  value: string;
  label: string;
  subtitle?: string;
}

interface StatsCounterProps {
  stats: Stat[];
  className?: string;
}

/**
 * Animated number counter on scroll trigger.
 * Numbers count from 0 to final value using gsap.to() with snap: 1.
 * Parses numeric part, animates, appends suffix (like "+").
 */
export default function StatsCounter({ stats, className }: StatsCounterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el || reduced) return;

      stats.forEach((stat, i) => {
        const valueEl = valueRefs.current[i];
        if (!valueEl) return;

        const match = stat.value.match(/^(\d+)(.*)$/);
        if (!match) return;

        const numericTarget = parseInt(match[1], 10);
        const suffix = match[2] || "";

        const proxy = { val: 0 };

        gsap.to(proxy, {
          val: numericTarget,
          duration: 1.5,
          delay: i * 0.15,
          ease: "power2.out",
          snap: { val: 1 },
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            once: true,
          },
          onUpdate: () => {
            valueEl.textContent = `${Math.round(proxy.val)}${suffix}`;
          },
        });
      });
    },
    { scope: containerRef, dependencies: [reduced] }
  );

  return (
    <div
      ref={containerRef}
      className={`grid grid-cols-2 md:grid-cols-4 gap-px bg-line rounded-2xl overflow-hidden ${className || ""}`}
    >
      {stats.map((stat, i) => (
        <div key={stat.label} className="bg-cream p-10 md:p-14 text-center">
          <div
            ref={(el) => {
              valueRefs.current[i] = el;
            }}
            className="font-display text-3xl md:text-4xl text-dark mb-3"
          >
            {stat.value}
          </div>
          <div className="text-xs tracking-wide text-muted uppercase">
            {stat.label}
          </div>
          {stat.subtitle && (
            <div className="text-[10px] text-muted/60 italic mt-1">
              {stat.subtitle}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
