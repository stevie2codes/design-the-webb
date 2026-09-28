/**
 * useChapter (SPEC §9.3, §9.6, §8.1): one home chapter → the store.
 *
 * Inside `useGSAP({ scope, dependencies: [reducedMotion, layout],
 * revertOnUpdate })`:
 * - one ScrollTrigger over the section — sticky: `top top` → `bottom bottom`
 *   (progress over L); flow: `top bottom` → `bottom top`. Sticky-ness is the
 *   stage's computed position at refresh time, so a fit-guard fallback
 *   (section[data-overflow]), mobile and reduced motion all read as flow;
 * - `onRefresh` is the ONLY layout read: the section's document rect →
 *   `store.chapters[id]`, the stage's `[data-field-anchor]` / `[data-safe]`
 *   rects → `store.anchors` / `store.safe` (registerChapterRects), then
 *   `segments.resolve()` and `store.version++`;
 * - `onUpdate` / `onToggle` write `progress` / `active` (no layout reads);
 * - the chapter's reveals: declarative `[data-reveal]` elements (below) and
 *   the `reveal(ctx)` callback. They complete during the transit-in (hold
 *   rule) and are all reverted with the context.
 *
 * Declarative reveals (full motion only; no-ops under reduced motion):
 * - `data-reveal="lines"`: line mask (§5), scrubbed while the section top
 *   moves from 60% to 15% of the viewport (the §5 statement window).
 * - `data-reveal="up"`: fade-up 16px, scrubbed from 35% to 0%; elements that
 *   share a window are staggered together (.05).
 * - `data-reveal-window="from,to"`: another window, in % of the viewport
 *   (e.g. "40,5" for the C4 rows, "75,35" for the NDA text).
 * - `data-reveal-timed`: time-based (700 ms, once) instead of scrubbed.
 * In flow (mobile, fit-guard fallback) the window is the element's own top
 * moving from 92% to 70%, since the section top says little about a block
 * deep in a long flow chapter.
 *
 * Focus-in (§8.1): keyboard focus inside the chapter completes its reveals
 * and, when the stage is sticky but not stuck, glides (600 ms) to the hold
 * start — for C3, to the focused panel's window hold. Jumps that move focus
 * themselves use `focusQuietly` and are ignored.
 *
 * Also a refresh point (§9.10): every mount / rebuild requests one
 * coalesced `ScrollTrigger.refresh()`.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { LayoutMode } from '../field/layout';
import { FOCUS_GLIDE_S, glide, requestRefresh } from '../motion/lenis';
import { ScrollTrigger, useGSAP } from '../motion/gsap';
import { useReducedMotion } from '../motion/motionPref';
import { fadeUp, lineMask, type Reveal, type RevealWindow } from '../motion/reveal';
import { useLayoutMode } from '../motion/useLayoutMode';
import { clearChapterRects, isStageSticky, registerChapterRects, svhPx } from './anchors';
import { JUMP_OFFSET_VH, PROJECT_HOLD_Q, PROJECT_WINDOW_VH, type HomeChapterId } from './chapters';
import { isQuietFocus } from './jump';
import { resolve } from './segments';
import { store } from './store';

/** What a chapter's `reveal` callback receives. */
export interface ChapterContext {
  readonly id: HomeChapterId;
  readonly section: HTMLElement;
  readonly stage: HTMLElement;
  readonly reduced: boolean;
  readonly layout: LayoutMode;
  /** Whether the stage is sticky right now (computed style: call at build / refresh time only). */
  isSticky(): boolean;
  /**
   * A transit-in scroll window for `el`: while the stage is sticky, the
   * section top moving from `from`% to `to`% of the viewport; in flow, `el`'s
   * top moving from 92% to 70%. Re-evaluated on every refresh.
   */
  window(el: Element, from: number, to: number): RevealWindow;
  /** Register a reveal so focus-in can complete it (§8.1). Returns it. */
  track<R extends Reveal | null>(reveal: R): R;
}

export interface UseChapterOptions {
  /** Sticky progress p (or flow progress) on every ScrollTrigger update. Write refs / store, never React state. */
  onProgress?: (p: number, self: ScrollTrigger) => void;
  /**
   * Build the chapter's scroll choreography (reveals, scrubs) inside its
   * gsap context. May return a cleanup; everything gsap created is reverted
   * anyway on unmount and when reduced motion or the layout changes.
   */
  reveal?: (ctx: ChapterContext) => void | (() => void);
}

/** Default reveal windows (§5): statements 60% → 15%; body fade-ups 35% → 0%. */
export const REVEAL_WINDOWS = { lines: [60, 15], up: [35, 0] } as const;
/** Flow reveal window: the element's own top from 92% to 70% of the viewport. */
const FLOW_WINDOW = ['top 92%', 'top 70%'] as const;

const docTop = (el: Element): number => el.getBoundingClientRect().top + window.scrollY;
const viewportH = (): number => store.scroll.H || window.innerHeight;

function parseWindow(raw: string | undefined, fallback: readonly [number, number]): [number, number] {
  const m = raw ? /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(raw) : null;
  return m ? [Number(m[1]), Number(m[2])] : [fallback[0], fallback[1]];
}

/** `[data-reveal]` → line masks and grouped fade-ups (see the file header). */
function autoReveals(ctx: ChapterContext): void {
  const groups = new Map<string, { from: number; to: number; timed: boolean; els: HTMLElement[] }>();
  for (const el of ctx.section.querySelectorAll<HTMLElement>('[data-reveal]')) {
    const kind = el.dataset.reveal;
    const timed = el.hasAttribute('data-reveal-timed');
    if (kind === 'lines') {
      const [from, to] = parseWindow(el.dataset.revealWindow, REVEAL_WINDOWS.lines);
      ctx.track(lineMask(el, { window: ctx.window(el, from, to), scrub: !timed }));
    } else if (kind === 'up') {
      const [from, to] = parseWindow(el.dataset.revealWindow, REVEAL_WINDOWS.up);
      const key = `${from},${to},${timed}`;
      const group = groups.get(key);
      if (group) group.els.push(el);
      else groups.set(key, { from, to, timed, els: [el] });
    }
  }
  for (const { from, to, timed, els } of groups.values()) {
    ctx.track(fadeUp(els, { window: ctx.window(els[0], from, to), scrub: !timed }));
  }
}

/** The C3 panel index (0–3) of a focused element, or −1. */
function panelOf(el: Element): number {
  const panel = el.closest<HTMLElement>('[data-panel]');
  const k = panel ? Number(panel.dataset.panel) - 1 : NaN;
  return Number.isInteger(k) && k >= 0 && k < 4 ? k : -1;
}

/**
 * Wire a home chapter to the store (§9.3). `sectionRef` is the <section>,
 * `stageRef` its `.stage`. <Chapter> calls this; chapters pass `onProgress`
 * and `reveal` through <Chapter>'s props.
 */
export function useChapter(
  id: HomeChapterId,
  sectionRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  opts: UseChapterOptions = {},
): void {
  const reduced = useReducedMotion();
  const layout = useLayoutMode();
  const optsRef = useRef(opts);
  const revealsRef = useRef<Reveal[]>([]);
  useLayoutEffect(() => {
    optsRef.current = opts;
  });

  useGSAP(
    () => {
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage) return;
      const reveals: Reveal[] = [];
      revealsRef.current = reveals;

      const record = (self: ScrollTrigger): void => {
        const r = section.getBoundingClientRect();
        const sticky = isStageSticky(stage);
        const H = store.scroll.H || svhPx();
        store.chapters[id] = {
          top: r.top + window.scrollY,
          height: r.height,
          L: sticky ? Math.max(0, r.height - H) : 0,
          sticky,
          progress: self.progress,
          active: self.isActive,
        };
        registerChapterRects(id, stage);
        resolve(store);
        store.version++;
      };

      ScrollTrigger.create({
        trigger: section,
        start: () => (isStageSticky(stage) ? 'top top' : 'top bottom'),
        end: () => (isStageSticky(stage) ? 'bottom bottom' : 'bottom top'),
        onRefresh: record,
        onUpdate: (self) => {
          const rec = store.chapters[id];
          if (rec) rec.progress = self.progress;
          optsRef.current.onProgress?.(self.progress, self);
        },
        onToggle: (self) => {
          const rec = store.chapters[id];
          if (rec) rec.active = self.isActive;
        },
      });

      const ctx: ChapterContext = {
        id,
        section,
        stage,
        reduced,
        layout,
        isSticky: () => isStageSticky(stage),
        window: (el, from, to) => ({
          trigger: el,
          start: () => (isStageSticky(stage) ? docTop(section) - (from / 100) * viewportH() : FLOW_WINDOW[0]),
          end: () => (isStageSticky(stage) ? docTop(section) - (to / 100) * viewportH() : FLOW_WINDOW[1]),
        }),
        track: (r) => {
          if (r) reveals.push(r);
          return r;
        },
      };
      autoReveals(ctx);
      const cleanup = optsRef.current.reveal?.(ctx);
      requestRefresh();

      return () => {
        if (typeof cleanup === 'function') cleanup();
        reveals.length = 0;
        clearChapterRects(id);
        delete store.chapters[id];
        resolve(store);
        store.version++;
        requestRefresh();
      };
    },
    { scope: sectionRef, dependencies: [reduced, layout], revertOnUpdate: true },
  );

  // Focus-in (§8.1): complete the reveals, scroll to the hold.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;
    const onFocusIn = (e: FocusEvent) => {
      if (isQuietFocus()) return;
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.matches(':focus-visible')) return;
      for (const r of revealsRef.current) r.complete();
      const rec = store.chapters[id];
      if (!rec || !rec.sticky) return; // flow: the browser's own focus scroll is right
      const H = store.scroll.H || window.innerHeight;
      let from = rec.top;
      let to = rec.top + rec.L;
      let target = rec.top + (id in JUMP_OFFSET_VH ? (JUMP_OFFSET_VH[id as keyof typeof JUMP_OFFSET_VH] * H) / 100 : 0);
      const k = id === 'projects' ? panelOf(el) : -1;
      if (k >= 0) {
        const w = (PROJECT_WINDOW_VH * H) / 100;
        target = rec.top + (k + PROJECT_HOLD_Q) * w;
        from = target;
        to = rec.top + (k + 1) * w;
      }
      const y = store.scroll.y;
      if (y >= from - 1 && y <= to + 1) return; // already stuck and readable
      glide(Math.min(target, rec.top + rec.L), { duration: FOCUS_GLIDE_S });
    };
    section.addEventListener('focusin', onFocusIn);
    return () => section.removeEventListener('focusin', onFocusIn);
  }, [id, reduced, sectionRef]);
}
