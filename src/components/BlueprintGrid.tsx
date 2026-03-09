import { useEffect, useRef } from "react";
import p5 from "p5";

interface BlueprintGridProps {
  rectCount?: number;
  gridSpacing?: number;
  morphSpeed?: number;
  accentColor?: string;
  backgroundColor?: string;
  className?: string;
}

export default function BlueprintGrid({
  rectCount = 10,
  gridSpacing = 40,
  morphSpeed = 0.02,
  accentColor = "#d97757",
  backgroundColor = "#faf9f5",
  className,
}: BlueprintGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<p5 | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      let w = 0;
      let h = 0;
      let rects: WireRect[] = [];
      const gridSize = gridSpacing;

      function snapToGrid(val: number, jitter: number = 0): number {
        const snapped = Math.round(val / gridSize) * gridSize;
        return snapped + p.random(-jitter, jitter);
      }

      function randomRectTarget(): {
        x: number;
        y: number;
        rw: number;
        rh: number;
      } {
        const minCells = 2;
        const maxCellsW = Math.floor(w / gridSize) - 2;
        const maxCellsH = Math.floor(h / gridSize) - 2;
        const cellsW = p.floor(p.random(minCells, Math.min(6, maxCellsW)));
        const cellsH = p.floor(p.random(minCells, Math.min(5, maxCellsH)));
        const rw = cellsW * gridSize;
        const rh = cellsH * gridSize;
        const maxX = w - rw - gridSize;
        const maxY = h - rh - gridSize;

        // Keep left-center clear for text; allow blocks on right for portrait merge
        let x: number, y: number;
        const clearL = w * 0.08;
        const clearR = w * 0.52;
        const clearT = w > 768 ? h * 0.25 : h * 0.32;
        const clearB = w > 768 ? h * 0.75 : h * 0.68;
        let attempts = 0;
        do {
          x = snapToGrid(p.random(gridSize, Math.max(gridSize, maxX)), 3);
          y = snapToGrid(p.random(gridSize, Math.max(gridSize, maxY)), 3);
          attempts++;
        } while (
          attempts < 30 &&
          x + rw > clearL &&
          x < clearR &&
          y + rh > clearT &&
          y < clearB
        );

        return { x, y, rw, rh };
      }

      class WireRect {
        x: number;
        y: number;
        rw: number;
        rh: number;
        tx: number;
        ty: number;
        trw: number;
        trh: number;
        fillAlpha: number;
        strokeAlpha: number;
        cornerRadius: number;
        speed: number;
        settled: number;

        constructor() {
          const initial = randomRectTarget();
          this.x = initial.x;
          this.y = initial.y;
          this.rw = initial.rw;
          this.rh = initial.rh;
          this.tx = this.x;
          this.ty = this.y;
          this.trw = this.rw;
          this.trh = this.rh;
          this.fillAlpha = p.random(0, 10);
          this.strokeAlpha = p.random(15, 40);
          this.cornerRadius = p.random([0, 0, 4, 6]);
          this.speed = p.random(morphSpeed * 0.5, morphSpeed * 1.5);
          this.settled = 0;
          this.pickNewTarget();
        }

        pickNewTarget() {
          const t = randomRectTarget();
          this.tx = t.x;
          this.ty = t.y;
          this.trw = t.rw;
          this.trh = t.rh;
        }

        update() {
          this.x = p.lerp(this.x, this.tx, this.speed);
          this.y = p.lerp(this.y, this.ty, this.speed);
          this.rw = p.lerp(this.rw, this.trw, this.speed);
          this.rh = p.lerp(this.rh, this.trh, this.speed);

          const dx = Math.abs(this.x - this.tx);
          const dy = Math.abs(this.y - this.ty);
          const dw = Math.abs(this.rw - this.trw);
          const dh = Math.abs(this.rh - this.trh);

          if (dx < 1 && dy < 1 && dw < 1 && dh < 1) {
            this.settled++;
            if (this.settled > p.random(60, 180)) {
              this.pickNewTarget();
              this.settled = 0;
            }
          }
        }

        draw() {
          if (this.fillAlpha > 0) {
            const fc = p.color(accentColor);
            fc.setAlpha(this.fillAlpha);
            p.fill(fc);
          } else {
            p.noFill();
          }

          const sc = p.color(accentColor);
          sc.setAlpha(this.strokeAlpha);
          p.stroke(sc);
          p.strokeWeight(1);

          p.rect(this.x, this.y, this.rw, this.rh, this.cornerRadius);
        }
      }

      p.setup = () => {
        w = containerRef.current!.offsetWidth;
        h = containerRef.current!.offsetHeight;
        const canvas = p.createCanvas(w, h);
        canvas.parent(containerRef.current!);
        p.pixelDensity(Math.min(window.devicePixelRatio, 2));

        for (let i = 0; i < rectCount; i++) {
          rects.push(new WireRect());
        }
      };

      p.draw = () => {
        p.background(backgroundColor);

        // Draw dot grid
        const dotColor = p.color(accentColor);
        dotColor.setAlpha(28);
        p.fill(dotColor);
        p.noStroke();
        for (let x = gridSize; x < w; x += gridSize) {
          for (let y = gridSize; y < h; y += gridSize) {
            p.circle(x, y, 2);
          }
        }

        // Update and draw rectangles
        for (const r of rects) {
          r.update();
        }
        for (const r of rects) {
          r.draw();
        }

        // Occasional alignment guide flash
        if (p.frameCount % 120 < 3) {
          const guideColor = p.color(accentColor);
          guideColor.setAlpha(12);
          p.stroke(guideColor);
          p.strokeWeight(0.5);
          const gx = snapToGrid(p.random(w), 0);
          p.line(gx, 0, gx, h);
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
  }, [rectCount, gridSpacing, morphSpeed, accentColor, backgroundColor]);

  return <div ref={containerRef} className={className} />;
}
