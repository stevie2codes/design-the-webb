/**
 * Small reveal helpers the chapters need beyond motion/reveal.ts (SPEC §5).
 * They take gsap from the chapter's useChapter context (never a static gsap
 * import) and return a `Reveal` so focus-in can complete them (§8.1).
 * Create them inside the chapter's `reveal(ctx)` callback: its gsap context
 * reverts them. Full motion only (the callers skip them under reduced motion).
 */
import type { Reveal, RevealWindow } from '../../motion/reveal';
import type { ChapterContext } from '../../scroll/useChapter';

type Gsap = ChapterContext['gsap'];
type Anim = ReturnType<Gsap['to']> | ReturnType<Gsap['timeline']>;

/** A scrubbed ScrollTrigger over a reveal window (`scrub: true`: Lenis already smooths, §5). */
export function scrubVars(w: RevealWindow): Record<string, unknown> {
  return { trigger: w.trigger, start: w.start, end: w.end, scrub: true };
}

/**
 * Wrap an animation driven by a ScrollTrigger as a `Reveal`. `clear` removes
 * whatever inline state the animation wrote; it runs after every revert —
 * useChapter reverts the chapter's context and THEN each tracked reveal, and
 * a second revert of a gsap animation can re-render its from-state — so the
 * last word is always the clear. Idempotent.
 */
export function asReveal(anim: Anim, clear?: () => void): Reveal {
  let reverted = false;
  return {
    complete() {
      if (reverted) return;
      anim.scrollTrigger?.kill(false);
      anim.progress(1);
    },
    revert() {
      if (!reverted) {
        reverted = true;
        anim.revert();
      }
      clear?.();
    },
  };
}

/**
 * A line mask for ONE line of text without SplitText (§5 "line mask":
 * yPercent 105 → 0 from under its own mask, scrubbed). For a heading whose
 * accessible name SplitText's aria handling would change (the chapter h2s
 * carry an aria-hidden "04 — "; never split ChapterHeading, CONTRACTS.md):
 * the element rises while a clip-path, counter-moving in its own box, keeps
 * the part below its resting line box hidden — the same picture as a mask.
 * At rest (progress 1) both are cleared, so nothing clips its focus ring.
 *
 * The styles are written by hand (onUpdate), so gsap cannot restore them: a
 * context revert re-renders the tween at p = 0 (`apply(0)`). The cleanup is
 * registered in the CURRENT gsap context too (it runs after the context's
 * tweens revert), and every write stops once it has run.
 */
export function maskOneLine(gsap: Gsap, el: HTMLElement, w: RevealWindow): Reveal {
  const FROM = 105;
  let shown = -1;
  let dead = false;
  const clear = (): void => {
    dead = true;
    el.style.removeProperty('transform');
    el.style.removeProperty('clip-path');
  };
  const apply = (p: number): void => {
    if (dead || p === shown) return;
    shown = p;
    if (p >= 1) {
      el.style.removeProperty('transform');
      el.style.removeProperty('clip-path');
      return;
    }
    const off = FROM * (1 - p);
    el.style.transform = `translateY(${off.toFixed(3)}%)`;
    el.style.clipPath = `inset(-25% -4% ${off.toFixed(3)}% -4%)`;
  };
  const state = { p: 0 };
  apply(0);
  const tween = gsap.to(state, {
    p: 1,
    ease: 'none',
    scrollTrigger: scrubVars(w),
    onUpdate: () => apply(state.p),
  });
  // gsap.context() with no argument returns the context being built (if any).
  gsap.context()?.add(() => clear);
  return asReveal(tween, clear);
}
