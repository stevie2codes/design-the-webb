import { useRef, useCallback } from "react";
import { useReducedMotion } from "../lib/useReducedMotion";

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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduced) return;
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
    [tiltStrength, reduced]
  );

  const handleMouseLeave = useCallback(() => {
    if (reduced) return;
    const card = cardRef.current;
    if (card) {
      card.style.transform =
        "perspective(800px) rotateX(0deg) rotateY(0deg)";
    }
  }, [reduced]);

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: "transform 300ms ease-out",
        willChange: reduced ? "auto" : "transform",
      }}
    >
      {children}
    </div>
  );
}
