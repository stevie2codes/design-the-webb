import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type Ref, type RefObject } from 'react';
import { requestRefresh } from '../motion/lenis';
import { subscribeMotionPref } from '../motion/motionPref';
import { subscribeLayoutMode } from '../motion/useLayoutMode';
import { svhPx } from '../scroll/anchors';
import { CHAPTERS, type HomeChapterId } from '../scroll/chapters';
import { useChapter, type UseChapterOptions } from '../scroll/useChapter';

/**
 * The fit guard. A stuck stage is exactly 100svh, and during the hold every
 * word on it must be readable (§5, §7 hold rule), so content may never run
 * below the fold. The chapter marks what must fit with [data-fit]; when
 * (its bottom − the stage top + the stage's bottom padding) exceeds 100svh,
 * the section gets [data-overflow] and CSS drops it to plain flow (the
 * reduced-motion layout), which grows to fit. Re-measured on resize and
 * font load, and after a motion-preference or layout switch (content that
 * overflows only in flow must not stay stuck in [data-overflow] once the
 * stage is sticky again). useChapter reads [data-overflow] (via the stage's computed
 * position) like any other flow chapter; a flip requests a
 * ScrollTrigger refresh so the store and the segments follow.
 *
 * Stage-only sizes (the `staged:` variant: tighter, height-capped type and
 * rhythm) apply only without [data-overflow], so the guard always measures
 * the stuck layout: it lifts [data-overflow] for the measure and sets it
 * again in the same frame (no paint in between). The result does not
 * depend on the current mode, so it cannot oscillate or stick in flow.
 */
function useStageFit(sectionRef: RefObject<HTMLElement | null>, stageRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    const targets = Array.from(stage.querySelectorAll<HTMLElement>('[data-fit]'));
    if (targets.length === 0) return;

    let raf = 0;
    let alive = true;
    const measure = () => {
      raf = 0;
      if (!alive) return;
      const wasOverflow = section.hasAttribute('data-overflow');
      const scrollY = window.scrollY;
      if (wasOverflow) section.removeAttribute('data-overflow');
      const top = stage.getBoundingClientRect().top;
      let need = 0;
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        if (r.height > 0) need = Math.max(need, r.bottom - top);
      }
      need += parseFloat(getComputedStyle(stage).paddingBottom) || 0;
      const overflow = need > svhPx() + 1;
      section.toggleAttribute('data-overflow', overflow);
      // Lifting the flag grows the section for the measure; if scroll
      // anchoring moved the page meanwhile, put it back.
      if (wasOverflow && overflow && window.scrollY !== scrollY) window.scrollTo(0, scrollY);
      if (overflow !== wasOverflow) requestRefresh();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    const ro = new ResizeObserver(schedule);
    for (const el of targets) ro.observe(el);
    window.addEventListener('resize', schedule);
    const offMotion = subscribeMotionPref(schedule);
    const offLayout = subscribeLayoutMode(schedule);
    document.fonts?.ready.then(schedule, () => {});
    measure();

    return () => {
      alive = false;
      ro.disconnect();
      offMotion();
      offLayout();
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(raf);
      section.removeAttribute('data-overflow');
    };
  }, [sectionRef, stageRef]);
}

/** Forward a ref callback/object and keep our own. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export interface ChapterProps {
  /** Section id (also the hash target and the store key). */
  id: HomeChapterId;
  /** Desktop sticky length L in vh. Defaults to CHAPTERS[id].L. */
  L?: number;
  /** Mobile sticky length in svh. Defaults to CHAPTERS[id].mobileL. */
  mobileL?: number;
  /** Sticky on desktop. Defaults to CHAPTERS[id].sticky. */
  sticky?: boolean;
  /** Sticky on the mobile layout. Defaults to CHAPTERS[id].stickyOnMobile. */
  stickyOnMobile?: boolean;
  /** Sticky on short landscape phones. Defaults to CHAPTERS[id].stickyOnShort. */
  stickyOnShort?: boolean;
  /** Id of the chapter's heading (see headingId() in scroll/chapters.ts). */
  labelledBy?: string;
  /** Classes for the <section>. */
  className?: string;
  /** Classes for the .stage. */
  stageClassName?: string;
  /**
   * The stage keeps the HUD's bottom-left band clear even in flow (reduced
   * motion, no sticky): the HUD may show while the section covers it.
   * Sticky stages need no flag; the HUD shows while they are stuck.
   */
  hudZone?: boolean;
  children?: ReactNode;
  /** The <section>. */
  ref?: Ref<HTMLElement>;
  /** The .stage (sticky while the section scrolls L). */
  stageRef?: Ref<HTMLDivElement>;
  /**
   * Sticky progress p ∈ [0, 1] over L (flow: `top bottom` → `bottom top`) on
   * every ScrollTrigger update (§5 timelines). Write refs / the store only.
   */
  onProgress?: UseChapterOptions['onProgress'];
  /**
   * Build the chapter's scroll choreography inside its gsap context (see
   * useChapter's ChapterContext: transit-in windows, `track()` for focus-in).
   * Declarative `[data-reveal]` elements need no callback.
   */
  reveal?: UseChapterOptions['reveal'];
}

/**
 * A home chapter (SPEC §4.1, §4.2, §9.3): <section class="chapter"> with a
 * .stage inside. When sticky, CSS makes the section 100svh + L tall and the
 * stage `position: sticky; top: 0; height: 100svh` — but only under
 * html.js:not(.rm) and only in the layouts the flags allow. Everywhere else
 * (no-js, reduced motion, mobile flow chapters) it is plain flow, with sticky
 * chapters' stages still at least 100svh tall so stage-relative layout holds.
 *
 * There are no GSAP pins. Use the `staged:` variant for stacked / absolute
 * stage layouts that must fall back to flow.
 *
 * Mark the stage content that must fit one screen with `data-fit`: a sticky
 * chapter whose [data-fit] content is taller than 100svh falls back to flow
 * (section[data-overflow]; see useStageFit).
 *
 * The chapter is wired to the store by useChapter (§9.3): its ScrollTrigger
 * records the section and measures `[data-field-anchor]` / `[data-safe]` on
 * refresh, `onProgress` gets its progress, and `reveal` / `[data-reveal]`
 * build its reveals.
 */
export default function Chapter({
  id,
  L,
  mobileL,
  sticky,
  stickyOnMobile,
  stickyOnShort,
  labelledBy,
  className,
  stageClassName,
  hudZone,
  children,
  ref,
  stageRef,
  onProgress,
  reveal,
}: ChapterProps) {
  const spec: {
    L: number;
    mobileL?: number;
    sticky: boolean;
    stickyOnMobile: boolean;
    stickyOnShort: boolean;
    flowH?: number;
  } = CHAPTERS[id];
  const isSticky = sticky ?? spec.sticky;
  const isStickyMobile = stickyOnMobile ?? spec.stickyOnMobile;
  const isStickyShort = stickyOnShort ?? spec.stickyOnShort;
  const length = L ?? spec.L;
  const lengthMobile = mobileL ?? spec.mobileL ?? 0;

  const sectionEl = useRef<HTMLElement | null>(null);
  const stageEl = useRef<HTMLDivElement | null>(null);
  useStageFit(sectionEl, stageEl);
  useChapter(id, sectionEl, stageEl, { onProgress, reveal });

  const style: Record<string, string> = {};
  if (isSticky || isStickyShort) style['--chapter-l'] = `${length}vh`;
  if (isStickyMobile) style['--chapter-l-mobile'] = `${lengthMobile}svh`;
  if (spec.flowH !== undefined) style['--chapter-flow-h'] = `${spec.flowH}svh`;

  return (
    <section
      ref={(el) => {
        sectionEl.current = el;
        assignRef(ref, el);
      }}
      id={id}
      aria-labelledby={labelledBy}
      className={className ? `chapter ${className}` : 'chapter'}
      data-chapter={id}
      data-sticky={isSticky || undefined}
      data-sticky-mobile={isStickyMobile || undefined}
      data-sticky-short={isStickyShort || undefined}
      data-flow-h={spec.flowH !== undefined || undefined}
      data-hud-zone={hudZone || undefined}
      style={style as CSSProperties}
    >
      <div
        ref={(el) => {
          stageEl.current = el;
          assignRef(stageRef, el);
        }}
        className={stageClassName ? `stage ${stageClassName}` : 'stage'}>
        {children}
      </div>
    </section>
  );
}
