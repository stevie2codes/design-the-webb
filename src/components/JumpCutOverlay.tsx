import { useEffect, useRef } from 'react';
import { registerJumpCutOverlay } from '../motion/lenis';

/**
 * The jump-cut curtain (SPEC §4.4): a fixed void layer at z 60, above the
 * nav and the mobile menu, below the cursor ring and the skip link. The nav
 * jump cut fades it in over 300 ms, scrolls and snaps the film underneath,
 * then fades it out over 400 ms (motion/lenis.ts `jumpCut`). Opacity is
 * written by gsap on the element, never through React state.
 *
 * aria-hidden and never interactive; opacity 0 in the static HTML, so it can
 * never hide content without JS.
 */
export default function JumpCutOverlay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => registerJumpCutOverlay(ref.current), []);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-60 bg-void opacity-0" />;
}
