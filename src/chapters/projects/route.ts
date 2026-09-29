/**
 * Route transitions (SPEC §6 "Page transitions", §9.10): home ↔ detail and
 * every other arrival on the home route. The field lives in the App shell
 * and persists across routes; these helpers decide what it does at the swap.
 *
 * Home → detail (a plain click on a project link, `leaveHome`):
 *   1. save `sessionStorage['dtw:home-y']`;
 *   2. the home DOM exits (opacity 0, y −16px, 300 ms expo.in) while the
 *      detail chunk preloads;
 *   3. at the swap the field KEEPS the emblem: its displayed transform is
 *      captured (`handoff`), route mode is entered right away (so the film
 *      never drifts toward S0 while the lazy page loads), then the route
 *      swaps and ScrollToHash puts the page at y 0;
 *   4. the detail page tweens `handoff.t` 0 → 1 (700 ms expo.inOut): only the
 *      anchor moves to the detail anchor, never a re-morph;
 *   5. the detail DOM enters with line masks at 350 ms (`takeEntry`).
 *
 * Arriving on home from another route (`captureArrival` / `runArrival`,
 * mounted by C3 — every home mount renders it):
 * - back / POP from a detail page: once the home chapters are mounted, fonts
 *   are ready and ScrollTrigger has refreshed, restore the saved y
 *   (immediate) and resync the film by a jump cut (director snap under the
 *   void overlay, then a 400 ms fade in): never a morph through the states
 *   in between;
 * - a forward link to "/" (the wordmark, the 404's "Back to home"): y 0,
 *   S0, a 600 ms fade, no intro;
 * - a forward link with a hash ("← All work" → /#projects, the nav from a
 *   detail page): the same resync as POP, to the hash's target (for
 *   #projects coming from a detail page: that project's window hold).
 * Reduced motion: the same jumps, with no fades (instant, §8.2).
 *
 * Browser-only (handlers and effects); nothing runs at import (SSR-safe).
 * gsap is lazy (motion/lazy.ts), never imported statically.
 */
import { getLenis, jumpCutOverlay, onScrollRefresh, scrollInstant } from '../../motion/lenis';
import { loadGsap } from '../../motion/lazy';
import { isReducedMotion } from '../../motion/motionPref';
import { getNextProject, getProject } from '../../content/projects';
import type { StateId } from '../../field/states/ids';
import { anchorTransform } from '../../scroll/anchors';
import { HOME_ORDER, PROJECT_HOLD_Q, PROJECT_WINDOW_VH, headingId, type ChapterId } from '../../scroll/chapters';
import { enterRoute, frame, snapFilm } from '../../scroll/director';
import { chapterTarget, focusQuietly, isJumpId } from '../../scroll/jump';
import { store, type RouteKind, type Vec4 } from '../../scroll/store';
import { handoff } from '../../scroll/detailField.ts';

/** §6 route transition timings (s) and distances (px). */
export const ROUTE_FX = {
  /** Home / detail DOM exit: opacity 0, y −16px, expo.in. */
  exit: { dur: 0.3, y: -16 },
  /** The detail DOM enters (line masks) this long after the swap. */
  entryDelay: 0.35,
  /** Detail → home: the jump-cut resync fades in. */
  restoreFade: 0.4,
  /** Forward link to "/": the page fades in from void. */
  forwardFade: 0.6,
  /** Give up waiting for the home measure after this long (then resync anyway). */
  measureTimeout: 2.5,
} as const;

const HOME_Y_KEY = 'dtw:home-y';

function saveHomeY(y: number): void {
  try {
    sessionStorage.setItem(HOME_Y_KEY, String(Math.max(0, Math.round(y))));
  } catch {
    /* storage blocked: back returns to the top */
  }
}

function readHomeY(): number | null {
  try {
    const v = sessionStorage.getItem(HOME_Y_KEY);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entry flag: a detail page mounted by an in-app transition runs its entry.

let entryPending = false;

/** Mark the next detail mount as a transition arrival (line masks at 350 ms). */
export function markEntry(): void {
  entryPending = true;
}

/** Consume the entry flag (true once per transition). */
export function takeEntry(): boolean {
  const e = entryPending;
  entryPending = false;
  return e;
}

// ---------------------------------------------------------------------------
// The hand-off.

let handoffPending = false;
const tmp: Vec4 = [0, 0, 1, 1];

/**
 * Capture `emblem`'s transform as the field displays it now (the director's
 * last frame; its own anchor if it is not in the pair) as the hand-off start.
 * Without an engine frame yet there is nothing on screen to keep: no hand-off.
 */
function captureHandoff(emblem: StateId): void {
  const src =
    frame.b === emblem ? frame.offB : frame.a === emblem ? frame.offA : anchorTransform(emblem, store, tmp, frame.disperse);
  handoff.x = src[0];
  handoff.y = src[1];
  handoff.scale = src[2];
  handoff.alpha = src[3];
  handoffPending = frame.now > 0;
  handoff.t = handoffPending ? 0 : 1;
}

/** Consume a pending hand-off (the detail page tweens `handoff.t` when true). */
export function takeHandoff(): boolean {
  const h = handoffPending;
  handoffPending = false;
  if (!h) handoff.t = 1;
  return h;
}

/** Fire-and-forget preload of the detail route's chunk (the same module App.tsx lazy-loads). */
export function preloadDetail(): void {
  void import('../../pages/ProjectDetailPage').catch(() => {});
}

type Navigate = (to: string) => void;

let leaving = false;

/**
 * Home → detail (see the file header). `href` is `/work/<slug>`. Returns
 * false (and does nothing) when the slug is unknown, so the Link navigates
 * by itself.
 */
export function leaveHome(href: string, navigate: Navigate): boolean {
  const slug = decodeURIComponent(href.replace(/^\/work\//, ''));
  const project = getProject(slug);
  if (!project || leaving) return project !== undefined;
  leaving = true;
  saveHomeY(store.scroll.y);
  preloadDetail();

  const swap = (): void => {
    leaving = false;
    captureHandoff(project.emblem);
    markEntry();
    // Route mode now: the field holds the emblem while the lazy page loads.
    enterRoute(store, 'detail', slug, { a: project.emblem, b: getNextProject(slug).emblem });
    navigate(href);
  };

  const main = document.getElementById('main');
  const parts = main ? Array.from(main.children) : [];
  if (isReducedMotion() || parts.length === 0) {
    swap();
    return true;
  }
  loadGsap().then(
    ({ gsap }) => {
      gsap.to(parts, {
        opacity: 0,
        y: ROUTE_FX.exit.y,
        duration: ROUTE_FX.exit.dur,
        ease: 'in-expo',
        overwrite: true,
        onComplete: swap,
      });
    },
    swap,
  );
  return true;
}

// ---------------------------------------------------------------------------
// Arriving on home from another route.

export interface Arrival {
  readonly from: RouteKind;
  readonly slug: string;
  /** The router's navigation type: 'POP' | 'PUSH' | 'REPLACE'. */
  readonly nav: string;
  readonly hash: string;
}

/**
 * The arrival this home mount is, or null (first load, a layout remount).
 * Call it before HomePage's `enterRoute('home')` has run: a child's layout
 * effect (keep the result in a ref: StrictMode re-runs effects).
 */
export function captureArrival(nav: string, hash: string): Arrival | null {
  const from = store.route.kind;
  if (from === 'home') return null;
  return { from, slug: store.route.slug, nav, hash };
}

/** The scroll target of an arrival, from the store's fresh chapter records (null: stay). */
function arrivalTarget(a: Arrival): number | null {
  if (a.nav === 'POP') return readHomeY() ?? 0;
  const id = decodeURIComponent(a.hash.slice(1));
  if (!id) return 0;
  return homeHashTarget(id, a.from === 'detail' ? (getProject(a.slug)?.index ?? 1) - 1 : 0);
}

/**
 * The scroll target of a home `#id` (an arrival, or a first-load deep link):
 * a nav chapter's hold start, `#projects` window `k`'s hold, any other
 * element's top. Null when the element is not on the page.
 */
export function homeHashTarget(id: string, k = 0): number | null {
  if (id === 'projects') {
    const rec = store.chapters.projects;
    if (rec?.sticky) return rec.top + ((k + PROJECT_HOLD_Q) * PROJECT_WINDOW_VH * store.scroll.H) / 100;
    const panel = document.querySelector(`[data-panel="${k + 1}"]`);
    if (panel) return panel.getBoundingClientRect().top + window.scrollY;
    return rec ? rec.top : null;
  }
  if (isJumpId(id)) return chapterTarget(id);
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect().top + window.scrollY : null;
}

/** Arrivals waiting for their resync (the scroll is theirs: ScrollToHash stays out). */
let arrivalsWaiting = 0;

/**
 * True while a home arrival will set the scroll itself (a POP restore or a
 * hash target), so the App's ScrollToHash does not run a second jump for the
 * same navigation. Set from runArrival's layout effect, i.e. before any
 * passive effect of that commit.
 */
export const arrivalOwnsScroll = (): boolean => arrivalsWaiting > 0;

const homeMeasured = (): boolean => HOME_ORDER.every((id) => store.chapters[id] !== undefined);
const fontsSettled = (): boolean => (document.fonts ? document.fonts.status === 'loaded' : true);

/**
 * Run an arrival (see the file header). Call from a layout effect, so the
 * void overlay covers the home DOM before its first paint. Returns the
 * cancel function (StrictMode-safe: a re-run starts over).
 */
export function runArrival(a: Arrival): () => void {
  const overlay = jumpCutOverlay();
  const reduced = isReducedMotion();
  let alive = true;
  let done = false;
  let fade: { kill(): unknown } | null = null;
  let offRefresh: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (overlay) overlay.style.opacity = '1';

  const reveal = (dur: number): void => {
    if (!overlay) return;
    if (reduced) {
      overlay.style.opacity = '0';
      return;
    }
    loadGsap().then(
      ({ gsap }) => {
        if (!alive) return;
        fade = gsap.to(overlay, { opacity: 0, duration: dur, ease: 'none', overwrite: true });
      },
      () => {
        overlay.style.opacity = '0';
      },
    );
  };

  let waiting = false;
  const stopWaiting = (): void => {
    if (waiting) arrivalsWaiting--;
    waiting = false;
    offRefresh?.();
    offRefresh = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const resync = (): void => {
    if (!alive || done) return;
    done = true;
    stopWaiting();
    // Lenis re-measures its limit on a debounced observer: the detail page's
    // (shorter) limit may still be cached, and both the target clamp and
    // scrollTo clamp to it. Re-measure first, then compute the target.
    getLenis()?.resize();
    const y = arrivalTarget(a);
    if (y !== null) scrollInstant(Math.max(0, y)); // Lenis / the browser clamp to the (fresh) limit
    snapFilm(store);
    // A hash arrival moves focus like an in-page jump (§4.4, §8.1): the
    // chapter heading, or the element itself.
    const id = a.nav === 'POP' ? '' : decodeURIComponent(a.hash.slice(1));
    if (id) focusQuietly(document.getElementById(headingId(id as ChapterId)) ?? document.getElementById(id));
    reveal(ROUTE_FX.restoreFade);
  };

  // Leave route mode now (HomePage's own enterRoute('home') is a passive
  // effect: it would run after the first home frames) and drop the other
  // route's film position at once, so the director never damps — or cuts —
  // through the states in between.
  enterRoute(store, 'home');
  snapFilm(store);

  const restoreY = a.nav === 'POP' ? readHomeY() : null;
  if (a.hash === '' && restoreY === null) {
    // A forward link to "/" (or back with nothing saved): y 0, S0, fade in.
    // (ScrollToHash puts a PUSH at y 0; a POP keeps the old page's y.)
    done = true;
    if (a.nav === 'POP') scrollInstant(0);
    reveal(ROUTE_FX.forwardFade);
  } else {
    const check = (): void => {
      if (homeMeasured() && fontsSettled()) resync();
    };
    waiting = true;
    arrivalsWaiting++;
    offRefresh = onScrollRefresh(check);
    timer = setTimeout(resync, ROUTE_FX.measureTimeout * 1000);
  }

  return () => {
    alive = false;
    stopWaiting();
    fade?.kill();
    // A cancelled arrival must never leave the page covered (StrictMode's
    // re-run covers it again in the same commit, before any paint).
    if (overlay) overlay.style.opacity = '0';
  };
}
