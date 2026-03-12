import { useEffect, useRef } from "react";
import p5 from "p5";

interface FlowFieldProps {
  className?: string;
  particleCount?: number;
  onPhaseChange?: (
    phase: "flowing" | "converging" | "shimmering" | "released"
  ) => void;
}

const COLORS = [
  { r: 217, g: 119, b: 87 }, // orange
  { r: 232, g: 160, b: 138 }, // orange-light
  { r: 200, g: 102, b: 65 }, // orange-dark
  { r: 190, g: 165, b: 145 }, // warm muted
  { r: 170, g: 150, b: 140 }, // cool muted
  { r: 217, g: 119, b: 87 }, // extra orange weight
];

const BG_COLOR = "rgba(250, 249, 245, 0.06)";
const BG_FILL = "#faf9f5";
const MOUSE_RADIUS = 250;

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

      interface Particle {
        x: number;
        y: number;
        px: number;
        py: number;
        speed: number;
        alpha: number;
        color: (typeof COLORS)[number];
        life: number;
        maxLife: number;
      }

      const particles: Particle[] = [];

      function flowAngle(x: number, y: number, t: number): number {
        const scale = 0.0025;
        const n =
          Math.sin(x * scale * 1.1 + t * 0.5) *
            Math.cos(y * scale * 1.4 + t * 0.35) +
          Math.sin((x + y) * scale * 0.6 - t * 0.25) * 0.7 +
          Math.cos(y * scale * 0.8 + x * scale * 0.5 + t * 0.4) * 0.5 +
          Math.sin(x * scale * 2.0 - y * scale * 0.3 + t * 0.6) * 0.2;

        let angle = n * Math.PI * 1.8;

        // Mouse swirl
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
        return {
          x,
          y,
          px: x,
          py: y,
          speed: 1.0 + Math.random() * 1.5,
          alpha: 0.06 + Math.random() * 0.12,
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
          particle.life = Math.random() * particle.maxLife; // stagger
          particles.push(particle);
        }

        // Initial background fill
        p.background(BG_FILL);

        // Start in flowing phase
        onPhaseChangeRef.current?.("flowing");
      };

      p.draw = () => {
        // Soft fade for trailing effect
        p.noStroke();
        p.fill(BG_FILL);
        // Manual alpha fill since p5 background() doesn't support alpha well
        const ctx = (p as unknown as { drawingContext: CanvasRenderingContext2D }).drawingContext;
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, W, H);

        time += 0.012;

        for (let i = 0; i < particles.length; i++) {
          const particle = particles[i];
          particle.px = particle.x;
          particle.py = particle.y;

          const angle = flowAngle(particle.x, particle.y, time);
          particle.x += Math.cos(angle) * particle.speed;
          particle.y += Math.sin(angle) * particle.speed;
          particle.life++;

          // Life-based fade
          let lifeAlpha = 1;
          if (particle.life < 15) lifeAlpha = particle.life / 15;
          else if (particle.life > particle.maxLife - 25)
            lifeAlpha = Math.max(0, (particle.maxLife - particle.life) / 25);

          // Respawn if off-screen or expired
          if (
            particle.x < -30 ||
            particle.x > W + 30 ||
            particle.y < -30 ||
            particle.y > H + 30 ||
            particle.life > particle.maxLife
          ) {
            const np = Math.random() < 0.6 ? spawnFromEdge() : spawnParticle();
            particles[i] = np;
            continue;
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

      // Track mouse position relative to canvas
      p.mouseMoved = () => {
        mouseX = p.mouseX;
        mouseY = p.mouseY;
      };

      p.windowResized = () => {
        if (!containerRef.current) return;
        W = containerRef.current.offsetWidth;
        H = containerRef.current.offsetHeight;
        p.resizeCanvas(W, H);
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
