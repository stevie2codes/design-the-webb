/**
 * The scroll runtime (SPEC §4.4, §7.6, §8.2, §9.5, §9.10): Lenis, the
 * ScrollTrigger wiring, the scrollTo helpers and the ≤ 10 Hz sampler.
 *
 * A LAZY CHUNK (§8.5 initial JS budget). Import the public API from
 * motion/lenis.ts (the facade in the initial bundle), never from here: the
 * facade loads this module after hydration (`loadScroll()`) and delegates to
 * it; until it has loaded, the facade's helpers scroll natively.
 *
 * - One Lenis instance (full motion only; none at all under reduced motion,
 *   where a passive native `scroll` listener feeds the store instead). Its
 *   raf runs FIRST in every gsap tick (`gsap.ticker.add(lenisRaf, false,
 *   true)`), and its `scroll` event writes `store.scroll.y / vel` and calls
 *   `ScrollTrigger.update()`, so DOM scrubs and chapter `onUpdate`s land
 *   before the engine's renderFrame reads the store (CONTRACTS.md tick order).
 * - Viewport (`store.scroll.W / H`, H = 100svh), layout and mode are written
 *   on init, resize and refresh only. Every ScrollTrigger refresh re-measures
 *   the footer (the sink horizon), re-resolves the segments and bumps
 *   `store.version`.
 * - Refresh points (§9.10): fonts ready (and every later `loadingdone`),
 *   window `load`, every home mount (useChapter), motion / layout switches.
 * - QA (§12): `?film=<F>` pins the film at init; `window.__lenis` in dev or
 *   with `?debug`.
 *
 * Ref-counted (acquire / release), so StrictMode's double effect never
 * re-creates Lenis. Browser only.
 */
import Lenis, { type LenisOptions } from 'lenis';
import { exposeGlobal, getDebugParams } from '../debugParams';
import { svhPx } from '../scroll/anchors';
import { filmOverride, snapFilm } from '../scroll/director';
import { resolve } from '../scroll/segments';
import { store } from '../scroll/store';
import { DUR, EASE, gsap, ScrollTrigger } from './gsap';
import {
  emitRefresh,
  emitScroll,
  GLIDE_S,
  JUMP_CUT_FADE,
  jumpCutOverlay,
  runSamplers,
  samplerCount,
  subscribeScroll,
  type GlideOptions,
  type JumpCutOptions,
} from './lenis';
import { getMotionPref, subscribeMotionPref, type MotionPref } from './motionPref';
import { getLayoutMode, subscribeLayoutMode } from './useLayoutMode';

export { gsap, ScrollTrigger };

/**
 * §7.6. `respectReducedMotion: false` because the site resolves reduced
 * motion itself (OS setting + the footer toggle) and runs no Lenis at all
 * then; Lenis's own OS check would otherwise override a visitor who chose
 * "Full" on a reduced-motion OS.
 */
export const LENIS_OPTIONS: Readonly<LenisOptions> = {
  lerp: 0.085,
  smoothWheel: true,
  wheelMultiplier: 0.9,
  syncTouch: false,
  autoRaf: false,
  anchors: false,
  respectReducedMotion: false,
};

const noop = (): void => {};

let lenis: Lenis | null = null;
let unexposeLenis: () => void = noop;

/** The live Lenis instance (null under reduced motion or before start). */
export const getLenis = (): Lenis | null => lenis;
/** Whether scroll is smoothed by Lenis right now (full motion). */
export const isSmooth = (): boolean => lenis !== null;

function onLenisScroll(l: Lenis): void {
  store.scroll.y = l.animatedScroll;
  store.scroll.vel = l.velocity;
  ScrollTrigger.update();
  emitScroll();
}

/** Prioritized ticker listener: runs before every other gsap tick callback. */
const lenisRaf = (time: number): void => {
  lenis?.raf(time * 1000);
};

function onNativeScroll(): void {
  store.scroll.y = window.scrollY;
  store.scroll.vel = 0;
  emitScroll();
}

// ---------------------------------------------------------------------------
// Measurement (init / resize / refresh only).

let limit = 0;

/** Maximum scrollY (cached on refresh; Lenis's own when it runs). */
export function scrollLimit(): number {
  return lenis ? lenis.limit : limit;
}

function measureViewport(): void {
  store.scroll.W = window.innerWidth; // the vw basis (includes a classic scrollbar, like CSS vw)
  store.scroll.H = svhPx() || window.innerHeight;
}

/** C6 is not a <Chapter>, but its top is the beacon's sink horizon (§5 C5/C6). */
function measureFooter(): void {
  const el = document.querySelector<HTMLElement>('#main ~ footer');
  if (!el) {
    delete store.chapters.footer;
    return;
  }
  const r = el.getBoundingClientRect();
  const prev = store.chapters.footer;
  store.chapters.footer = {
    top: r.top + window.scrollY,
    height: r.height,
    L: 0,
    sticky: false,
    progress: prev?.progress ?? 0,
    active: prev?.active ?? false,
  };
}

function onRefreshInit(): void {
  measureViewport();
}

function onRefreshed(): void {
  measureFooter();
  limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  resolve(store);
  store.version++;
  store.scroll.y = lenis ? lenis.animatedScroll : window.scrollY;
  emitRefresh();
  emitScroll();
  runSamplers();
}

let refreshRaf = 0;

/**
 * Schedule one `ScrollTrigger.refresh()` two frames from now (coalesced), so
 * the layout that caused it (a mount, html.rm, a fit-guard flip, fonts) has
 * settled. ScrollTrigger itself defers a refresh requested mid-scroll to the
 * scroll end.
 */
export function requestRefresh(): void {
  if (refreshRaf) return;
  refreshRaf = requestAnimationFrame(() => {
    refreshRaf = requestAnimationFrame(() => {
      refreshRaf = 0;
      ScrollTrigger.refresh();
    });
  });
}

function onResize(): void {
  measureViewport(); // ScrollTrigger refreshes itself 200 ms later if the width changed
}

// ---------------------------------------------------------------------------
// Lenis lifecycle and the motion mode (§8.2).

let nativeOn = false;

function attachNative(): void {
  if (nativeOn) return;
  nativeOn = true;
  window.addEventListener('scroll', onNativeScroll, { passive: true });
}

function detachNative(): void {
  if (!nativeOn) return;
  nativeOn = false;
  window.removeEventListener('scroll', onNativeScroll);
}

function createLenis(): void {
  if (lenis) return;
  const l = new Lenis(LENIS_OPTIONS);
  l.on('scroll', onLenisScroll);
  l.on('virtual-scroll', onUserScroll);
  lenis = l;
  gsap.ticker.add(lenisRaf, false, true);
  unexposeLenis = exposeGlobal('__lenis', l);
}

function destroyLenis(): void {
  if (!lenis) return;
  gsap.ticker.remove(lenisRaf);
  lenis.destroy();
  lenis = null;
  unexposeLenis();
  unexposeLenis = noop;
}

/**
 * §8.2 step 2 (and 3–4): Lenis only under full motion. html.rm has already
 * flipped (motionPref toggles it before notifying); chapters rebuild their
 * gsap contexts from `useReducedMotion()`, then the refresh re-measures.
 * The engine's `setMode` is the field host's job (step 5).
 */
function applyMotion(pref: MotionPref): void {
  cut?.kill();
  cut = null;
  const overlay = jumpCutOverlay();
  if (overlay) overlay.style.opacity = '0';
  endRewind();
  if (pref === 'reduced') {
    destroyLenis();
    attachNative();
  } else {
    detachNative();
    createLenis();
  }
  if (store.mode === 'full' || store.mode === 'reduced') store.mode = pref;
  store.scroll.y = window.scrollY;
  store.scroll.vel = 0;
  restartSampler();
  requestRefresh();
}

function applyLayout(): void {
  store.layout = getLayoutMode();
  measureViewport();
  requestRefresh();
}

/** QA (§12, CONTRACTS.md): `?film=<F>` pins the displayed film position; no intro. */
function applyQaParams(): void {
  const q = getDebugParams();
  if (q.film === null) return;
  store.film.override = filmOverride(q.film, true);
  store.flags.intro = false;
}

let running = false;
let refs = 0;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
const offs: Array<() => void> = [];

function start(): void {
  running = true;
  gsap.ticker.lagSmoothing(0);
  measureViewport();
  store.layout = getLayoutMode();
  applyQaParams();
  applyMotion(getMotionPref());
  offs.push(subscribeMotionPref(applyMotion), subscribeLayoutMode(applyLayout));

  ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
  ScrollTrigger.addEventListener('refresh', onRefreshed);
  offs.push(() => {
    ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
    ScrollTrigger.removeEventListener('refresh', onRefreshed);
  });

  window.addEventListener('resize', onResize, { passive: true });
  offs.push(() => window.removeEventListener('resize', onResize));

  // Refresh points (§9.10).
  const fonts = document.fonts;
  if (fonts) {
    let alive = true;
    fonts.ready.then(() => alive && requestRefresh(), noop);
    fonts.addEventListener('loadingdone', requestRefresh);
    offs.push(() => {
      alive = false;
      fonts.removeEventListener('loadingdone', requestRefresh);
    });
  }
  if (document.readyState !== 'complete') {
    window.addEventListener('load', requestRefresh, { once: true });
    offs.push(() => window.removeEventListener('load', requestRefresh));
  }
  requestRefresh();
}

function stop(): void {
  running = false;
  while (offs.length) offs.pop()?.();
  cut?.kill();
  cut = null;
  endRewind();
  destroyLenis();
  detachNative();
  cancelAnimationFrame(refreshRaf);
  refreshRaf = 0;
  restartSampler();
}

/** Take a reference on the scroll infrastructure (starts it on the first). */
export function acquire(): void {
  refs++;
  if (stopTimer !== null) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (!running) start();
}

/** Drop a reference; the last release stops it after one macrotask unless re-acquired (StrictMode-safe). */
export function release(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0 || !running || stopTimer !== null) return;
  stopTimer = setTimeout(() => {
    stopTimer = null;
    if (refs === 0 && running) stop();
  }, 0);
}

// ---------------------------------------------------------------------------
// scrollTo helpers (§4.4). Documented on the facade (motion/lenis.ts).

let expoInOut: ((t: number) => number) | null = null;
const easeInOut = (): ((t: number) => number) => (expoInOut ??= gsap.parseEase(EASE.inOutExpo));

export function scrollInstant(y: number): void {
  if (lenis) {
    if (lenis.isScrolling) {
      lenis.stop(); // resets the running animation
      lenis.start();
    }
    lenis.scrollTo(y, { immediate: true, force: true });
    store.scroll.y = lenis.animatedScroll;
  } else {
    window.scrollTo(0, y);
    store.scroll.y = window.scrollY;
  }
  store.scroll.vel = 0;
  ScrollTrigger.update();
  emitScroll();
}

export function glide(y: number, opts: GlideOptions = {}): void {
  if (!lenis) {
    scrollInstant(y);
    opts.onComplete?.();
    return;
  }
  endRewind();
  lenis.scrollTo(y, {
    duration: opts.duration ?? GLIDE_S,
    easing: easeInOut(),
    force: true,
    onComplete: () => opts.onComplete?.(),
  });
}

let cut: gsap.core.Timeline | null = null;

export function jumpCut(y: number, opts: JumpCutOptions = {}): void {
  cut?.kill();
  cut = null;
  if (!lenis) {
    scrollInstant(y);
    snapFilm(store);
    opts.onCut?.();
    return;
  }
  endRewind();
  const o = jumpCutOverlay();
  const tl = gsap.timeline({
    onComplete: () => {
      if (cut === tl) cut = null;
    },
  });
  if (o) tl.to(o, { opacity: 1, duration: JUMP_CUT_FADE.in, ease: EASE.none, overwrite: true });
  else tl.to({}, { duration: JUMP_CUT_FADE.in });
  tl.call(() => {
    scrollInstant(y);
    snapFilm(store);
    opts.onCut?.();
  });
  if (o) tl.to(o, { opacity: 0, duration: JUMP_CUT_FADE.out, ease: EASE.none });
  cut = tl;
}

// Rewind (§4.4): Back to top plays the whole film backward.

let rewindTimer: ReturnType<typeof setTimeout> | null = null;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

function onRewindKey(e: KeyboardEvent): void {
  if (SCROLL_KEYS.has(e.key)) interruptRewind();
}

function interruptRewind(): void {
  if (!store.flags.rewinding) return;
  endRewind();
  if (lenis) {
    lenis.stop(); // hand the scroll back to the visitor
    lenis.start();
  }
}

/** Wheel / touch input: Lenis takes over by itself; just drop the flag. */
function onUserScroll(): void {
  if (store.flags.rewinding) endRewind();
}

function endRewind(): void {
  if (rewindTimer !== null) {
    clearTimeout(rewindTimer);
    rewindTimer = null;
  }
  if (!store.flags.rewinding) return;
  store.flags.rewinding = false;
  window.removeEventListener('keydown', onRewindKey, true);
  window.removeEventListener('pointerdown', interruptRewind, true);
}

export function rewind(opts: GlideOptions = {}): void {
  cut?.kill();
  cut = null;
  const overlay = jumpCutOverlay();
  if (overlay) overlay.style.opacity = '0';
  if (!lenis) {
    scrollInstant(0);
    snapFilm(store);
    opts.onComplete?.();
    return;
  }
  endRewind();
  store.flags.rewinding = true;
  window.addEventListener('keydown', onRewindKey, true);
  window.addEventListener('pointerdown', interruptRewind, true);
  const duration = opts.duration ?? DUR.rewind;
  rewindTimer = setTimeout(endRewind, (duration + 0.5) * 1000); // safety net
  lenis.scrollTo(0, {
    duration,
    easing: easeInOut(),
    force: true,
    onComplete: () => {
      endRewind();
      opts.onComplete?.();
    },
  });
}

// ---------------------------------------------------------------------------
// ≤ 10 Hz sampler (§9.2 readers: HUD, Rail, Nav through refs). The facade
// owns the sampler set; this schedules it.

const SAMPLE_S = 0.1;
let lastSample = -Infinity;
let sampleTimer: ReturnType<typeof setTimeout> | null = null;
let samplerMode: 'ticker' | 'scroll' | null = null;
let offScrollSampler: () => void = noop;

function sampleTick(time: number): void {
  if (time - lastSample < SAMPLE_S) return;
  lastSample = time;
  runSamplers();
}

/** Reduced motion: no rAF loop at rest — sample on scroll, ≤ 10 Hz, with a trailing call. */
function sampleOnScroll(): void {
  const t = performance.now() / 1000;
  const wait = SAMPLE_S - (t - lastSample);
  if (wait <= 0) {
    lastSample = t;
    runSamplers();
  } else if (sampleTimer === null) {
    sampleTimer = setTimeout(() => {
      sampleTimer = null;
      lastSample = performance.now() / 1000;
      runSamplers();
    }, wait * 1000);
  }
}

/** (Re)schedule the sampler for the current motion mode (the facade calls it when samplers come and go). */
export function restartSampler(): void {
  const want = !running || samplerCount() === 0 ? null : getMotionPref() === 'reduced' ? 'scroll' : 'ticker';
  if (want === samplerMode) return;
  if (samplerMode === 'ticker') gsap.ticker.remove(sampleTick);
  if (samplerMode === 'scroll') offScrollSampler();
  offScrollSampler = noop;
  if (sampleTimer !== null) {
    clearTimeout(sampleTimer);
    sampleTimer = null;
  }
  samplerMode = want;
  lastSample = -Infinity;
  if (want === 'ticker') gsap.ticker.add(sampleTick);
  else if (want === 'scroll') offScrollSampler = subscribeScroll(sampleOnScroll);
}

/** Run every sampler now, outside the ≤ 10 Hz cadence. */
export function sampleNow(): void {
  // Same clock as the scheduler that compares against it: the ticker's in
  // full motion (it starts at gsap's load, not at navigation start).
  lastSample = samplerMode === 'ticker' ? gsap.ticker.time : performance.now() / 1000;
  runSamplers();
}
