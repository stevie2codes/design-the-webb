import { useEffect, useRef } from 'react';
import { cursorLabels } from '../content/site';
import { loadGsap, reportLoadError, type GsapModule } from '../motion/lazy';
import { getMotionPref, subscribeMotionPref } from '../motion/motionPref';

/** Follow damping per 60 Hz frame, dt-corrected (§6: .18). */
const FOLLOW = 0.18;
/** Where the ring hides: reading text, the beacon CTA disc, and form controls. */
const HIDE_SELECTOR = '[data-cursor="text"], [data-cursor="hide"], input, textarea, select, [contenteditable="true"]';
const FINE_POINTER = '(pointer: fine)';

type Mode = 'idle' | 'open' | 'live' | 'hide';

function modeFor(target: EventTarget | null): Mode {
  if (!(target instanceof Element)) return 'idle';
  const tagged = target.closest<HTMLElement>('[data-cursor]');
  const hidden = target.closest(HIDE_SELECTOR);
  // The nearest tag wins: a label link inside a text block still shows "Open".
  if (tagged && (!hidden || hidden.contains(tagged))) {
    const v = tagged.dataset.cursor;
    if (v === 'open' || v === 'live') return v;
    if (v === 'text' || v === 'hide') return 'hide';
  }
  return hidden ? 'hide' : 'idle';
}

/**
 * The cursor ring (SPEC §6). The native cursor is always kept: this is a
 * 24px ring (1px bone at .28) that follows a fine pointer with damping .18,
 * grows to 56px with a `.t-micro` label ("Open" / "Live") over
 * `[data-cursor="open" | "live"]`, and hides over `[data-cursor="text"]`,
 * `[data-cursor="hide"]` and form controls. Fine pointer + full motion only;
 * nothing magnetic.
 *
 * Position is a transform written in a gsap ticker callback (skipped once
 * settled; gsap is lazy-loaded on first enable, §8.5); mode changes are
 * attribute writes. No React state, aria-hidden, pointer-events none, z 70.
 */
export default function CursorRing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const label = labelRef.current;
    if (!root || !label) return;

    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia(FINE_POINTER);
    } catch {
      mql = null;
    }

    let active = false;
    let alive = true;
    let ticker: GsapModule['gsap']['ticker'] | null = null;
    let seen = false;
    let mode: Mode = 'idle';
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;

    const setMode = (next: Mode) => {
      if (next === mode) return;
      mode = next;
      root.dataset.mode = next;
      if (next === 'open' || next === 'live') label.textContent = cursorLabels[next];
    };

    const tick = (_time: number, deltaMs: number) => {
      const dx = tx - x;
      const dy = ty - y;
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return;
      const k = 1 - Math.pow(1 - FOLLOW, Math.min(deltaMs, 100) / (1000 / 60));
      x += dx * k;
      y += dy * k;
      root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX;
      ty = e.clientY;
      if (!seen) {
        seen = true;
        x = tx;
        y = ty;
        root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        root.dataset.visible = '';
      }
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') setMode(modeFor(e.target));
    };
    const onLeave = (e: PointerEvent) => {
      if (e.relatedTarget) return; // still inside the document
      seen = false;
      delete root.dataset.visible;
    };
    const onBlur = () => {
      seen = false;
      delete root.dataset.visible;
    };

    const enable = () => {
      if (active) return;
      active = true;
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerover', onOver, { passive: true });
      document.documentElement.addEventListener('pointerout', onLeave, { passive: true });
      window.addEventListener('blur', onBlur);
      if (ticker) ticker.add(tick);
      else
        loadGsap().then(({ gsap }) => {
          ticker = gsap.ticker;
          if (alive && active) ticker.add(tick);
        }, reportLoadError);
    };
    const disable = () => {
      if (!active) return;
      active = false;
      seen = false;
      delete root.dataset.visible;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.documentElement.removeEventListener('pointerout', onLeave);
      window.removeEventListener('blur', onBlur);
      ticker?.remove(tick);
    };
    const sync = () => {
      if ((mql?.matches ?? false) && getMotionPref() === 'full') enable();
      else disable();
    };

    sync();
    mql?.addEventListener('change', sync);
    const offMotion = subscribeMotionPref(sync);
    return () => {
      alive = false;
      mql?.removeEventListener('change', sync);
      offMotion();
      disable();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-mode="idle"
      className="group/cursor pointer-events-none fixed top-0 left-0 z-70 opacity-0 transition-opacity duration-240 ease-ui select-none nojs:hidden rm:hidden [&[data-visible]:not([data-mode=hide])]:opacity-100"
    >
      {/* 24px ring (size-6), 56px (size-14) with its label over open / live targets. */}
      <div className="absolute top-0 left-0 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[rgb(242_238_230/0.28)] transition-[width,height,background-color] duration-240 ease-ui group-data-[mode=live]/cursor:size-14 group-data-[mode=live]/cursor:bg-void/40 group-data-[mode=open]/cursor:size-14 group-data-[mode=open]/cursor:bg-void/40">
        <span
          ref={labelRef}
          className="t-micro text-ink uppercase opacity-0 transition-opacity duration-180 ease-ui group-data-[mode=live]/cursor:opacity-100 group-data-[mode=open]/cursor:opacity-100"
        >
          {cursorLabels.open}
        </span>
      </div>
    </div>
  );
}
