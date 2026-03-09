import { useEffect, useRef } from "react";
import p5 from "p5";

interface MeshNetworkProps {
  nodeCount?: number;
  connectionDistance?: number;
  nodeSpeed?: number;
  nodeColor?: string;
  lineColor?: string;
  backgroundColor?: string;
  nodeSize?: number;
  lineWeight?: number;
  className?: string;
}

export default function MeshNetwork({
  nodeCount = 80,
  connectionDistance = 150,
  nodeSpeed = 0.3,
  nodeColor = "#d97757",
  lineColor = "#d97757",
  backgroundColor = "#faf9f5",
  nodeSize = 3,
  lineWeight = 0.8,
  className,
}: MeshNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<p5 | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      let nodes: Node[] = [];
      let w = 0;
      let h = 0;

      class Node {
        x: number;
        y: number;
        vx: number;
        vy: number;
        size: number;
        alpha: number;

        constructor() {
          this.x = p.random(w);
          this.y = p.random(h);
          const angle = p.random(p.TWO_PI);
          const speed = p.random(nodeSpeed * 0.4, nodeSpeed);
          this.vx = p.cos(angle) * speed;
          this.vy = p.sin(angle) * speed;
          this.size = p.random(nodeSize * 0.5, nodeSize * 1.5);
          this.alpha = p.random(30, 80);
        }

        update() {
          this.x += this.vx;
          this.y += this.vy;

          // Soft bounce off edges with padding
          const pad = 20;
          if (this.x < -pad) this.x = w + pad;
          if (this.x > w + pad) this.x = -pad;
          if (this.y < -pad) this.y = h + pad;
          if (this.y > h + pad) this.y = -pad;
        }

        draw() {
          const c = p.color(nodeColor);
          c.setAlpha(this.alpha);
          p.noStroke();
          p.fill(c);
          p.circle(this.x, this.y, this.size * 2);
        }
      }

      p.setup = () => {
        w = containerRef.current!.offsetWidth;
        h = containerRef.current!.offsetHeight;
        const canvas = p.createCanvas(w, h);
        canvas.parent(containerRef.current!);
        p.pixelDensity(Math.min(window.devicePixelRatio, 2));

        for (let i = 0; i < nodeCount; i++) {
          nodes.push(new Node());
        }
      };

      p.draw = () => {
        p.background(backgroundColor);

        // Update nodes
        for (const node of nodes) {
          node.update();
        }

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < connectionDistance) {
              // Fade opacity based on distance
              const alpha = p.map(dist, 0, connectionDistance, 40, 0);
              const c = p.color(lineColor);
              c.setAlpha(alpha);
              p.stroke(c);
              p.strokeWeight(lineWeight);
              p.line(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
            }
          }
        }

        // Draw nodes on top
        for (const node of nodes) {
          node.draw();
        }
      };

      p.windowResized = () => {
        if (!containerRef.current) return;
        w = containerRef.current.offsetWidth;
        h = containerRef.current.offsetHeight;
        p.resizeCanvas(w, h);
      };
    };

    sketchRef.current = new p5(sketch);

    return () => {
      sketchRef.current?.remove();
      sketchRef.current = null;
    };
  }, [
    nodeCount,
    connectionDistance,
    nodeSpeed,
    nodeColor,
    lineColor,
    backgroundColor,
    nodeSize,
    lineWeight,
  ]);

  return <div ref={containerRef} className={className} />;
}
