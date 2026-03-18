import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef } from "react";
import "./lib/gsap-init"; // Register GSAP plugins on app startup
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import CustomCursor from "./components/CustomCursor";
import { useReducedMotion } from "./lib/useReducedMotion";
import { useIsMobile } from "./lib/useIsMobile";

// Lazy-load pages for smaller initial bundle
const HomePage = lazy(() => import("./pages/HomePage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function ScrollToHash() {
  const { hash } = useLocation();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (hash) {
      const id = hash.replace("#", "");
      const timer = setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hash]);

  return null;
}

function AppShell() {
  const reduced = useReducedMotion();
  const { isLowPower } = useIsMobile();
  const showCursor = !reduced && !isLowPower;

  return (
    <div className={`bg-cream text-dark ${showCursor ? "cursor-none" : ""}`}>
      {/* Skip to main content — a11y */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[10000] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-dark focus:text-cream focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      {showCursor && <CustomCursor />}
      <Nav />
      <ScrollToHash />
      <main id="main">
        <Suspense fallback={<div className="min-h-screen" />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/work/:slug" element={<ProjectDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
