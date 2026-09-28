/**
 * Reveal helpers used by the chapters (SPEC §5 conventions, §7, §8.1–8.2).
 *
 * - lineMask(el, opts): GSAP SplitText `{ type: 'lines', mask: 'lines',
 *   autoSplit: true, aria: 'auto' }`, lines `yPercent 105 → 0`. Scrubbed
 *   (`ease: 'none'`, `scrub: true`) over a scroll window, or time-based
 *   (700 ms, 90 ms stagger, expo.out) once when the window starts.
 * - fadeUp(els, opts): opacity 0 → 1 and y 16px → 0 (body text travels at
 *   most 24px, §7.3), same two modes, stagger .05 by default.
 *
 * Every reveal completes during the transit-in, so the whole stuck range is
 * readable (hold rule). Create them inside `useGSAP` / a gsap.context (e.g.
 * a chapter's `reveal` callback, see useChapter) so they revert with it;
 * `revert()` also works standalone. Under reduced motion both are no-ops that
 * return null: the text is simply visible (§8.2). SplitText's `aria: 'auto'`
 * labels the element and hides the split spans, so screen readers always
 * read the full text.
 *
 * Browser-only (call from effects). No layout reads per frame: windows are
 * ScrollTrigger positions, re-evaluated on refresh only.
 *
 * A LAZY CHUNK with SplitText (§8.5 initial JS budget): chapters get these
 * helpers from their `reveal(ctx)` context (`ctx.lineMask`, `ctx.fadeUp`),
 * and useChapter loads this module only for chapters that reveal. Never
 * import it statically from code in the initial bundle.
 */
import { SplitText } from 'gsap/SplitText';
import { DUR, EASE, gsap, ScrollTrigger } from './gsap';
import { isReducedMotion } from './motionPref';

gsap.registerPlugin(SplitText);

/** A scroll window: ScrollTrigger `trigger` / `start` / `end` (functions re-evaluate on refresh). */
export interface RevealWindow {
  trigger: Element;
  start: string | number | ((self: ScrollTrigger) => string | number);
  end?: string | number | ((self: ScrollTrigger) => string | number);
}

export interface RevealOptions {
  /**
   * The scroll window. `scrub` (default true): progress follows scroll
   * through [start, end] with `ease: 'none'`. `scrub: false`: a time-based
   * reveal plays once when scroll passes `start`.
   */
  window: RevealWindow;
  scrub?: boolean;
  /** Seconds between lines / elements (defaults: lines .09, fade-ups .05). */
  stagger?: number;
  /** Time-based only: seconds (default .7). */
  duration?: number;
  /** Time-based only: seconds of delay after the trigger. */
  delay?: number;
}

/** A running reveal. */
export interface Reveal {
  /** Jump to the revealed state for good (focus-in, §8.1): kills its trigger. */
  complete(): void;
  /** Undo the split and the tween (also happens when the owning context reverts). */
  revert(): void;
}

const FROM_Y_PERCENT = 105;
const FADE_Y_PX = 16;

function scrollTriggerVars(opts: RevealOptions): ScrollTrigger.Vars {
  const w = opts.window;
  return opts.scrub === false
    ? { trigger: w.trigger, start: w.start, once: true }
    : { trigger: w.trigger, start: w.start, end: w.end, scrub: true };
}

function tweenVars(opts: RevealOptions, stagger: number): gsap.TweenVars {
  const timed = opts.scrub === false;
  return {
    ease: timed ? EASE.outExpo : EASE.none,
    duration: timed ? (opts.duration ?? DUR.reveal) : DUR.reveal,
    delay: timed ? (opts.delay ?? 0) : 0,
    stagger: opts.stagger ?? stagger,
    scrollTrigger: scrollTriggerVars(opts),
  };
}

function finish(anim: gsap.core.Tween | null): void {
  if (!anim) return;
  anim.scrollTrigger?.kill(false);
  anim.progress(1);
}

/**
 * Line-mask reveal (§5): each line of `el` rises from under its own mask.
 * Re-splits on resize and font load (autoSplit), keeping its progress.
 */
export function lineMask(el: HTMLElement, opts: RevealOptions): Reveal | null {
  if (typeof window === 'undefined' || isReducedMotion()) return null;
  let anim: gsap.core.Tween | null = null;
  let done = false;
  const split = SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    aria: 'auto',
    onSplit(self: SplitText) {
      anim = gsap.fromTo(
        self.lines,
        { yPercent: FROM_Y_PERCENT },
        { yPercent: 0, ...tweenVars(opts, DUR.revealStagger) },
      );
      if (done) finish(anim);
      return anim;
    },
  });
  return {
    complete() {
      done = true;
      finish(anim);
    },
    revert() {
      split.revert();
      anim = null;
    },
  };
}

/** Fade-up reveal (§5): opacity 0 → 1, y 16px → 0, staggered in DOM order. */
export function fadeUp(els: Element | readonly Element[], opts: RevealOptions): Reveal | null {
  if (typeof window === 'undefined' || isReducedMotion()) return null;
  const targets = Array.isArray(els) ? [...els] : [els];
  if (targets.length === 0) return null;
  let anim: gsap.core.Tween | null = gsap.fromTo(
    targets,
    { opacity: 0, y: FADE_Y_PX },
    { opacity: 1, y: 0, ...tweenVars(opts, 0.05) },
  );
  return {
    complete() {
      finish(anim);
    },
    revert() {
      anim?.revert();
      anim = null;
    },
  };
}
