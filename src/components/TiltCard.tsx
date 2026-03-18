import { useRef, useCallback } from "react";
import { useReducedMotion } from "../lib/useReducedMotion";
import { useIsMobile } from "../lib/useIsMobile";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  tiltStrength?: number;
}

export default function TiltCard({
  children,
  className,
  tiltStrength = 4,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { isLowPower } = useIsMobile();
  const disabled = reduced || isLowPower;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rotateX =
        ((e.clientY - centerY) / (rect.height / 2)) * tiltStrength;
      const rotateY =
        ((e.clientX - centerX) / (rect.width / 2)) * -tiltStrength;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    },
    [tiltStrength, disabled]
  );

  const handleMouseLeave = useCallback(() => {
    if (disabled) return;
    const card = cardRef.current;
    if (card) {
      card.style.transform =
        "perspective(800px) rotateX(0deg) rotateY(0deg)";
    }
  }, [disabled]);

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: "transform 300ms ease-out",
        willChange: disabled ? "auto" : "transform",
      }}
    >
      {children}
    </div>
  );
}
