import { useRef, useCallback } from "react";
import { gsap } from "../lib/gsap-init";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

/**
 * Magnetic hover wrapper — tracks mouse position relative to element center,
 * translates element toward cursor (max displacement: strength px).
 * Springs back on mouse leave with elastic easing.
 * Disabled on touch devices (no hover capability).
 */
export default function MagneticButton({
  children,
  className,
  strength = 8,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Check for hover capability (disables on touch-only devices)
  const supportsHover =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!supportsHover || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) / (rect.width / 2);
      const dy = (e.clientY - centerY) / (rect.height / 2);

      gsap.to(ref.current, {
        x: dx * strength,
        y: dy * strength,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    [strength, supportsHover]
  );

  const handleMouseLeave = useCallback(() => {
    if (!supportsHover || !ref.current) return;
    gsap.to(ref.current, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.4)",
    });
  }, [supportsHover]);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ display: "inline-block" }}
    >
      {children}
    </div>
  );
}
