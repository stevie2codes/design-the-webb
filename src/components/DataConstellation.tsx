import { useRef, useEffect } from "react";

/**
 * Full-bleed interactive data visualization canvas.
 * Floating nodes self-organize into bar chart formations near the cursor,
 * then relax back to organic drift. Demonstrates "making complex data feel obvious."
 *
 * Renders as an absolutely-positioned canvas — parent must be `position: relative`.
 */

// ── Palette ──
const ORANGE = "#d97757";

// ── Config ──
const NODE_COUNT = 180;
const CONNECTION_DIST = 100;
const CURSOR_RADIUS = 240;
const ORGANIZE_STRENGTH = 0.012;
const RETURN_STRENGTH = 0.008;

// ── Data labels (things a product designer works with) ──
const LABELS = [
  "Users", "Reports", "Dashboards", "Filters", "API", "Charts",
  "Tables", "Analytics", "Search", "Export", "AI", "Query",
  "Metrics", "KPIs", "Insights", "Pipeline", "Schema", "Alerts",
  "Segments", "Cohorts", "Trends", "Forecast", "Heatmap", "Funnel",
];

interface ConstellationNode {
  i: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  isAccent: boolean;
  radius: number;
  baseRadius: number;
  opacity: number;
  label: string;
  gridX: number;
  gridY: number;
  organizing: number;
  pulsePhase: number;
  pulseSpeed: number;
  born: number;
  scale: number;
}

function createNode(i: number, W: number, H: number): ConstellationNode {
  const biasedX = 0.4 + Math.random() * 0.6;
  let x = biasedX * W;
  let y = Math.random() * H;
  let homeX = x;
  let opacity = 0;

  // Some stray faint nodes on the left for organic feel
  if (Math.random() < 0.12) {
    x = Math.random() * 0.4 * W;
    homeX = x;
    opacity = 0.15 + Math.random() * 0.2;
  }

  const isAccent = Math.random() < 0.15;
  const radius = isAccent ? 4 + Math.random() * 3 : 2 + Math.random() * 2;

  return {
    i,
    x,
    y,
    homeX,
    homeY: y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    isAccent,
    radius,
    baseRadius: radius,
    opacity: opacity || 0.3 + Math.random() * 0.5,
    label: LABELS[Math.floor(Math.random() * LABELS.length)],
    gridX: 0,
    gridY: 0,
    organizing: 0,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.01 + Math.random() * 0.02,
    born: performance.now() + i * 12 + Math.random() * 400,
    scale: 0,
  };
}

function updateNode(
  n: ConstellationNode,
  time: number,
  mx: number,
  my: number,
  cursorActive: boolean,
  W: number,
  H: number,
) {
  const age = time - n.born;
  if (age < 0) {
    n.scale = 0;
    return;
  }
  n.scale = Math.min(1, age / 600);

  n.x += n.vx;
  n.y += n.vy;

  const margin = 20;
  if (n.x < margin) n.vx += 0.02;
  if (n.x > W - margin) n.vx -= 0.02;
  if (n.y < margin) n.vy += 0.02;
  if (n.y > H - margin) n.vy -= 0.02;

  n.vx *= 0.97;
  n.vy *= 0.97;

  if (cursorActive) {
    const dx = n.x - mx;
    const dy = n.y - my;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CURSOR_RADIUS) {
      const t = dist / CURSOR_RADIUS;
      const influence = 1 - t * t;

      const cols = 7;
      const barW = 36;
      const barGap = 10;
      const totalW = cols * barW + (cols - 1) * barGap;
      const startX = mx - totalW / 2;

      const col = n.i % cols;
      const heights = [0.5, 0.75, 0.45, 0.9, 0.6, 0.35, 0.8];
      const barH = heights[col] * 160;
      const row = Math.floor(n.i / cols);
      const rowsInCol = Math.ceil(NODE_COUNT / cols);

      n.gridX = startX + col * (barW + barGap) + barW / 2;
      n.gridY = my + 80 - (row / rowsInCol) * barH;

      n.organizing = Math.min(1, n.organizing + ORGANIZE_STRENGTH * influence);

      const pullStrength = n.organizing * 0.02;
      n.vx += (n.gridX - n.x) * pullStrength * 0.04;
      n.vy += (n.gridY - n.y) * pullStrength * 0.04;
    } else {
      n.organizing *= 0.985;
    }
  } else {
    n.organizing *= 0.985;
  }

  if (n.organizing < 0.1) {
    n.vx += (n.homeX - n.x) * RETURN_STRENGTH * 0.005;
    n.vy += (n.homeY - n.y) * RETURN_STRENGTH * 0.005;
  }

  n.pulsePhase += n.pulseSpeed;
  n.radius = n.baseRadius + Math.sin(n.pulsePhase) * (n.isAccent ? 1.5 : 0.5);
}

function drawNode(ctx: CanvasRenderingContext2D, n: ConstellationNode) {
  if (n.scale === 0) return;

  const s = n.scale;
  const r = n.radius * s;
  const alpha = n.opacity * s;

  if (n.isAccent) {
    ctx.beginPath();
    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4);
    grad.addColorStop(0, `rgba(217, 119, 87, ${0.15 * s})`);
    grad.addColorStop(1, `rgba(217, 119, 87, 0)`);
    ctx.fillStyle = grad;
    ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  if (n.isAccent) {
    ctx.fillStyle = ORANGE;
  } else {
    const o = n.organizing;
    const gr = Math.round(138 - o * 80);
    const gg = Math.round(136 - o * 80);
    const gb = Math.round(128 - o * 70);
    ctx.fillStyle = `rgba(${gr}, ${gg}, ${gb}, ${alpha})`;
  }
  ctx.fill();
}

function drawConnections(ctx: CanvasRenderingContext2D, nodes: ConstellationNode[]) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].scale < 0.3) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[j].scale < 0.3) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CONNECTION_DIST) {
        const alpha =
          (1 - dist / CONNECTION_DIST) * 0.12 * nodes[i].scale * nodes[j].scale;
        const bothAccent = nodes[i].isAccent && nodes[j].isAccent;
        const anyOrganized = (nodes[i].organizing + nodes[j].organizing) / 2;

        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);

        if (bothAccent) {
          ctx.strokeStyle = `rgba(217, 119, 87, ${alpha * 3})`;
        } else if (anyOrganized > 0.3) {
          ctx.strokeStyle = `rgba(20, 20, 19, ${alpha * (1 + anyOrganized)})`;
        } else {
          ctx.strokeStyle = `rgba(138, 136, 128, ${alpha})`;
        }
        ctx.lineWidth = bothAccent ? 1.2 : 0.6;
        ctx.stroke();
      }
    }
  }
}

function drawAxisHints(
  ctx: CanvasRenderingContext2D,
  nodes: ConstellationNode[],
  smoothMX: number,
  smoothMY: number,
) {
  let avgOrg = 0;
  for (const n of nodes) avgOrg += n.organizing;
  avgOrg /= nodes.length;

  if (avgOrg < 0.15) return;

  const alpha = Math.min(0.2, avgOrg * 0.4);
  const ax = smoothMX;
  const ay = smoothMY;

  ctx.beginPath();
  ctx.moveTo(ax - 160, ay + 85);
  ctx.lineTo(ax + 160, ay + 85);
  ctx.strokeStyle = `rgba(224, 221, 212, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ax - 160, ay + 85);
  ctx.lineTo(ax - 160, ay - 100);
  ctx.strokeStyle = `rgba(224, 221, 212, ${alpha * 0.6})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  const cols = 7;
  const barW = 36;
  const barGap = 10;
  const totalW = cols * barW + (cols - 1) * barGap;
  const startX = ax - totalW / 2;

  for (let c = 0; c < cols; c++) {
    const tx = startX + c * (barW + barGap) + barW / 2;
    ctx.beginPath();
    ctx.moveTo(tx, ay + 85);
    ctx.lineTo(tx, ay + 90);
    ctx.strokeStyle = `rgba(224, 221, 212, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export default function DataConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let nodes: ConstellationNode[] = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let smoothMX = -1000;
    let smoothMY = -1000;
    let cursorActive = false;
    let animId = 0;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      W = container!.clientWidth;
      H = container!.clientHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + "px";
      canvas!.style.height = H + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function init() {
      resize();
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push(createNode(i, W, H));
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        cursorActive = true;
      } else {
        cursorActive = false;
      }
    }

    function onMouseLeave() {
      cursorActive = false;
    }

    function onResize() {
      resize();
      nodes.forEach((n) => {
        const biasedX = 0.4 + Math.random() * 0.6;
        n.homeX = biasedX * W;
        n.homeY = Math.random() * H;
      });
    }

    function animate(time: number) {
      ctx!.clearRect(0, 0, W, H);

      const smoothing = 0.08;
      smoothMX += (mouseX - smoothMX) * smoothing;
      smoothMY += (mouseY - smoothMY) * smoothing;

      nodes.forEach((n) => updateNode(n, time, smoothMX, smoothMY, cursorActive, W, H));
      drawConnections(ctx!, nodes);
      drawAxisHints(ctx!, nodes, smoothMX, smoothMY);
      nodes.forEach((n) => drawNode(ctx!, n));

      animId = requestAnimationFrame(animate);
    }

    // Wire up
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", onResize);

    init();
    animId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
