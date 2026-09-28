import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { useLocation } from 'react-router-dom';
import { hud } from '../content/site';

/** Imperative handle: the field writes the readout through it (≤ 10 Hz). */
export interface HudHandle {
  /** Signal-to-noise in [0, 1]; shown with two decimals ("0.03" … "1.00"). */
  setSignal: (sn: number) => void;
}

export interface HudProps {
  ref?: Ref<HudHandle>;
}

/**
 * The band at the bottom of the viewport the HUD needs clear (its 24px inset,
 * the readout and its glow). Stuck stages keep their content above it (their
 * bottom padding is at least this much); `[data-hud-zone]` blocks promise it.
 */
const BAND_PX = 56;

/**
 * The HUD (SPEC §6): desktop only, aria-hidden, bottom-left — the single
 * readout "S/N 0.03" in .t-micro ink-2 with tabular digits. Static in the DOM
 * baseline; the field phase computes sn from aperture and turbulence, damps it
 * over 200 ms and writes it through `ref.setSignal` (a textContent write, never
 * React state). The value element is also tagged [data-hud-value].
 *
 * It only shows while its corner is clear of copy: while a sticky stage is
 * stuck (the stages reserve the bottom band), or while a `[data-hud-zone]`
 * block (the hero, the detail header, the 404) covers the band. Everywhere
 * else — flow chapters, fit-guard fallbacks, reduced motion, over the footer
 * — text scrolls through the corner, so it fades out. Scroll ranges are
 * measured on resize only; the scroll handler compares numbers (no layout
 * reads per frame). Hidden without JS, below 600px of height and on the
 * mobile layout.
 */
export default function Hud({ ref }: HudProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const shown = useRef<string>(hud.initial);
  const { pathname } = useLocation();

  useImperativeHandle(
    ref,
    () => ({
      setSignal(sn: number) {
        const text = (Number.isFinite(sn) ? Math.min(1, Math.max(0, sn)) : 0).toFixed(2);
        if (text === shown.current || !valueRef.current) return;
        shown.current = text;
        valueRef.current.textContent = text;
      },
    }),
    [],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    /** scrollY ranges [from, to] in which the corner is clear. */
    let zones: Array<readonly [number, number]> = [];
    let visible: boolean | null = null;
    let raf = 0;

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
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const next = zones.some(([a, b]) => y >= a - 1 && y <= b + 1);
      if (next === visible) return;
      visible = next;
      el.toggleAttribute('data-visible', next);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const ro = new ResizeObserver(() => {
      measure();
      onScroll();
    });
    ro.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    measure();
    update();

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
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
