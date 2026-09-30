import { useEffect, useRef } from 'react';
import { useMotionPref } from '../motion/motionPref';
import { useTheme } from '../theme';

/** Seeds the rough filter steps through while it "boils" (hand-animation line boil). */
const SEEDS = [2, 7, 13, 21] as const;
/** ~7 steps a second: slow enough to read as drawn frames, not jitter. */
const BOIL_MS = 140;

/**
 * The sketch theme's SVG filter (src/sketch.css): `#sk-rough` displaces a
 * drawn outline with fractal noise, so ruled borders read as pencil lines.
 * In the sketch theme with full motion, the noise seed steps through a few
 * values ~7×/s, and every outline "boils" like frames of hand-drawn
 * animation. Reduced motion, a hidden tab or the ink theme: it holds still.
 * aria-hidden, zero-size; the filter only paints where CSS asks for it.
 */
export default function SketchDefs() {
  const turb = useRef<SVGFETurbulenceElement>(null);
  const turbLg = useRef<SVGFETurbulenceElement>(null);
  const theme = useTheme();
  const reduced = useMotionPref() === 'reduced';

  useEffect(() => {
    const el = turb.current;
    const lg = turbLg.current;
    if (!el || !lg || theme !== 'sketch' || reduced) return;
    let i = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      i = (i + 1) % SEEDS.length;
      el.setAttribute('seed', String(SEEDS[i]));
      lg.setAttribute('seed', String(SEEDS[i]));
    }, BOIL_MS);
    return () => window.clearInterval(id);
  }, [theme, reduced]);

  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="pointer-events-none absolute">
      <filter id="sk-rough" x="-4%" y="-12%" width="108%" height="124%" colorInterpolationFilters="sRGB">
        <feTurbulence ref={turb} type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={SEEDS[0]} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      {/* Large boxes (.sketch-box): a longer, gentler wobble, so a long thin
          line bends instead of breaking into dashes. */}
      <filter id="sk-rough-lg" x="-2%" y="-4%" width="104%" height="108%" colorInterpolationFilters="sRGB">
        <feTurbulence ref={turbLg} type="fractalNoise" baseFrequency="0.012" numOctaves={1} seed={SEEDS[0]} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={2.4} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
