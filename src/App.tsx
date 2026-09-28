import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import Atmosphere from './components/Atmosphere';
import Footer from './components/Footer';
import Hud from './components/Hud';
import Nav from './components/Nav';
import Rail from './components/Rail';
import SkipLink from './components/SkipLink';
import { isReducedMotion } from './motion/motionPref';
import HomePage from './pages/HomePage';
import { headingId } from './scroll/chapters';
import { chapterTarget, isJumpId } from './scroll/jump';

// Code-split routes (§8.5): only /work/:slug and the 404. Home is eager so
// the hero <h1> (the LCP) is in the first chunk as well as the static HTML.
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/**
 * Route-change scrolling until the Lenis jump policy (§4.4) replaces it:
 * - a new route without a hash starts at the top (back/forward is left alone;
 *   the scroll phase restores the home position explicitly, §6);
 * - a hash scrolls to its target once the (lazy) route has rendered it —
 *   the chapter's hold start for nav chapters, else the element's top; an
 *   explicit scrollTo, so html's scroll-padding-top (which keeps focused
 *   elements clear of the nav) does not stop it short — then moves focus to
 *   the chapter heading.
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
      if (navType !== 'POP') window.scrollTo(0, 0);
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
      const top = (isJumpId(id) ? chapterTarget(id) : null) ?? el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: isReducedMotion() ? 'auto' : 'smooth' });
      document.getElementById(headingId(id as Parameters<typeof headingId>[0]))?.focus({ preventScroll: true });
    };
    seek();
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash, navType]);

  return null;
}

/**
 * App shell (§9.1), inside whichever router hosts it: BrowserRouter in the
 * browser (App), StaticRouter in the build-time prerender (entry-server).
 * The field host sits outside <Routes> so it persists across routes.
 * #field-root is a placeholder until the engine phase mounts <FieldCanvas>
 * there; the CSS glow on body::before is the backdrop until then (and the
 * last resort after).
 */
export function AppShell() {
  return (
    <>
      <SkipLink />
      <div id="field-root" aria-hidden="true" className="field-root" />
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
