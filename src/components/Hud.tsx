import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { hud } from '../content/site';
import { onSample, onScrollRefresh } from '../motion/lenis';
import { filmTargetOf, frame, hudSignal, hudSignalAt } from '../scroll/director';
import { store } from '../scroll/store';

/**
 * The band at the bottom of the viewport the HUD needs clear (its 24px inset,
 * the readout and its glow). Stuck stages keep their content above it (their
 * bottom padding is at least this much); `[data-hud-zone]` blocks promise it.
 */
const BAND_PX = 56;
/** §6: S/N is damped over 200 ms. */
const DAMP_S = 0.2;

/**
 * The HUD (SPEC §6): desktop only, aria-hidden, bottom-left — the single
 * readout "S/N 0.03" in .t-micro ink-2 with tabular digits.
 *
 * S/N: `sn = 1 − clamp(.75·(aperture − .04)/.86 + .25·turb/.4, 0, 1)` from
 * the director's latest FieldFrame (director.hudSignal: rest reads 0.03,
 * every hold 1.00), damped over 200 ms and written through a ref at ≤ 10 Hz
 * (a textContent write only when the two-decimal text changes). Until the
 * field has produced a frame (no WebGL, before it is ready) it follows the
 * scroll-derived film target instead, so the readout still tells the story.
 *
 * It only shows while its corner is clear of copy: while a sticky stage is
 * stuck (the stages reserve the bottom band), or while a `[data-hud-zone]`
 * block (the hero, the detail header, the 404) covers the band. Everywhere
 * else — flow chapters, fit-guard fallbacks, reduced motion, over the footer
 * — text scrolls through the corner, so it fades out. The ranges are measured
 * on refresh and resize only; the sampler compares numbers. Hidden without
 * JS, below 600px of height and on the mobile layout.
 */
export default function Hud() {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const el = rootRef.current;
    const valueEl = valueRef.current;
    if (!el || !valueEl) return;

    /** scrollY ranges [from, to] in which the corner is clear. */
    let zones: Array<readonly [number, number]> = [];
    let visible: boolean | null = null;
    let shown = valueEl.textContent ?? hud.initial;
    let sn = Number.parseFloat(shown) || 0;
    let lastT = performance.now() / 1000;

    const measure = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      zones = [];
      for (const stage of document.querySelectorAll<HTMLElement>('.chapter > .stage')) {
        if (getComputedStyle(stage).position !== 'sticky') continue;
        const r = (stage.parentElement as HTMLElement).getBoundingClientRect();
        const top = r.top + y;
        zones.push([top, top + r.height - stage.offsetHeight]); // stuck range
      }
      for (const zone of document.querySelectorAll<HTMLElement>('[data-hud-zone]')) {
        const r = zone.getBoundingClientRect();
        const top = r.top + y;
        zones.push([top - vh + BAND_PX, top + r.height - vh]); // the block covers the band
      }
    };

    const sample = () => {
      const t = performance.now() / 1000;
      const dt = Math.min(0.25, Math.max(0, t - lastT));
      lastT = t;

      const y = store.scroll.y;
      const next = zones.some(([a, b]) => y >= a - 1 && y <= b + 1);
      if (next !== visible) {
        visible = next;
        el.toggleAttribute('data-visible', next);
      }

      // frame.now is the gsap clock of the last rendered frame; 0 = none yet.
      const target = frame.now > 0 ? hudSignal(frame) : hudSignalAt(filmTargetOf(store));
      sn += (target - sn) * (1 - Math.pow(2, (-dt * 5) / DAMP_S));
      const text = (Number.isFinite(sn) ? Math.min(1, Math.max(0, sn)) : 0).toFixed(2);
      if (text !== shown) {
        shown = text;
        valueEl.textContent = text;
      }
    };

    const remeasure = () => {
      measure();
      sample();
    };
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);
    const offRefresh = onScrollRefresh(remeasure);
    measure();
    const offSample = onSample(sample);

    return () => {
      offSample();
      offRefresh();
      ro.disconnect();
    };
  }, [pathname]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="t-micro pointer-events-none fixed bottom-6 left-6 z-30 flex items-baseline gap-[0.75em] text-ink-2 opacity-0 transition-opacity duration-300 ease-ui select-none before:absolute before:-inset-x-6 before:-inset-y-4 before:-z-1 before:bg-[radial-gradient(closest-side,rgb(5_5_7/0.88),rgb(5_5_7/0.6)_55%,transparent)] data-visible:opacity-100 mobile:hidden short:hidden"
    >
      <span>{hud.label}</span>
      <span ref={valueRef} data-hud-value="">
        {hud.initial}
      </span>
    </div>
  );
}
