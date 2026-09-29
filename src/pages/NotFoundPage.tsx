import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { setCharge } from '../chapters/choreo/fx';
import { invalidateField } from '../chapters/choreo/film';
import LinkLabel from '../components/LinkLabel';
import { detail, notFound } from '../content/site';
import { loadGsap, reportLoadError } from '../motion/lazy';
import { isReducedMotion } from '../motion/motionPref';
import { onScrollRefresh } from '../motion/lenis';
import { clearPageRects, registerPageRects } from '../scroll/anchors';
import { enterRoute } from '../scroll/director';
import { store } from '../scroll/store';

/** §6 404: one heartbeat per hover / focus, uBeat 0 → 1 → 0 over 600 ms. */
const BEAT = { up: 0.22, down: 0.38 } as const;
const OWNER = '404';

/**
 * 404 (SPEC §6), code-split. The field draws S10 FLATLINE registered to the
 * [data-field-anchor="S10"] line at 68svh (70svh mobile), 8–92vw, in
 * director route mode at aperture .5 with the loupe on. Text sits at
 * 24–52svh on the page gutter, like every other page (only the line starts
 * at 8vw). The tab title says the page failed: "Page not found — Stephen Webb".
 *
 * DOM baseline: until the field draws S10 (`no-field-s10:`), a 1px hairline
 * stands in for the flatline at the same anchor (the way the chart shows
 * SVG bars).
 *
 * Hovering or focusing (focus-visible) "Back to home" fires ONE heartbeat
 * (`fx.beat` 0 → 1 → 0, 600 ms) and charges the field (`fx.charge` 1): the
 * director racks the aperture .5 → .04, damped over 400 ms — the lost signal
 * sharpens as you head home. Leaving reverts the aperture. Under reduced
 * motion no heartbeat fires (the flat poster, §3.10); the aperture still
 * follows the charge, rendered on demand.
 */
export default function NotFoundPage() {
  const beatRef = useRef<{ kill(): unknown } | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  // The copy's text-safe rect (§2.3), measured on mount, refresh and resize.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = (): void => registerPageRects(root);
    measure();
    window.addEventListener('resize', measure, { passive: true });
    const off = onScrollRefresh(measure);
    return () => {
      window.removeEventListener('resize', measure);
      off();
      clearPageRects();
    };
  }, []);

  useEffect(() => {
    document.title = detail.documentTitle(notFound.title);
  }, []);

  // Route mode (§9.4): S10 FLATLINE.
  useEffect(() => {
    enterRoute(store, '404');
    return () => {
      beatRef.current?.kill();
      beatRef.current = null;
      store.fx.beat = 0;
      setCharge(OWNER, false);
    };
  }, []);

  const heartbeat = (): void => {
    if (isReducedMotion() || store.flags.rewinding) return;
    loadGsap().then(({ gsap }) => {
      beatRef.current?.kill();
      const fx = store.fx;
      beatRef.current = gsap
        .timeline({ onUpdate: invalidateField, onComplete: () => (beatRef.current = null) })
        .fromTo(fx, { beat: 0 }, { beat: 1, duration: BEAT.up, ease: 'out-expo' })
        .to(fx, { beat: 0, duration: BEAT.down, ease: 'ui' });
    }, reportLoadError);
  };
  const on = (): void => {
    setCharge(OWNER, true, 1);
    heartbeat();
  };
  const off = (): void => setCharge(OWNER, false);

  return (
    <section ref={rootRef} aria-labelledby="not-found-title" data-hud-zone className="relative min-h-svh overflow-x-clip">
      <div aria-hidden="true" data-field-anchor="S10" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-(--anchor-flatline-y) left-(--anchor-flatline-x) hidden h-px w-(--anchor-flatline-w) bg-linear-to-r from-transparent via-line-strong to-transparent no-field-s10:block"
      />

      <div className="px-gutter pt-[24svh] pb-[36svh]">
        <div data-safe className="w-fit max-w-full">
          <p className="t-label text-ember">{notFound.label}</p>
          <h1 id="not-found-title" tabIndex={-1} className="t-title mt-5 text-balance text-ink">
            {notFound.title}
          </h1>
          <p className="t-body mt-6 max-w-[40ch] text-ink-2">{notFound.body}</p>
          <Link
            to={notFound.cta.href}
            data-heartbeat=""
            onPointerEnter={(e) => e.pointerType !== 'touch' && on()}
            onPointerLeave={(e) => e.pointerType !== 'touch' && off()}
            onFocus={(e) => e.currentTarget.matches(':focus-visible') && on()}
            onBlur={off}
            className="btn btn-line mt-10 mobile:w-full"
          >
            <LinkLabel cta={notFound.cta} />
          </Link>
        </div>
      </div>
    </section>
  );
}
