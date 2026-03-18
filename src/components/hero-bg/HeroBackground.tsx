import { useRef, type RefObject } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap } from "../../lib/gsap-init";
import { useIsMobile } from "../../lib/useIsMobile";
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
  const { isLowPower } = useIsMobile();

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

  // On mobile/tablet: show only static blobs (no particles, no geometry, no mouse-tracking)
  if (isLowPower) {
    return (
      <div
        ref={wrapperRef}
        className="absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Static gradient blobs — no animation, no mouse tracking */}
        <div className="absolute inset-0">
          <div
            className="absolute"
            style={{
              left: "65%", top: "15%", width: 580, height: 480,
              background: "radial-gradient(ellipse, rgba(217,119,87,0.65) 0%, rgba(232,160,138,0.3) 40%, transparent 70%)",
              filter: "blur(80px)", transform: "translate(-50%, -50%)",
              borderRadius: "50%",
            }}
          />
          <div
            className="absolute"
            style={{
              left: "18%", top: "45%", width: 500, height: 420,
              background: "radial-gradient(ellipse, rgba(232,160,138,0.65) 0%, rgba(240,237,229,0.3) 45%, transparent 70%)",
              filter: "blur(90px)", transform: "translate(-50%, -50%)",
              borderRadius: "50%",
            }}
          />
          <div
            className="absolute"
            style={{
              left: "50%", top: "70%", width: 600, height: 450,
              background: "radial-gradient(ellipse, rgba(240,237,229,0.6) 0%, rgba(250,249,245,0.3) 50%, transparent 70%)",
              filter: "blur(100px)", transform: "translate(-50%, -50%)",
              borderRadius: "50%",
            }}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-cream z-[1]" />
      </div>
    );
  }

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
