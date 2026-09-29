/**
 * /work/:slug — the page's motion and its field (SPEC §6 "Project detail",
 * §6 "Page transitions" steps 4–5, §8.1, §8.2).
 *
 * `useDetailChoreo(rootRef, project, navigate)` wires, on the page's root
 * element (the hooks ProjectDetailPage renders):
 * - the hand-off: when the page was entered from home, `handoff.t` tweens
 *   0 → 1 over 700 ms (expo.inOut) — the emblem keeps its home transform at
 *   the swap and only its anchor travels to the detail anchor
 *   (scroll/detailField.ts does the blend per frame);
 * - the entry: after an in-app transition the header enters with line masks
 *   (the index and the h1, `[data-d-line]`) and fade-ups (`[data-d-up]`) at
 *   350 ms. Hidden from the first paint (a layout effect), so it never
 *   flashes. First loads (prerendered) and reduced motion never animate;
 * - the figure (`[data-detail-figure]`): clip-path inset(10% round 16px) →
 *   inset(0 round 16px) while its top moves from 85% to 35% of the
 *   viewport, scrubbed;
 * - MCP App's spacer (`[data-detail-stage]`): its document top and height,
 *   measured on mount, refresh and resize, feed the constellation re-stage;
 * - "Next project" (`a[data-next-link]`): hover / focus-visible peeks the
 *   field 25% toward the next emblem over 600 ms (director route mode,
 *   `film.override.m`) and brings the emblem halfway back from its scroll
 *   parallax and dimming (`detailFx.restore` .5), so the peek plays where
 *   it can be seen; it reverts on leave; a plain click commits — m → 1
 *   and the emblem back to rest over 1,100 ms (cine) while the DOM exits
 *   (300 ms) — then navigates, so the next page opens on its emblem.
 *
 * Reduced motion (§8.2): no hand-off tween, no entry, no clip scrub, no
 * peek; "Next project" navigates at once. gsap and the reveal helpers are
 * lazy (motion/lazy.ts). Browser-only effects; SSR-safe at import.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { getNextProject, type Project } from '../../content/projects';
import { onScrollRefresh, requestRefresh } from '../../motion/lenis';
import { clearPageRects, registerPageRects } from '../../scroll/anchors';
import { loadGsap, loadReveal, loadScroll, reportLoadError } from '../../motion/lazy';
import { isReducedMotion } from '../../motion/motionPref';
import type { Reveal } from '../../motion/reveal';
import { store } from '../../scroll/store';
import { invalidateField } from '../choreo/film';
import { DETAIL_FIELD, detailFx, handoff } from '../../scroll/detailField.ts';
import { markEntry, ROUTE_FX, takeEntry, takeHandoff } from './route';

/**
 * §6 "Next project": peek 25% over 600 ms; commit over 1,100 ms. The peek
 * also brings the emblem halfway back from its parallaxed, dimmed rest
 * (`detailFx.restore` → .5: back down toward its anchor, α .25 → ≈ .6), so the 25% morph
 * is visible at all; the commit brings it all the way (restore 1).
 */
export const NEXT_FX = { peek: 0.25, peekRestore: 0.5, peekDur: 0.6, commitDur: 1.1 } as const;
/** §6 figure reveal: inset 10% → 0 while its top moves 85% → 35% of the viewport. */
const FIGURE = { from: 'inset(10% 10% 10% 10% round 16px)', to: 'inset(0% 0% 0% 0% round 16px)', start: 'top 85%', end: 'top 35%' };

type Tween = { kill(): unknown };

const plainClick = (e: MouseEvent): boolean =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** Measure MCP App's spacer (refresh / resize time only). */
function measureStage(root: HTMLElement): void {
  const el = root.querySelector<HTMLElement>('[data-detail-stage]');
  if (!el) {
    detailFx.stageTop = -1;
    return;
  }
  const r = el.getBoundingClientRect();
  detailFx.stageTop = r.top + window.scrollY;
  detailFx.stageH = r.height;
}

export function useDetailChoreo(
  rootRef: RefObject<HTMLElement | null>,
  project: Project,
  navigate: (to: string) => void,
): void {
  // The transition flags, consumed once per mount (refs survive StrictMode's
  // effect re-run; a module flag would be gone by the second run).
  const arrival = useRef<{ entry: boolean; handoff: boolean } | null>(null);
  const navRef = useRef(navigate);
  useLayoutEffect(() => {
    navRef.current = navigate;
  });

  // Entry (§6 step 5): hide the header's reveal targets before the first
  // paint when this mount is a transition arrival; the effect below reveals.
  useLayoutEffect(() => {
    arrival.current ??= { entry: takeEntry(), handoff: takeHandoff() };
    const root = rootRef.current;
    if (!root || !arrival.current.entry || isReducedMotion()) return;
    const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-d-line]'));
    const ups = Array.from(root.querySelectorAll<HTMLElement>('[data-d-up]'));
    const targets = [...lines, ...ups];
    for (const el of targets) el.style.opacity = '0';
    let alive = true;
    const reveals: Reveal[] = [];
    const show = (): void => {
      for (const el of targets) el.style.opacity = '';
    };
    Promise.all([loadScroll(), loadReveal()]).then(
      ([, rv]) => {
        if (!alive) return;
        const at = (el: HTMLElement) => ({ trigger: el, start: 'top bottom' });
        lines.forEach((el, i) => {
          const r = rv.lineMask(el, { window: at(el), scrub: false, delay: ROUTE_FX.entryDelay + i * 0.09 });
          el.style.opacity = '';
          if (r) reveals.push(r);
        });
        if (ups.length) {
          const r = rv.fadeUp(ups, { window: at(ups[0]), scrub: false, delay: ROUTE_FX.entryDelay });
          if (r) reveals.push(r);
        }
        show();
      },
      (e: unknown) => {
        show();
        reportLoadError(e);
      },
    );
    return () => {
      alive = false;
      for (const r of reveals) r.revert();
      show();
    };
  }, [rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = isReducedMotion();
    const next = getNextProject(project.slug);
    const cleanups: Array<() => void> = [];
    let alive = true;
    let gsapP: ReturnType<typeof loadGsap> | null = null;
    const withGsap = (fn: (g: Awaited<ReturnType<typeof loadGsap>>['gsap']) => void): void => {
      gsapP ??= loadGsap();
      gsapP.then(({ gsap }) => alive && fn(gsap), reportLoadError);
    };

    // ── The hand-off (§6 step 4) ──────────────────────────────────────────
    detailFx.restore = 0;
    let handoffTween: Tween | null = null;
    if (arrival.current?.handoff && !reduced) {
      handoff.t = 0; // hold the home transform until the tween runs
      withGsap((gsap) => {
        handoffTween = gsap.fromTo(handoff, { t: 0 }, {
          t: 1,
          duration: DETAIL_FIELD.handoffS,
          ease: 'expo.inOut',
          onUpdate: invalidateField,
        });
      });
    } else {
      handoff.t = 1;
    }
    cleanups.push(() => {
      handoffTween?.kill();
      handoff.t = 1;
      detailFx.restore = 0;
    });

    // ── MCP App spacer (the constellation re-stage) + the text-safe rects ─
    const measure = (): void => {
      measureStage(root);
      registerPageRects(root);
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });
    cleanups.push(onScrollRefresh(measure));
    cleanups.push(() => {
      window.removeEventListener('resize', measure);
      detailFx.stageTop = -1;
      clearPageRects();
    });

    // ── The figure's clip reveal (scrubbed) ───────────────────────────────
    const figure = root.querySelector<HTMLElement>('[data-detail-figure]');
    if (figure && !reduced) {
      loadScroll().then(({ gsap }) => {
        if (!alive) return;
        const gctx = gsap.context(() => {
          gsap.fromTo(
            figure,
            { clipPath: FIGURE.from },
            {
              clipPath: FIGURE.to,
              ease: 'none',
              scrollTrigger: { trigger: figure, start: FIGURE.start, end: FIGURE.end, scrub: true },
            },
          );
        }, root);
        cleanups.push(() => gctx.revert());
        requestRefresh();
      }, reportLoadError);
    }

    // ── Next project: peek and commit ─────────────────────────────────────
    const link = root.querySelector<HTMLAnchorElement>('a[data-next-link]');
    let peekTween: Tween | null = null;
    let committing = false;
    const override = () => {
      const o = store.film.override;
      return o && store.route.kind === 'detail' && o.a === project.emblem && o.b === next.emblem ? o : null;
    };
    const peek = (on: boolean): void => {
      if (reduced || committing) return;
      withGsap((gsap) => {
        const o = override();
        if (!o || committing) return;
        o.snap = true; // the tween is the motion: no extra damp
        peekTween?.kill();
        const tl = gsap.timeline({ onUpdate: invalidateField, defaults: { duration: NEXT_FX.peekDur, ease: 'ui' } });
        tl.to(o, { m: on ? NEXT_FX.peek : 0 }, 0);
        tl.to(detailFx, { restore: on ? NEXT_FX.peekRestore : 0 }, 0);
        peekTween = tl;
      });
    };
    const onEnter = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') peek(true);
    };
    const onLeave = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') peek(false);
    };
    const onFocus = (): void => {
      if (link?.matches(':focus-visible')) peek(true);
    };
    const onBlur = (): void => peek(false);
    const onClick = (e: MouseEvent): void => {
      if (!link || e.defaultPrevented || !plainClick(e) || reduced || committing) return;
      e.preventDefault();
      committing = true;
      markEntry();
      const to = `/work/${next.slug}`;
      const go = (): void => {
        if (alive) navRef.current(to);
      };
      withGsap((gsap) => {
        peekTween?.kill();
        const o = override();
        const parts = Array.from(document.getElementById('main')?.children ?? []);
        const tl = gsap.timeline({ onComplete: go, onUpdate: invalidateField });
        if (o) {
          o.snap = true;
          tl.to(o, { m: 1, duration: NEXT_FX.commitDur, ease: 'cine' }, 0);
        }
        tl.to(detailFx, { restore: 1, duration: NEXT_FX.commitDur, ease: 'cine' }, 0);
        if (parts.length) tl.to(parts, { opacity: 0, y: ROUTE_FX.exit.y, duration: ROUTE_FX.exit.dur, ease: 'in-expo' }, 0);
        tl.set({}, {}, NEXT_FX.commitDur);
        cleanups.push(() => tl.kill());
      });
    };
    if (link) {
      link.addEventListener('pointerenter', onEnter);
      link.addEventListener('pointerleave', onLeave);
      link.addEventListener('focus', onFocus);
      link.addEventListener('blur', onBlur);
      link.addEventListener('click', onClick);
      cleanups.push(() => {
        link.removeEventListener('pointerenter', onEnter);
        link.removeEventListener('pointerleave', onLeave);
        link.removeEventListener('focus', onFocus);
        link.removeEventListener('blur', onBlur);
        link.removeEventListener('click', onClick);
        peekTween?.kill();
      });
    }

    return () => {
      alive = false;
      for (const fn of cleanups.splice(0)) fn();
    };
  }, [rootRef, project]);
}
