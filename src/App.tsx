import { lazy, Suspense, useEffect, useRef } from 'react';
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
import { scrollInstant, useSmoothScroll } from './motion/lenis';
import HomePage from './pages/HomePage';
import { headingId } from './scroll/chapters';
import { focusQuietly, isJumpId, jumpToChapter, jumpToY } from './scroll/jump';

// Code-split routes (§8.5): only /work/:slug and the 404. Home is eager so
// the hero <h1> (the LCP) is in the first chunk as well as the static HTML.
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
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

/**
 * Route-change scrolling (§4.4). Every scroll goes through the Lenis helpers,
 * because a native `window.scrollTo` can be overridden by a running Lenis
 * animation:
 * - a new route without a hash starts at the top (back/forward is left alone;
 *   the home position restore is explicit, §6);
 * - a hash scrolls to its target once the (lazy) route has rendered it: a
 *   nav chapter with the jump policy (hold start, glide or jump cut, focus on
 *   its heading), any other element to its top with the same policy.
 * The first load is skipped: index.html strips any hash and scrolls to 0.
 */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!hash) {
      if (navType !== 'POP') scrollInstant(0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let raf = 0;
    let tries = 0;
    const seek = () => {
      const el = document.getElementById(id);
      if (!el) {
        if (++tries < 120) raf = requestAnimationFrame(seek); // wait for the lazy route
        return;
      }
      if (isJumpId(id)) {
        jumpToChapter(id);
        return;
      }
      const heading = document.getElementById(headingId(id as Parameters<typeof headingId>[0])) ?? el;
      jumpToY(el.getBoundingClientRect().top + window.scrollY, () => focusQuietly(heading));
    };
    seek();
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash, navType]);

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
        <Suspense fallback={<div className="min-h-svh" />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/work/:slug" element={<ProjectDetailPage />} />
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
