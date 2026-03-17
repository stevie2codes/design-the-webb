import { useRef, type RefObject } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap } from "../../lib/gsap-init";
import BlobLayer from "./BlobLayer";
import GeometryLayer from "./GeometryLayer";
import ParticleLayer from "./ParticleLayer";

interface HeroBackgroundProps {
  heroRef: RefObject<HTMLElement | null>;
  smoothMouseX: MotionValue<number>;
  smoothMouseY: MotionValue<number>;
}

export default function HeroBackground({ heroRef, smoothMouseX, smoothMouseY }: HeroBackgroundProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Static motionValue — GSAP handles scroll opacity on the wrapper,
  // sub-layers keep their Framer Motion mouse-reactive springs unchanged
  const staticY = useMotionValue(0);

  useGSAP(
    () => {
      if (!wrapperRef.current || !heroRef.current) return;

      gsap.to(wrapperRef.current, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "60% top",
          scrub: 1,
        },
      });
    },
    { dependencies: [heroRef] }
  );

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Layer 1 — Blobs (deepest) */}
      <BlobLayer
        smoothMouseX={smoothMouseX}
        smoothMouseY={smoothMouseY}
        parallaxY={staticY}
      />

      {/* Layer 2 — Geometry (middle) */}
      <GeometryLayer
        smoothMouseX={smoothMouseX}
        smoothMouseY={smoothMouseY}
        parallaxY={staticY}
      />

      {/* Layer 3 — Particles (nearest) */}
      <ParticleLayer
        smoothMouseX={smoothMouseX}
        smoothMouseY={smoothMouseY}
        parallaxY={staticY}
      />

      {/* Bottom fade to cream for seamless transition */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-cream z-[1]" />
    </div>
  );
}
