import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap-init";
import { useReducedMotion } from "../lib/useReducedMotion";

interface GSAPRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  onEnter?: () => void;
}

/**
 * Clean scroll-triggered reveal for body text, cards, generic elements.
 * translateY(20px) + opacity: 0 → revealed.
 */
export default function GSAPReveal({
  children,
  className,
  delay = 0,
  stagger = 0.08,
  onEnter,
}: GSAPRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el || reduced) return;

      const targets =
        stagger > 0 && el.children.length > 1
          ? Array.from(el.children)
          : [el];

      gsap.from(targets, {
        y: 20,
        opacity: 0,
        duration: 0.6,
        delay,
        stagger: targets.length > 1 ? stagger : 0,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: onEnter,
        },
      });
    },
    { scope: containerRef, dependencies: [reduced] }
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
