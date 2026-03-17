import { useEffect, useRef, useCallback } from "react";
import { motion, type MotionValue } from "framer-motion";

interface ParticleLayerProps {
  smoothMouseX: MotionValue<number>;
  smoothMouseY: MotionValue<number>;
  parallaxY: MotionValue<number>;
}

interface Particle {
  baseX: number; // 0-1440 in SVG coords
  baseY: number; // 0-900 in SVG coords
  r: number;
  color: string;
  opacity: number;
  oscillateX: number; // amplitude
  oscillateY: number;
  phase: number; // offset for sin
  speed: number;
}

/**
 * Compute a point along a quadratic bezier for t in [0,1].
 */
function bezierPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

// Three bezier curves spanning the viewport
const CURVES: [number, number][][] = [
  [[100, 150], [500, 50], [1000, 300]],
  [[200, 500], [720, 350], [1300, 550]],
  [[50, 750], [600, 600], [1400, 800]],
];

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  const colors = ["#d97757", "#c86641", "#e8a08a", "#8a8880", "#141413"];

  CURVES.forEach((curve) => {
    const count = 14 + Math.floor(Math.random() * 4); // 14-17 per curve
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1) + (Math.random() - 0.5) * 0.08;
      const [bx, by] = bezierPoint(
        curve[0] as [number, number],
        curve[1] as [number, number],
        curve[2] as [number, number],
        Math.max(0, Math.min(1, t))
      );
      // Scatter slightly off the curve
      const scatter = 40;
      particles.push({
        baseX: bx + (Math.random() - 0.5) * scatter,
        baseY: by + (Math.random() - 0.5) * scatter,
        r: Math.random() < 0.12 ? 4 + Math.random() * 2 : 1.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.25 + Math.random() * 0.35,
        oscillateX: 3 + Math.random() * 8,
        oscillateY: 3 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.7,
      });
    }
  });

  return particles;
}

const SCATTER_RADIUS = 120; // px in SVG coords — dramatic
const SCATTER_STRENGTH = 60;

export default function ParticleLayer({ smoothMouseX, smoothMouseY, parallaxY }: ParticleLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const circleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const rafRef = useRef<number>(0);

  // Generate particles once
  if (particlesRef.current.length === 0) {
    particlesRef.current = generateParticles();
  }
  const particles = particlesRef.current;

  const prefersReducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const animate = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion) return;

    const now = performance.now() / 1000;

    // Convert normalized mouse (0-1) to SVG coords (0-1440, 0-900)
    const mx = smoothMouseX.get() * 1440;
    const my = smoothMouseY.get() * 900;

    particles.forEach((p, i) => {
      const el = circleRefs.current[i];
      if (!el) return;

      // Oscillation
      const ox = Math.sin(now * p.speed + p.phase) * p.oscillateX;
      const oy = Math.cos(now * p.speed * 0.8 + p.phase) * p.oscillateY;

      let px = p.baseX + ox;
      let py = p.baseY + oy;

      // Mouse scatter
      const dx = px - mx;
      const dy = py - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SCATTER_RADIUS && dist > 0) {
        const force = (1 - dist / SCATTER_RADIUS) * SCATTER_STRENGTH;
        px += (dx / dist) * force;
        py += (dy / dist) * force;
      }

      el.setAttribute("cx", px.toFixed(1));
      el.setAttribute("cy", py.toFixed(1));
    });

    rafRef.current = requestAnimationFrame(animate);
  }, [particles, smoothMouseX, smoothMouseY, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, prefersReducedMotion]);

  return (
    <motion.div
      className="absolute inset-0"
      style={{ y: parallaxY }}
      aria-hidden="true"
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        {particles.map((p, i) => (
          <circle
            key={i}
            ref={(el) => { circleRefs.current[i] = el; }}
            cx={p.baseX}
            cy={p.baseY}
            r={p.r}
            fill={p.color}
            opacity={p.opacity}
          />
        ))}
      </svg>
    </motion.div>
  );
}
