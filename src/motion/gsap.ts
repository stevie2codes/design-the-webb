/**
 * The one place GSAP plugins and eases are registered (SPEC §2.7, §9.1).
 * Import gsap and ScrollTrigger from here, never from 'gsap' directly, so
 * registration and the custom eases always exist first.
 *
 * NOT in the initial bundle (§8.5 initial JS ≤ 140 KB gz): only lazy chunks
 * import this module statically (the scroll runtime, the field engine, the
 * reveal helpers). Code in the initial bundle gets it through
 * `loadGsap()` / `loadScroll()` (motion/lazy.ts), after hydration; the
 * prerendered DOM is complete and readable without it.
 *
 * SplitText is registered by motion/reveal.ts (its own lazy chunk, loaded
 * only by chapters that reveal). The four custom eases are plain
 * cubic-béziers (motion/tokens.ts) registered with `gsap.registerEase`.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BEZIER, cubicBezier, DUR, EASE, LOOP } from './tokens';

gsap.registerPlugin(ScrollTrigger);

// Motion tokens (§2.7), matching the --ease-* CSS tokens.
for (const [name, [x1, y1, x2, y2]] of Object.entries(BEZIER)) gsap.registerEase(name, cubicBezier(x1, y1, x2, y2));

// Mobile URL-bar show/hide must not trigger refreshes (§4.2, §9.7).
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, EASE, DUR, LOOP };
