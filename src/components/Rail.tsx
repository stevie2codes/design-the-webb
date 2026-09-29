import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { rail } from '../content/site';
import { onSample, scrollLimit } from '../motion/lenis';
import { activeJumpIndex, jumpTargets, jumpToChapter } from '../scroll/jump';
import { store } from '../scroll/store';

/** Rail ticks sit evenly on the track; the fill maps scroll piecewise onto them. */
const LAST = rail.length - 1;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Progress rail (SPEC §6), home only.
 * - Desktop: a 1px line-strong track on the right edge, 40vh tall, 24px in,
 *   vertically centred, with five tick buttons ("Go to title" … "Go to
 *   Contact") whose labels appear on hover/focus. The ember fill reaches tick
 *   k exactly when the page reaches chapter k's hold start.
 * - Mobile (and short landscape screens): a 2px ember progress bar under the nav.
 *
 * Ticks jump with the §4.4 policy (glide within 2 film states, else a jump
 * cut; instant under reduced motion) and move focus to the chapter heading.
 * Hidden without JS: the ticks are buttons and the fill is scripted.
 *
 * Driven by the store at ≤ 10 Hz (motion/lenis.ts onSample): transforms and
 * attributes through refs, no React render and no layout reads per sample.
 * Targets are the chapters' hold starts from `store.chapters` (measured on
 * refresh); a 100 ms linear transition smooths the fill between samples.
 */
export default function Rail() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!onHome) return;
    const targets: number[] = [];
    let version = -1;
    let active = -1;
    let lastFill = -1;
    let lastBar = -1;

    const setActive = (k: number) => {
      if (k === active) return;
      const prev = tickRefs.current[active];
      prev?.removeAttribute('data-active');
      prev?.removeAttribute('aria-current');
      const next = tickRefs.current[k];
      next?.setAttribute('data-active', '');
      next?.setAttribute('aria-current', 'true');
      active = k;
    };

    const sample = () => {
      if (store.version !== version) {
        version = store.version;
        jumpTargets(store, targets);
      }
      const y = store.scroll.y;
      const max = scrollLimit();
      const docP = max > 0 ? clamp01(y / max) : 0;

      let p = docP;
      const k = activeJumpIndex(y, targets);
      if (k >= 0) {
        p = k === LAST ? 1 : (k + clamp01((y - targets[k]) / (targets[k + 1] - targets[k]))) / LAST;
      }
      // Round to 1/1000 so an idle page writes nothing.
      const fill = Math.round(p * 1000) / 1000;
      const bar = Math.round(docP * 1000) / 1000;
      if (fill !== lastFill && fillRef.current) {
        lastFill = fill;
        fillRef.current.style.transform = `scaleY(${fill})`;
      }
      if (bar !== lastBar && barRef.current) {
        lastBar = bar;
        barRef.current.style.transform = `scaleX(${bar})`;
      }
      setActive(k);
    };

    const off = onSample(sample);
    return () => {
      off();
      setActive(-1);
    };
  }, [onHome]);

  if (!onHome) return null;

  return (
    <>
      {/* Desktop rail */}
      <div className="fixed top-1/2 right-6 z-30 h-[40vh] w-px -translate-y-1/2 mobile:hidden short:hidden nojs:hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-line-strong">
          <div
            ref={fillRef}
            className="absolute inset-0 origin-top bg-ember transition-transform duration-100 ease-linear rm:transition-none"
            style={{ transform: 'scaleY(0)' }}
          />
        </div>
        {rail.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              tickRefs.current[i] = el;
            }}
            type="button"
            aria-label={item.ariaLabel}
            onClick={() => jumpToChapter(item.id)}
            className="group/tick absolute left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center focus-visible:outline-offset-[-4px]"
            style={{ top: `${(i / LAST) * 100}%` }}
          >
            <span
              aria-hidden="true"
              className="h-px w-2.5 bg-ink-2 transition-[background-color,scale] duration-240 ease-ui group-hover/tick:bg-ink group-focus-visible/tick:bg-ink group-data-[active]/tick:scale-x-160 group-data-[active]/tick:bg-ember"
            />
            <span
              aria-hidden="true"
              className="t-label pointer-events-none absolute top-1/2 right-full -translate-y-1/2 rounded-pill bg-void/85 px-2.5 py-1 whitespace-nowrap text-ink opacity-0 transition-opacity duration-240 ease-ui group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100"
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Mobile progress bar, under the 56px nav (above its scrim). Also on
          short screens (landscape phones), where a 40vh rail would crowd the
          copy; there it sits under the 64px desktop nav. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-14 z-40 hidden h-0.5 mobile:block short:block desktop:short:top-16 nojs:hidden"
      >
        <div
          ref={barRef}
          className="h-full origin-left bg-ember transition-transform duration-100 ease-linear rm:transition-none"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
    </>
  );
}
