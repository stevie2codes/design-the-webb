import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { rail } from '../content/site';
import { chapterTarget, jumpToChapter } from '../scroll/jump';

/**
 * Published on <html> while home is mounted: the chapter whose hold the page
 * has reached ("top" … "contact"). Nav styles its active dot from it.
 */
const ACTIVE_ATTR = 'data-active-chapter';

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
 * Hidden without JS: the ticks are buttons and the fill is scripted.
 *
 * One passive scroll listener, rAF-throttled, writes transforms and
 * attributes through refs: no React render per frame. Chapter targets are
 * re-measured only when the document resizes (ResizeObserver on <body>).
 */
export default function Rail() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (!onHome) return;

    let targets: number[] = [];
    let maxScroll = 1;
    let active = -1;
    let raf = 0;

    const measure = () => {
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      const raw = rail.map((item) => chapterTarget(item.id));
      if (raw.some((t) => t === null)) {
        targets = []; // home is still rendering
        return;
      }
      // Monotonic and reachable, so every tick can be reached by the fill.
      targets = [];
      for (let i = 0; i < raw.length; i++) {
        const prev = i === 0 ? -1 : targets[i - 1];
        targets.push(Math.max(prev + 1, Math.min(raw[i] as number, maxScroll)));
      }
    };

    const setActive = (k: number) => {
      if (k === active) return;
      const prev = tickRefs.current[active];
      prev?.removeAttribute('data-active');
      prev?.removeAttribute('aria-current');
      const next = tickRefs.current[k];
      next?.setAttribute('data-active', '');
      next?.setAttribute('aria-current', 'true');
      if (k >= 0) root.setAttribute(ACTIVE_ATTR, rail[k].id);
      else root.removeAttribute(ACTIVE_ATTR);
      active = k;
    };

    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const docP = clamp01(y / maxScroll);
      if (barRef.current) barRef.current.style.transform = `scaleX(${docP})`;

      let p = docP;
      let k = -1;
      if (targets.length === rail.length) {
        k = 0;
        for (let i = 1; i <= LAST; i++) if (y >= targets[i] - 2) k = i;
        p = k === LAST ? 1 : (k + clamp01((y - targets[k]) / (targets[k + 1] - targets[k]))) / LAST;
      }
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
      setActive(k);
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
      setActive(-1);
    };
  }, [onHome]);

  if (!onHome) return null;

  return (
    <>
      {/* Desktop rail */}
      <div className="fixed top-1/2 right-6 z-30 h-[40vh] w-px -translate-y-1/2 mobile:hidden short:hidden nojs:hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-line-strong">
          <div ref={fillRef} className="absolute inset-0 origin-top bg-ember" style={{ transform: 'scaleY(0)' }} />
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
        <div ref={barRef} className="h-full origin-left bg-ember" style={{ transform: 'scaleX(0)' }} />
      </div>
    </>
  );
}
