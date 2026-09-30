import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import Atmosphere from './components/Atmosphere';
import CursorRing from './components/CursorRing';
import Footer from './components/Footer';
import Hud from './components/Hud';
import JumpCutOverlay from './components/JumpCutOverlay';
import Nav from './components/Nav';
import Rail from './components/Rail';
import SkipLink from './components/SkipLink';
import FieldCanvas from './field/FieldCanvas';
import { onScrollRefresh, scrollInstant, useSmoothScroll } from './motion/lenis';
import HomePage from './pages/HomePage';
import { arrivalOwnsScroll, homeHashTarget } from './chapters/projects/route';
import { HOME_ORDER, headingId } from './scroll/chapters';
import { snapFilm } from './scroll/director';
import { initialHash } from './scroll/initialHash';
import { store } from './scroll/store';
import { focusQuietly, isJumpId, jumpToChapter, jumpToY } from './scroll/jump';

// Code-split routes (§8.5): /work/:slug, /case-studies/:slug and the 404.
// Home is eager so the hero <h1> (the LCP) is in the first chunk as well as
// the static HTML.
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const CaseStudyPage = lazy(() => import('./pages/CaseStudyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/**
 * The scroll infrastructure (§9.5): Lenis (full motion) or the native
 * listener (reduced), the ScrollTrigger refresh points and the ≤ 10 Hz
 * sampler. Ref-counted and StrictMode-safe; rendered first so it is running
 * before any chapter's effects ask for a refresh.
 */
function ScrollInfra() {
  useSmoothScroll();
  return null;
}

/** Saved scrollY of each non-home history entry (location.key → y), for back / forward. */
const ROUTE_Y_KEY = 'dtw:route-y';
const ROUTE_Y_MAX = 30;

function readRouteYs(): Record<string, number> {
  try {
    const v = JSON.parse(sessionStorage.getItem(ROUTE_Y_KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveRouteY(key: string, y: number): void {
  try {
    const all = readRouteYs();
    delete all[key];
    all[key] = Math.max(0, Math.round(y));
    const keys = Object.keys(all);
    for (let i = 0; i < keys.length - ROUTE_Y_MAX; i++) delete all[keys[i]];
    sessionStorage.setItem(ROUTE_Y_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: back / forward opens the page at the top */
  }
}

/** Wait (≤ 120 frames) until `ready()` holds, then run `go`; returns the cancel function. */
function whenReady(ready: () => boolean, go: () => void): () => void {
  let raf = 0;
  let tries = 0;
  const seek = () => {
    if (ready() || ++tries >= 120) go();
    else raf = requestAnimationFrame(seek);
  };
  seek();
  return () => cancelAnimationFrame(raf);
}

const routeRendered = (): boolean => document.querySelector('[data-route-fallback]') === null;
const fontsSettled = (): boolean => (document.fonts ? document.fonts.status === 'loaded' : true);

/**
 * A first-load deep link (`/#contact`, §4.4; the hash was kept by index.html,
 * see scroll/initialHash.ts). Once the first ScrollTrigger refresh has
 * measured the page (fonts settled; a 3 s failsafe otherwise), jump there
 * instantly with the director snapped (the page has only shown the hero: no
 * glide, no morph through the states in between), move focus to the heading
 * and put the hash back in the URL. A visitor who has already scrolled away
 * keeps their position.
 */
function runInitialHash(hash: string, onDone: () => void): () => void {
  const id = decodeURIComponent(hash.slice(1));
  const home = window.location.pathname === '/';
  let alive = true;
  let off: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    off?.();
    off = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const go = () => {
    if (!alive) return;
    stop();
    onDone();
    const { pathname, search } = window.location;
    history.replaceState(history.state, '', pathname + search + hash);
    const el = document.getElementById(id);
    if (!el || window.scrollY > 40) return;
    const y = home ? homeHashTarget(id) : el.getBoundingClientRect().top + window.scrollY;
    if (y !== null) {
      scrollInstant(y);
      snapFilm(store);
    }
    focusQuietly(document.getElementById(headingId(id as Parameters<typeof headingId>[0])) ?? el);
  };
  const ready = () =>
    document.getElementById(id) !== null &&
    routeRendered() &&
    fontsSettled() &&
    (!home || HOME_ORDER.every((c) => store.chapters[c] !== undefined));
  off = onScrollRefresh(() => {
    if (ready()) go();
  });
  timer = setTimeout(go, 3000);
  if (store.version > 0 && ready()) go();
  return () => {
    alive = false;
    stop();
  };
}

/**
 * Route-change scrolling (§4.4). Every scroll goes through the Lenis helpers,
 * because a native `window.scrollTo` can be overridden by a running Lenis
 * animation:
 * - the first load: index.html opens every page at the top; a deep-link hash
 *   it kept jumps after the first refresh (runInitialHash);
 * - a new route without a hash starts at the top;
 * - back / forward to a non-home route restores that entry's saved scrollY
 *   (0 when none) once the lazy route has rendered; home restores itself
 *   (§6, chapters/projects/route.ts runArrival);
 * - a hash scrolls to its target once the (lazy) route has rendered it: a
 *   nav chapter with the jump policy (hold start, glide or jump cut, focus on
 *   its heading), any other element to its top with the same policy — unless
 *   a home arrival from another route already owns that scroll (runArrival).
 */
function ScrollToHash() {
  const { pathname, hash, key } = useLocation();
  const navType = useNavigationType();
  const first = useRef(true);
  const initial = useRef<{ key: string; hash: string } | null>(null);

  // Remember where each non-home entry was left (store.scroll.y: the last
  // scroll event's value, not a layout read that the swap may have clamped).
  useLayoutEffect(() => {
    if (pathname === '/') return;
    return () => saveRouteY(key, store.scroll.y);
  }, [pathname, key]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      const h = initialHash();
      initial.current = h ? { key, hash: h } : null;
      if (!h) return;
    }
    const init = initial.current;
    if (init) {
      if (init.key === key) return runInitialHash(init.hash, () => (initial.current = null));
      initial.current = null; // navigated away before it ran
    }
    if (!hash) {
      if (navType !== 'POP') {
        scrollInstant(0);
        return;
      }
      if (pathname === '/') return; // runArrival restores home
      const saved = readRouteYs()[key] ?? 0;
      return whenReady(routeRendered, () => scrollInstant(saved));
    }
    if (pathname === '/' && arrivalOwnsScroll()) return;
    const id = decodeURIComponent(hash.slice(1));
    return whenReady(
      () => document.getElementById(id) !== null,
      () => {
        const el = document.getElementById(id);
        if (!el) return;
        if (isJumpId(id)) {
          jumpToChapter(id);
          return;
        }
        const heading = document.getElementById(headingId(id as Parameters<typeof headingId>[0])) ?? el;
        jumpToY(el.getBoundingClientRect().top + window.scrollY, () => focusQuietly(heading));
      },
    );
  }, [pathname, hash, key, navType]);

  return null;
}

/**
 * App shell (§9.1), inside whichever router hosts it: BrowserRouter in the
 * browser (App), StaticRouter in the build-time prerender (entry-server).
 * The field host sits outside <Routes> so it persists across routes; until
 * the engine has drawn (and whenever it cannot), the CSS glow on
 * body::before is the backdrop ('css' mode, §8.4).
 */
export function AppShell() {
  return (
    <>
      <ScrollInfra />
      <SkipLink />
      <FieldCanvas />
      <Atmosphere />
      <Nav />
      <Rail />
      <Hud />
      <ScrollToHash />
      <main id="main" tabIndex={-1} className="relative z-2 overflow-x-clip">
        <Suspense fallback={<div className="min-h-svh" data-route-fallback="" />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/work/:slug" element={<ProjectDetailPage />} />
            <Route path="/case-studies/:slug" element={<CaseStudyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <JumpCutOverlay />
      <CursorRing />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
