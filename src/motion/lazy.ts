/**
 * Lazy loaders for the motion layer (SPEC §8.5: initial JS ≤ 140 KB gz).
 *
 * gsap (+ ScrollTrigger) and Lenis stay off the hydration path: first paint
 * and the LCP never need them, and the prerendered DOM is fully readable
 * without them. The scroll infrastructure (`ScrollInfra` → useSmoothScroll)
 * starts the load right after hydration; everything else that needs gsap
 * (chapters, Nav, CursorRing) awaits the same cached promises.
 *
 * SSR-safe: nothing is imported until a loader is called (effects only).
 */
export type GsapModule = typeof import('./gsap');
export type ScrollRuntime = typeof import('./scrollRuntime');
export type RevealModule = typeof import('./reveal');

let gsapP: Promise<GsapModule> | null = null;
let scrollP: Promise<ScrollRuntime> | null = null;
let revealP: Promise<RevealModule> | null = null;
let runtime: ScrollRuntime | null = null;
let warned = false;

/** Log a failed chunk once (the site keeps working natively without it). */
export function reportLoadError(e: unknown): void {
  if (warned) return;
  warned = true;
  console.error('[motion] failed to load the motion layer', e);
}

/** gsap + ScrollTrigger with the custom eases registered (motion/gsap.ts). A failed load can be retried. */
export function loadGsap(): Promise<GsapModule> {
  gsapP ??= import('./gsap').catch((e: unknown) => {
    gsapP = null;
    throw e;
  });
  return gsapP;
}

/** The scroll runtime (Lenis, ScrollTrigger wiring, scrollTo helpers, the sampler). */
export function loadScroll(): Promise<ScrollRuntime> {
  scrollP ??= import('./scrollRuntime').then(
    (m) => (runtime = m),
    (e: unknown) => {
      scrollP = null;
      throw e;
    },
  );
  return scrollP;
}

/** The scroll runtime if it has loaded, else null (synchronous; the facade in motion/lenis.ts). */
export function scrollRuntime(): ScrollRuntime | null {
  return runtime;
}

/** Line masks and fade-ups (SplitText): only chapters that reveal load it. */
export function loadReveal(): Promise<RevealModule> {
  revealP ??= import('./reveal').catch((e: unknown) => {
    revealP = null;
    throw e;
  });
  return revealP;
}
