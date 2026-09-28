/**
 * Smooth scroll and the scroll side of every frame (SPEC §4.4, §7.6, §8.2,
 * §9.5, §9.10).
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
 * - scrollTo helpers: glide(y), jumpCut(y) (§4.4 nav jump cut), rewind() (§4.4
 *   Back to top), scrollInstant(y); a ≤ 10 Hz sampler for Nav / Rail / HUD.
 * - QA (§12): `?film=<F>` pins the film at init; `window.__lenis` in dev or
 *   with `?debug`.
 *
 * Mount once with `useSmoothScroll()` in the App shell (ref-counted, so
 * StrictMode's double effect never re-creates Lenis). SSR-safe: nothing here
 * touches window/document at import or during render.
 */
import Lenis, { type LenisOptions } from 'lenis';
import { useEffect } from 'react';
import { exposeGlobal, getDebugParams } from '../debugParams';
import { svhPx } from '../scroll/anchors';
import { filmOverride, snapFilm } from '../scroll/director';
import { resolve } from '../scroll/segments';
import { store } from '../scroll/store';
import { DUR, EASE, gsap, ScrollTrigger } from './gsap';
import { getMotionPref, subscribeMotionPref, type MotionPref } from './motionPref';
import { getLayoutMode, subscribeLayoutMode } from './useLayoutMode';

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

/** Nav / rail glide (§4.4): 1.2 s, expo.inOut. */
export const GLIDE_S = 1.2;
/** Focus-in scroll to a chapter's hold (§8.1): 600 ms. */
export const FOCUS_GLIDE_S = 0.6;
/** Jump cut (§4.4): the void overlay fades in over 300 ms, out over 400 ms. */
export const JUMP_CUT_FADE = { in: 0.3, out: 0.4 } as const;

const noop = (): void => {};

let lenis: Lenis | null = null;
let unexposeLenis: () => void = noop;

/** The live Lenis instance (null under reduced motion, on the server, or before init). */
export const getLenis = (): Lenis | null => lenis;
/** Whether scroll is smoothed by Lenis right now (full motion). */
export const isSmooth = (): boolean => lenis !== null;

// ---------------------------------------------------------------------------
// Scroll listeners (every write of store.scroll).

const scrollListeners = new Set<() => void>();
const call = (fn: () => void): void => fn();
const emitScroll = (): void => scrollListeners.forEach(call);

/**
 * Called after every write of `store.scroll.y` (Lenis `scroll`, or the native
 * listener under reduced motion) and after every refresh. Under reduced
 * motion the engine subscribes `handle.invalidate` here (§9.5: on-demand
 * frames). Returns an unsubscribe function.
 */
export function subscribeScroll(fn: () => void): () => void {
  scrollListeners.add(fn);
  return () => {
    scrollListeners.delete(fn);
  };
}

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

const refreshListeners = new Set<() => void>();

/**
 * Called after every ScrollTrigger refresh, once the store holds the new
 * chapter records, segments and version (HUD zones, rail targets…).
 */
export function onScrollRefresh(fn: () => void): () => void {
  refreshListeners.add(fn);
  return () => {
    refreshListeners.delete(fn);
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
  refreshListeners.forEach(call);
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
  if (typeof window === 'undefined' || refreshRaf) return;
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
  if (overlayEl) overlayEl.style.opacity = '0';
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
}

/** Take a reference on the scroll infrastructure (starts it on the first). */
export function acquireScroll(): void {
  if (typeof window === 'undefined') return;
  refs++;
  if (stopTimer !== null) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (!running) start();
}

/** Drop a reference; the last release stops it after one macrotask unless re-acquired (StrictMode-safe). */
export function releaseScroll(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0 || !running || stopTimer !== null) return;
  stopTimer = setTimeout(() => {
    stopTimer = null;
    if (refs === 0 && running) stop();
  }, 0);
}

/** React: mount the scroll infrastructure (once, in the App shell). */
export function useSmoothScroll(): void {
  useEffect(() => {
    acquireScroll();
    return releaseScroll;
  }, []);
}

// ---------------------------------------------------------------------------
// scrollTo helpers (§4.4).

let expoInOut: ((t: number) => number) | null = null;
const easeInOut = (): ((t: number) => number) => (expoInOut ??= gsap.parseEase(EASE.inOutExpo));

/**
 * Jump to `y` now: Lenis `immediate` (cancelling any smooth scroll first) or
 * a native scroll; the store and ScrollTrigger are updated synchronously.
 */
export function scrollInstant(y: number): void {
  if (typeof window === 'undefined') return;
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

export interface GlideOptions {
  /** Seconds (default 1.2, §4.4). */
  duration?: number;
  onComplete?: () => void;
}

/** Smooth scroll to `y` (§4.4 nav glide: 1.2 s expo.inOut). Instant without Lenis. */
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

let overlayEl: HTMLElement | null = null;
let cut: gsap.core.Timeline | null = null;

/** JumpCutOverlay registers its element here. Returns the unregister function. */
export function registerJumpCutOverlay(el: HTMLElement | null): () => void {
  overlayEl = el;
  return () => {
    if (overlayEl === el) overlayEl = null;
  };
}

export interface JumpCutOptions {
  /** Runs right after the cut (scroll, ST update, director snap): move focus here. */
  onCut?: () => void;
}

/**
 * The nav jump cut (§4.4): the void overlay (z 60) fades in over 300 ms,
 * then `scrollTo(y, immediate)`, `ScrollTrigger.update()` and the director
 * snaps (`snapFilm`), then the overlay fades out over 400 ms. Without Lenis
 * (reduced motion) it is an instant jump.
 */
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
  const o = overlayEl;
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

/**
 * Back to top (§4.4): `scrollTo(0)` over 2.4 s expo.inOut with
 * `flags.rewinding` set, so the director disables the jump cut and damps at
 * 60 ms (the film visibly plays backward) and the engine suppresses one-shots.
 * Any wheel / touch / scroll key / pointerdown hands control back. Instant
 * under reduced motion.
 */
export function rewind(opts: GlideOptions = {}): void {
  if (typeof window === 'undefined') return;
  cut?.kill();
  cut = null;
  if (overlayEl) overlayEl.style.opacity = '0';
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
// ≤ 10 Hz sampler (§9.2 readers: HUD, Rail, Nav through refs).

const SAMPLE_S = 0.1;
const samplers = new Set<() => void>();
let lastSample = -Infinity;
let sampleTimer: ReturnType<typeof setTimeout> | null = null;
let samplerMode: 'ticker' | 'scroll' | null = null;

function runSamplers(): void {
  samplers.forEach(call);
}

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

function restartSampler(): void {
  if (typeof window === 'undefined') return;
  const want = samplers.size === 0 ? null : getMotionPref() === 'reduced' ? 'scroll' : 'ticker';
  if (want === samplerMode) return;
  if (samplerMode === 'ticker') gsap.ticker.remove(sampleTick);
  if (samplerMode === 'scroll') scrollListeners.delete(sampleOnScroll);
  if (sampleTimer !== null) {
    clearTimeout(sampleTimer);
    sampleTimer = null;
  }
  samplerMode = want;
  lastSample = -Infinity;
  if (want === 'ticker') gsap.ticker.add(sampleTick);
  else if (want === 'scroll') scrollListeners.add(sampleOnScroll);
}

/**
 * Run `fn` at ≤ 10 Hz: on the gsap ticker under full motion, on scroll events
 * (plus a trailing call) under reduced motion, and after every refresh. `fn`
 * reads the store / the director's frame and writes the DOM through refs —
 * never React state. Runs once immediately. Returns an unsubscribe function.
 */
export function onSample(fn: () => void): () => void {
  samplers.add(fn);
  restartSampler();
  fn();
  return () => {
    samplers.delete(fn);
    restartSampler();
  };
}
