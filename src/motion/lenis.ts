/**
 * Smooth scroll and the scroll side of every frame — the public API (SPEC
 * §4.4, §7.6, §8.2, §9.5, §9.10).
 *
 * This module is the FACADE in the initial bundle. Lenis, gsap and
 * ScrollTrigger live in a lazy chunk (motion/scrollRuntime.ts, §8.5 initial
 * JS ≤ 140 KB gz), which `useSmoothScroll()` loads right after hydration;
 * every helper below delegates to it once it has loaded. Before that (the
 * first few hundred ms, or if the chunk fails to load) they act natively:
 * instant scrolls, no smoothing — the prerendered page is fully usable.
 *
 * - One Lenis instance (full motion only; none at all under reduced motion,
 *   where a passive native `scroll` listener feeds the store instead). Its
 *   raf runs FIRST in every gsap tick, and its `scroll` event writes
 *   `store.scroll.y / vel` and calls `ScrollTrigger.update()`, so DOM scrubs
 *   and chapter `onUpdate`s land before the engine's renderFrame reads the
 *   store (CONTRACTS.md tick order).
 * - Viewport (`store.scroll.W / H`, H = 100svh), layout and mode are written
 *   on init, resize and refresh only; every refresh re-measures the footer,
 *   re-resolves the segments and bumps `store.version`.
 * - scrollTo helpers: glide(y), jumpCut(y) (§4.4 nav jump cut), rewind() (§4.4
 *   Back to top), scrollInstant(y); a ≤ 10 Hz sampler for Nav / Rail / HUD.
 * - QA (§12): `?film=<F>` pins the film at init; `window.__lenis` in dev or
 *   with `?debug`.
 *
 * Mount once with `useSmoothScroll()` in the App shell (ref-counted, so
 * StrictMode's double effect never re-creates Lenis). SSR-safe: nothing here
 * touches window/document at import or during render.
 */
import { useEffect } from 'react';
import type Lenis from 'lenis';
import { snapFilm } from '../scroll/director';
import { store } from '../scroll/store';
import { loadScroll, reportLoadError, scrollRuntime } from './lazy';

/** Nav / rail glide (§4.4): 1.2 s, expo.inOut. */
export const GLIDE_S = 1.2;
/** Focus-in scroll to a chapter's hold (§8.1): 600 ms. */
export const FOCUS_GLIDE_S = 0.6;
/** Jump cut (§4.4): the void overlay fades in over 300 ms, out over 400 ms. */
export const JUMP_CUT_FADE = { in: 0.3, out: 0.4 } as const;

export interface GlideOptions {
  /** Seconds (default 1.2, §4.4). */
  duration?: number;
  onComplete?: () => void;
}

export interface JumpCutOptions {
  /** Runs right after the cut (scroll, ST update, director snap): move focus here. */
  onCut?: () => void;
  /**
   * Recompute the target after a layout change (the motion preference flips
   * mid-cut: the flow layout moves every chapter). Null keeps `y`.
   */
  retarget?: () => number | null;
}

const call = (fn: () => void): void => fn();

// ---------------------------------------------------------------------------
// Listener sets (owned here, so subscribers never wait for the runtime).

const scrollListeners = new Set<() => void>();

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

/** @internal Runtime → subscribers. */
export function emitScroll(): void {
  scrollListeners.forEach(call);
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

/** @internal Runtime → subscribers. */
export function emitRefresh(): void {
  refreshListeners.forEach(call);
}

const samplers = new Set<() => void>();

/** @internal */
export function runSamplers(): void {
  samplers.forEach(call);
}

/** @internal */
export function samplerCount(): number {
  return samplers.size;
}

/**
 * Run `fn` at ≤ 10 Hz: on the gsap ticker under full motion, on scroll events
 * (plus a trailing call) under reduced motion, and after every refresh. `fn`
 * reads the store / the director's frame and writes the DOM through refs —
 * never React state. Runs once immediately. Returns an unsubscribe function.
 */
export function onSample(fn: () => void): () => void {
  samplers.add(fn);
  scrollRuntime()?.restartSampler();
  fn();
  return () => {
    samplers.delete(fn);
    scrollRuntime()?.restartSampler();
  };
}

/**
 * Run every sampler now (outside the ≤ 10 Hz cadence): e.g. when the field
 * becomes ready under reduced motion, where nothing else samples at rest.
 */
export function sampleNow(): void {
  if (typeof window === 'undefined') return;
  const rt = scrollRuntime();
  if (rt) rt.sampleNow();
  else runSamplers();
}

let overlayEl: HTMLElement | null = null;

/** JumpCutOverlay registers its element here. Returns the unregister function. */
export function registerJumpCutOverlay(el: HTMLElement | null): () => void {
  overlayEl = el;
  return () => {
    if (overlayEl === el) overlayEl = null;
  };
}

/** @internal */
export function jumpCutOverlay(): HTMLElement | null {
  return overlayEl;
}

// ---------------------------------------------------------------------------
// Access.

/** The live Lenis instance (null under reduced motion, on the server, or before the runtime has loaded). */
export const getLenis = (): Lenis | null => scrollRuntime()?.getLenis() ?? null;
/** Whether scroll is smoothed by Lenis right now (full motion). */
export const isSmooth = (): boolean => scrollRuntime()?.isSmooth() ?? false;

/** Maximum scrollY (cached on refresh; Lenis's own when it runs; measured before the runtime loads). */
export function scrollLimit(): number {
  const rt = scrollRuntime();
  if (rt) return rt.scrollLimit();
  if (typeof document === 'undefined') return 0;
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * Schedule one `ScrollTrigger.refresh()` two frames from now (coalesced), so
 * the layout that caused it has settled. Before the runtime has loaded this
 * is a no-op: its start refreshes anyway, after every chapter has mounted.
 */
export function requestRefresh(): void {
  if (typeof window === 'undefined') return;
  scrollRuntime()?.requestRefresh();
}

// ---------------------------------------------------------------------------
// Lifecycle.

/** Take a reference on the scroll infrastructure (loads and starts it on the first). */
export function acquireScroll(): void {
  if (typeof window === 'undefined') return;
  loadScroll().then((rt) => rt.acquire(), reportLoadError);
}

/**
 * Drop a reference; the last release stops it after one macrotask unless
 * re-acquired (StrictMode-safe). Ordered after any pending acquire (same
 * promise chain).
 */
export function releaseScroll(): void {
  if (typeof window === 'undefined') return;
  loadScroll().then(
    (rt) => rt.release(),
    () => {},
  );
}

/** React: mount the scroll infrastructure (once, in the App shell). */
export function useSmoothScroll(): void {
  useEffect(() => {
    acquireScroll();
    return releaseScroll;
  }, []);
}

// ---------------------------------------------------------------------------
// scrollTo helpers (§4.4). Native and instant until the runtime has loaded.

function nativeInstant(y: number): void {
  window.scrollTo(0, y);
  store.scroll.y = window.scrollY;
  store.scroll.vel = 0;
  emitScroll();
}

/**
 * Jump to `y` now: Lenis `immediate` (cancelling any smooth scroll first) or
 * a native scroll; the store and ScrollTrigger are updated synchronously.
 */
export function scrollInstant(y: number): void {
  if (typeof window === 'undefined') return;
  const rt = scrollRuntime();
  if (rt) rt.scrollInstant(y);
  else nativeInstant(y);
}

/** Smooth scroll to `y` (§4.4 nav glide: 1.2 s expo.inOut). Instant without Lenis. */
export function glide(y: number, opts: GlideOptions = {}): void {
  if (typeof window === 'undefined') return;
  const rt = scrollRuntime();
  if (rt) {
    rt.glide(y, opts);
    return;
  }
  nativeInstant(y);
  opts.onComplete?.();
}

/**
 * The nav jump cut (§4.4): the void overlay (z 60) fades in over 300 ms,
 * then `scrollTo(y, immediate)`, `ScrollTrigger.update()` and the director
 * snaps (`snapFilm`), then the overlay fades out over 400 ms. Without Lenis
 * (reduced motion) it is an instant jump.
 */
export function jumpCut(y: number, opts: JumpCutOptions = {}): void {
  if (typeof window === 'undefined') return;
  const rt = scrollRuntime();
  if (rt) {
    rt.jumpCut(y, opts);
    return;
  }
  nativeInstant(y);
  snapFilm(store);
  opts.onCut?.();
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
  const rt = scrollRuntime();
  if (rt) {
    rt.rewind(opts);
    return;
  }
  nativeInstant(0);
  snapFilm(store);
  opts.onComplete?.();
}
