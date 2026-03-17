import { motion, useTransform, type MotionValue } from "framer-motion";

interface BlobLayerProps {
  smoothMouseX: MotionValue<number>;
  smoothMouseY: MotionValue<number>;
  parallaxY: MotionValue<number>;
}

const BLOBS = [
  {
    // Top-right — warm orange glow (BOLD)
    cx: "65%", cy: "15%",
    w: 580, h: 480,
    gradient: "radial-gradient(ellipse, rgba(217,119,87,0.85) 0%, rgba(232,160,138,0.45) 40%, transparent 70%)",
    blur: 80,
    repelStrength: 18,
    morphDuration: 10,
    morphScale: [1, 1.12, 0.95, 1],
    morphRadius: ["50%", "45% 55% 50% 50%", "55% 45% 52% 48%", "50%"],
  },
  {
    // Center-left — soft peach (BOLD)
    cx: "18%", cy: "45%",
    w: 500, h: 420,
    gradient: "radial-gradient(ellipse, rgba(232,160,138,0.85) 0%, rgba(240,237,229,0.5) 45%, transparent 70%)",
    blur: 90,
    repelStrength: 15,
    morphDuration: 12,
    morphScale: [1, 0.9, 1.08, 1],
    morphRadius: ["50%", "52% 48% 45% 55%", "48% 52% 55% 45%", "50%"],
  },
  {
    // Bottom-center — warm cream cloud
    cx: "50%", cy: "70%",
    w: 600, h: 450,
    gradient: "radial-gradient(ellipse, rgba(240,237,229,0.8) 0%, rgba(250,249,245,0.4) 50%, transparent 70%)",
    blur: 100,
    repelStrength: 12,
    morphDuration: 14,
    morphScale: [1, 1.06, 0.92, 1],
    morphRadius: ["50%", "48% 52% 50% 50%", "50% 50% 48% 52%", "50%"],
  },
  {
    // Accent — deep orange, top-left (BOLD)
    cx: "10%", cy: "20%",
    w: 350, h: 280,
    gradient: "radial-gradient(ellipse, rgba(200,102,65,0.6) 0%, rgba(217,119,87,0.25) 45%, transparent 70%)",
    blur: 70,
    repelStrength: 20,
    morphDuration: 9,
    morphScale: [1, 1.15, 0.88, 1],
    morphRadius: ["50%", "55% 45% 48% 52%", "45% 55% 52% 48%", "50%"],
  },
];

export default function BlobLayer({ smoothMouseX, smoothMouseY, parallaxY }: BlobLayerProps) {
  const prefersReducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ y: parallaxY }}
      aria-hidden="true"
    >
      {BLOBS.map((blob, i) => {
        const repelX = useTransform(
          smoothMouseX,
          [0, 1],
          [blob.repelStrength, -blob.repelStrength]
        );
        const repelY = useTransform(
          smoothMouseY,
          [0, 1],
          [blob.repelStrength, -blob.repelStrength]
        );

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: blob.cx,
              top: blob.cy,
              width: blob.w,
              height: blob.h,
              background: blob.gradient,
              filter: `blur(${blob.blur}px)`,
              x: repelX,
              y: repelY,
              translateX: "-50%",
              translateY: "-50%",
            }}
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    scale: blob.morphScale,
                    borderRadius: blob.morphRadius,
                  }
            }
            transition={{
              duration: blob.morphDuration,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        );
      })}
    </motion.div>
  );
}
