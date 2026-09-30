import { useEffect, useRef, type CSSProperties } from 'react';

/** Hand-drawn marks, in a 100 × 100 box; each path is drawn in turn. */
const PATHS = {
  /** A curvy arrow pointing left (at what sits to its left). */
  arrowLeft: ['M95 38 C 72 16, 36 20, 10 52', 'M24 36 L9 53 L28 60'],
  /** A curvy arrow pointing down-left. */
  arrowDown: ['M88 8 C 92 44, 70 70, 22 84', 'M34 70 L20 85 L38 94'],
  /** A loose scribbled circle (not closed: the pen overshoots). */
  circle: ['M52 8 C 86 6, 98 40, 89 68 C 79 94, 24 97, 9 70 C -4 47, 15 12, 53 9 C 70 9, 83 17, 92 26'],
  star: ['M50 6 L61 38 L95 39 L67 59 L78 93 L50 72 L22 93 L33 59 L5 39 L39 38 Z'],
  heart: ['M50 90 C 10 62, 3 32, 25 19 C 39 11, 50 23, 50 33 C 50 23, 61 11, 75 19 C 97 32, 90 62, 50 90'],
  squiggle: ['M2 60 C 18 38, 30 78, 48 56 S 78 40, 98 58'],
  sparkle: ['M50 8 L50 92', 'M14 30 L86 70', 'M86 30 L14 70'],
} as const;

export type DoodleKind = keyof typeof PATHS;

/**
 * A pencil doodle for the sketch theme (src/sketch.css .doodle): aria-hidden
 * SVG strokes that draw themselves the first time they scroll into view
 * (stroke-dashoffset over a normalised pathLength). display:none in the ink
 * theme; drawn at once under reduced motion and without JS. Colour comes
 * from `currentColor` (text-steel for blue pencil, text-ember for red).
 */
export default function Doodle({ kind, className = '', style }: { kind: DoodleKind; className?: string; style?: CSSProperties }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.setAttribute('data-drawn', '');
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg ref={ref} aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none" className={`doodle ${className}`} style={style}>
      {PATHS[kind].map((d) => (
        <path key={d} d={d} pathLength={1} />
      ))}
    </svg>
  );
}
