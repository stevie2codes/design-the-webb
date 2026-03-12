import { useEffect, useRef } from "react";
import p5 from "p5";

export type FlowPhase = "flowing" | "converging" | "shimmering" | "released";

interface FlowFieldProps {
  className?: string;
  particleCount?: number;
  onPhaseChange?: (phase: FlowPhase) => void;
}

const COLORS = [
  { r: 217, g: 119, b: 87 }, // orange
  { r: 232, g: 160, b: 138 }, // orange-light
  { r: 200, g: 102, b: 65 }, // orange-dark
  { r: 190, g: 165, b: 145 }, // warm muted
  { r: 170, g: 150, b: 140 }, // cool muted
  { r: 217, g: 119, b: 87 }, // extra orange weight
];

const BG_FADE = "rgba(250, 249, 245, 0.06)";
const BG_FILL = "#faf9f5";
const MOUSE_RADIUS = 250;

// Phase timing (ms)
const PHASE_FLOWING_END = 500;
const PHASE_CONVERGING_END = 2000;
const PHASE_SHIMMERING_END = 2500;

export default function FlowField({
  className,
  particleCount,
  onPhaseChange,
}: FlowFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<p5 | null>(null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const isMobile = window.innerWidth < 768;
    const count = particleCount ?? (isMobile ? 1000 : 2500);

    const sketch = (p: p5) => {
      let W = 0;
      let H = 0;
      let mouseX = -1000;
      let mouseY = -1000;
      let time = 0;
      let startTime = 0;
      let currentPhase: FlowPhase = "flowing";

      // Text attractor points
      let attractorPoints: { x: number; y: number }[] = [];
      // Pre-computed: for each particle, its assigned attractor index (-1 = none)
      let particleAttractorIdx: number[] = [];

      interface Particle {
        x: number;
        y: number;
        px: number;
        py: number;
        speed: number;
        alpha: number;
        baseAlpha: number;
        color: (typeof COLORS)[number];
        life: number;
        maxLife: number;
      }

      const particles: Particle[] = [];

      // ─── Text sampling ───
      function sampleTextPoints(): { x: number; y: number }[] {
        const offscreen = document.createElement("canvas");
        // Compute font size matching clamp(3.5rem, 10vw, 8rem)
        const vwSize = W * 0.1;
        const fontSize = Math.max(56, Math.min(vwSize, 128));
        const lineHeight = fontSize * 0.9;

        // Text area: left portion of viewport for split layout
        const textAreaX = W * 0.04;
        const textAreaY = H * 0.3;

        offscreen.width = W;
        offscreen.height = H;
        const octx = offscreen.getContext("2d")!;

        octx.fillStyle = "#000";
        octx.font = `700 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
        octx.textBaseline = "top";
        octx.fillText("Stephen", textAreaX, textAreaY);
        octx.fillText("Webb", textAreaX, textAreaY + lineHeight);

        // Sample pixel data
        const imageData = octx.getImageData(0, 0, W, H);
        const points: { x: number; y: number }[] = [];
        const step = isMobile ? 5 : 3;

        for (let y = 0; y < H; y += step) {
          for (let x = 0; x < W; x += step) {
            const idx = (y * W + x) * 4;
            // Check alpha channel — any painted pixel
            if (imageData.data[idx + 3] > 128) {
              points.push({ x, y });
            }
          }
        }

        return points;
      }

      function assignAttractors() {
        particleAttractorIdx = [];
        if (attractorPoints.length === 0) {
          for (let i = 0; i < particles.length; i++) {
            particleAttractorIdx.push(-1);
          }
          return;
        }

        // Assign each particle the nearest attractor point
        for (let i = 0; i < particles.length; i++) {
          const px = particles[i].x;
          const py = particles[i].y;
          let bestDist = Infinity;
          let bestIdx = -1;

          // Sample a subset for performance (check every 4th attractor)
          for (let j = 0; j < attractorPoints.length; j += 4) {
            const dx = px - attractorPoints[j].x;
            const dy = py - attractorPoints[j].y;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
              bestDist = d;
              bestIdx = j;
            }
          }
          // Refine: check neighbors of best
          if (bestIdx >= 0) {
            for (
              let j = Math.max(0, bestIdx - 3);
              j < Math.min(attractorPoints.length, bestIdx + 4);
              j++
            ) {
              const dx = px - attractorPoints[j].x;
              const dy = py - attractorPoints[j].y;
              const d = dx * dx + dy * dy;
              if (d < bestDist) {
                bestDist = d;
                bestIdx = j;
              }
            }
          }
          particleAttractorIdx.push(bestIdx);
        }
      }

      // ─── Phase management ───
      function getPhase(elapsed: number): FlowPhase {
        if (elapsed < PHASE_FLOWING_END) return "flowing";
        if (elapsed < PHASE_CONVERGING_END) return "converging";
        if (elapsed < PHASE_SHIMMERING_END) return "shimmering";
        return "released";
      }

      // ─── Noise flow ───
      function flowAngle(x: number, y: number, t: number): number {
        const scale = 0.0025;
        const n =
          Math.sin(x * scale * 1.1 + t * 0.5) *
            Math.cos(y * scale * 1.4 + t * 0.35) +
          Math.sin((x + y) * scale * 0.6 - t * 0.25) * 0.7 +
          Math.cos(y * scale * 0.8 + x * scale * 0.5 + t * 0.4) * 0.5 +
          Math.sin(x * scale * 2.0 - y * scale * 0.3 + t * 0.6) * 0.2;

        let angle = n * Math.PI * 1.8;

        const dx = x - mouseX;
        const dy = y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS) {
          const influence = Math.pow(1 - dist / MOUSE_RADIUS, 1.5) * 1.2;
          const mouseAngle = Math.atan2(dy, dx) + Math.PI * 0.55;
          angle += (mouseAngle - angle) * influence;
        }

        return angle;
      }

      function spawnParticle(): Particle {
        const c = COLORS[Math.floor(Math.random() * COLORS.length)];
        const x = Math.random() * W;
        const y = Math.random() * H;
        const baseAlpha = 0.06 + Math.random() * 0.12;
        return {
          x,
          y,
          px: x,
          py: y,
          speed: 1.0 + Math.random() * 1.5,
          alpha: baseAlpha,
          baseAlpha,
          color: c,
          life: 0,
          maxLife: 80 + Math.random() * 160,
        };
      }

      function spawnFromEdge(): Particle {
        const particle = spawnParticle();
        const side = Math.floor(Math.random() * 4);
        if (side === 0) {
          particle.x = -5;
          particle.y = Math.random() * H;
        } else if (side === 1) {
          particle.x = W + 5;
          particle.y = Math.random() * H;
        } else if (side === 2) {
          particle.x = Math.random() * W;
          particle.y = -5;
        } else {
          particle.x = Math.random() * W;
          particle.y = H + 5;
        }
        particle.px = particle.x;
        particle.py = particle.y;
        return particle;
      }

      p.setup = () => {
        W = containerRef.current!.offsetWidth;
        H = containerRef.current!.offsetHeight;
        const canvas = p.createCanvas(W, H);
        canvas.parent(containerRef.current!);
        p.pixelDensity(Math.min(window.devicePixelRatio, 2));

        for (let i = 0; i < count; i++) {
          const particle = spawnParticle();
          particle.life = Math.random() * particle.maxLife;
          particles.push(particle);
        }

        p.background(BG_FILL);
        startTime = p.millis();

        // Sample text attractor points
        attractorPoints = sampleTextPoints();
        assignAttractors();

        onPhaseChangeRef.current?.("flowing");
      };

      p.draw = () => {
        const ctx = (
          p as unknown as { drawingContext: CanvasRenderingContext2D }
        ).drawingContext;
        ctx.fillStyle = BG_FADE;
        ctx.fillRect(0, 0, W, H);

        time += 0.012;
        const elapsed = p.millis() - startTime;
        const phase = getPhase(elapsed);

        // Fire phase change callback
        if (phase !== currentPhase) {
          currentPhase = phase;
          onPhaseChangeRef.current?.(phase);

          // Re-assign attractors at convergence start for best distribution
          if (phase === "converging") {
            assignAttractors();
          }
        }

        // Convergence progress: 0 at start → 1 at end of converging phase
        const convergeProgress =
          phase === "converging"
            ? (elapsed - PHASE_FLOWING_END) /
              (PHASE_CONVERGING_END - PHASE_FLOWING_END)
            : phase === "shimmering" || phase === "released"
              ? 1
              : 0;

        for (let i = 0; i < particles.length; i++) {
          const particle = particles[i];
          particle.px = particle.x;
          particle.py = particle.y;

          if (
            phase === "converging" &&
            particleAttractorIdx[i] >= 0
          ) {
            // Steer toward attractor with increasing strength
            const target = attractorPoints[particleAttractorIdx[i]];
            const dx = target.x - particle.x;
            const dy = target.y - particle.y;
            const lerpStrength = convergeProgress * 0.12;
            particle.x += dx * lerpStrength;
            particle.y += dy * lerpStrength;
            // Boost alpha as they converge to make text brighter
            particle.alpha =
              particle.baseAlpha + convergeProgress * 0.15;
          } else if (
            phase === "shimmering" &&
            particleAttractorIdx[i] >= 0
          ) {
            // Hold at attractor with small jitter
            const target = attractorPoints[particleAttractorIdx[i]];
            particle.x = target.x + (Math.random() - 0.5) * 3;
            particle.y = target.y + (Math.random() - 0.5) * 3;
            particle.alpha = particle.baseAlpha + 0.18;
          } else {
            // Normal flow (flowing + released phases)
            const angle = flowAngle(particle.x, particle.y, time);
            particle.x += Math.cos(angle) * particle.speed;
            particle.y += Math.sin(angle) * particle.speed;
            particle.life++;

            // Brief alpha spike on release
            if (
              phase === "released" &&
              elapsed < PHASE_SHIMMERING_END + 300
            ) {
              particle.alpha = particle.baseAlpha + 0.1;
            } else {
              particle.alpha = particle.baseAlpha;
            }
          }

          // Life-based fade (only in flow modes)
          let lifeAlpha = 1;
          if (phase === "flowing" || phase === "released") {
            if (particle.life < 15) lifeAlpha = particle.life / 15;
            else if (particle.life > particle.maxLife - 25)
              lifeAlpha = Math.max(
                0,
                (particle.maxLife - particle.life) / 25
              );
          }

          // Respawn if off-screen or expired (only in flow modes)
          if (phase === "flowing" || phase === "released") {
            if (
              particle.x < -30 ||
              particle.x > W + 30 ||
              particle.y < -30 ||
              particle.y > H + 30 ||
              particle.life > particle.maxLife
            ) {
              const np =
                Math.random() < 0.6 ? spawnFromEdge() : spawnParticle();
              particles[i] = np;
              particleAttractorIdx[i] = -1;
              continue;
            }
          }

          // Draw trail
          const a = particle.alpha * lifeAlpha;
          if (a > 0.005) {
            ctx.beginPath();
            ctx.moveTo(particle.px, particle.py);
            ctx.lineTo(particle.x, particle.y);
            ctx.strokeStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${a})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }
        }
      };

      p.mouseMoved = () => {
        mouseX = p.mouseX;
        mouseY = p.mouseY;
      };

      p.windowResized = () => {
        if (!containerRef.current) return;
        W = containerRef.current.offsetWidth;
        H = containerRef.current.offsetHeight;
        p.resizeCanvas(W, H);
        // Re-sample text for new dimensions
        attractorPoints = sampleTextPoints();
        assignAttractors();
      };
    };

    sketchRef.current = new p5(sketch);

    return () => {
      sketchRef.current?.remove();
      sketchRef.current = null;
    };
  }, [particleCount]);

  return <div ref={containerRef} className={className} />;
}
