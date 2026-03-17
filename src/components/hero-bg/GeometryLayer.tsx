import { motion, useTransform, type MotionValue } from "framer-motion";

interface GeometryLayerProps {
  smoothMouseX: MotionValue<number>;
  smoothMouseY: MotionValue<number>;
  parallaxY: MotionValue<number>;
}

export default function GeometryLayer({ smoothMouseX, smoothMouseY, parallaxY }: GeometryLayerProps) {
  // Mouse follow — geometry drifts toward cursor
  const followX = useTransform(smoothMouseX, [0, 1], [-8, 8]);
  const followY = useTransform(smoothMouseY, [0, 1], [-8, 8]);

  const prefersReducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ y: parallaxY, x: followX }}
      aria-hidden="true"
    >
      <motion.svg
        className="w-full h-full"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        style={{ y: followY }}
      >
        {/* ── Circle outlines ── */}
        <motion.circle
          cx={280} cy={200} r={45}
          stroke="#d97757" strokeWidth={1.2} opacity={0.22}
          animate={prefersReducedMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          style={{ originX: "280px", originY: "200px" }}
        />
        <motion.circle
          cx={1100} cy={180} r={30}
          stroke="#e8a08a" strokeWidth={1} opacity={0.18}
          strokeDasharray="6 10"
          animate={prefersReducedMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          style={{ originX: "1100px", originY: "180px" }}
        />
        <motion.circle
          cx={750} cy={650} r={22}
          stroke="#8a8880" strokeWidth={0.8} opacity={0.15}
          animate={prefersReducedMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
          style={{ originX: "750px", originY: "650px" }}
        />

        {/* ── Rounded rectangles ── */}
        <motion.rect
          x={1150} y={480} width={60} height={38} rx={8}
          stroke="#c86641" strokeWidth={1} opacity={0.2}
          animate={prefersReducedMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 200, repeat: Infinity, ease: "linear" }}
          style={{ originX: "1180px", originY: "499px" }}
        />
        <motion.rect
          x={300} y={580} width={44} height={44} rx={10}
          stroke="#d97757" strokeWidth={0.8} opacity={0.16}
          animate={prefersReducedMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
          style={{ originX: "322px", originY: "602px" }}
        />

        {/* ── Dashed connection lines ── */}
        <motion.line
          x1={280} y1={200} x2={750} y2={650}
          stroke="#8a8880" strokeWidth={0.6} opacity={0.12}
          strokeDasharray="8 16"
          animate={prefersReducedMotion ? undefined : { strokeDashoffset: [0, -48] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <motion.line
          x1={1100} y1={180} x2={750} y2={650}
          stroke="#8a8880" strokeWidth={0.5} opacity={0.1}
          strokeDasharray="4 12"
          animate={prefersReducedMotion ? undefined : { strokeDashoffset: [0, -32] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
        <motion.line
          x1={300} y1={580} x2={1150} y2={480}
          stroke="#d97757" strokeWidth={0.4} opacity={0.08}
          strokeDasharray="6 18"
          animate={prefersReducedMotion ? undefined : { strokeDashoffset: [0, -48] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />

        {/* ── Dot grid (bottom-right quadrant) ── */}
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 6 }).map((_, col) => (
            <circle
              key={`grid-${row}-${col}`}
              cx={900 + col * 60}
              cy={500 + row * 45}
              r={1.2}
              fill="#d97757"
              opacity={0.1}
            />
          ))
        )}

        {/* ── Vertical guide lines ── */}
        <line x1={480} y1={0} x2={480} y2={900} stroke="#e0ddd4" strokeWidth={0.4} opacity={0.12} strokeDasharray="3 14" />
        <line x1={960} y1={0} x2={960} y2={900} stroke="#e0ddd4" strokeWidth={0.4} opacity={0.12} strokeDasharray="3 14" />
      </motion.svg>
    </motion.div>
  );
}
