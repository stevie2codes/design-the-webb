import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { hud } from '../content/site';
import { onSample, onScrollRefresh } from '../motion/lenis';
import { store } from '../scroll/store';
import { createSignal } from './signal';

/**
 * The band at the bottom of the viewport the HUD needs clear (its 24px inset,
 * the readout and its glow). Stuck stages keep their content above it (their
 * bottom padding is at least this much); `[data-hud-zone]` blocks promise it.
 */
const BAND_PX = 56;

/**
 * The HUD (SPEC §6): desktop only, aria-hidden, bottom-left — the single
 * readout "S/N 0.03" in .t-micro ink-2 with tabular digits.
 *
 * S/N comes from createSignal (./signal.ts), written through a ref at
 * ≤ 10 Hz (a textContent write only when the two-decimal text changes).
 *
 * It only shows while its corner is clear of copy: while a sticky stage is
 * stuck (the stages reserve the bottom band), or while a `[data-hud-zone]`
 * block (the hero, the detail header, the 404) covers the band. Everywhere
 * else — flow chapters, fit-guard fallbacks, reduced motion, over the footer
 * — text scrolls through the corner, so it fades out. A stage that shows its
 * own readout (`[data-hud-local]`, the hero's S/N meter, while displayed)
 * is not a zone: one readout at a time. The ranges are measured
 * on refresh and resize only; the sampler compares numbers. Hidden without
 * JS, below 600px of height and on the mobile layout.
 */
/** The block shows its own S/N readout right now (a displayed `[data-hud-local]`). Refresh only. */
function ownsReadout(block: Element): boolean {
  const own = block.querySelector('[data-hud-local]');
  return own !== null && getComputedStyle(own).display !== 'none';
}

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
    const signal = createSignal(Number.parseFloat(shown) || 0);

    const measure = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      zones = [];
      for (const stage of document.querySelectorAll<HTMLElement>('.chapter > .stage')) {
        if (getComputedStyle(stage).position !== 'sticky' || ownsReadout(stage)) continue;
        const r = (stage.parentElement as HTMLElement).getBoundingClientRect();
        const top = r.top + y;
        zones.push([top, top + r.height - stage.offsetHeight]); // stuck range
      }
      for (const zone of document.querySelectorAll<HTMLElement>('[data-hud-zone]')) {
        if (ownsReadout(zone)) continue;
        const r = zone.getBoundingClientRect();
        const top = r.top + y;
        zones.push([top - vh + BAND_PX, top + r.height - vh]); // the block covers the band
      }
    };

    const sample = () => {
      const y = store.scroll.y;
      const next = zones.some(([a, b]) => y >= a - 1 && y <= b + 1);
      if (next !== visible) {
        visible = next;
        el.toggleAttribute('data-visible', next);
      }

      const text = signal().toFixed(2);
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
      className="t-micro pointer-events-none fixed bottom-6 left-6 z-30 flex items-baseline gap-[0.75em] text-ink-2 opacity-0 transition-opacity duration-300 ease-ui select-none before:absolute before:-inset-x-6 before:-inset-y-4 before:-z-1 before:bg-[radial-gradient(closest-side,rgb(var(--void-rgb)/0.88),rgb(var(--void-rgb)/0.6)_55%,transparent)] data-visible:opacity-100 mobile:hidden short:hidden"
    >
      <span>{hud.label}</span>
      <span ref={valueRef} data-hud-value="">
        {hud.initial}
      </span>
    </div>
  );
}
