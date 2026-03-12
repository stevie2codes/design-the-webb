import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import ScrambleText from "./ScrambleText";

/* ── Magnetic link wrapper ─────────────────────────── */
function MagneticLink({
  children,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  return (
    <motion.a
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        x.set(dx * 0.25);
        y.set(dy * 0.25);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      {...props}
    >
      {children}
    </motion.a>
  );
}

function MagneticRouterLink({
  children,
  className,
  to,
  ...props
}: { children: React.ReactNode; className?: string; to: string } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  return (
    <motion.div
      style={{ x: springX, y: springY, display: "inline-block" }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        x.set(dx * 0.25);
        y.set(dy * 0.25);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <Link ref={ref} to={to} className={className} {...props}>
        {children}
      </Link>
    </motion.div>
  );
}

/* ── Nav sections for intersection observer ────────── */
const SECTIONS = ["about", "work", "capabilities", "contact"] as const;

export default function Nav() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [scrollProgress, setScrollProgress] = useState(0);

  // Scroll-aware style shift + progress bar
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60);
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? window.scrollY / docHeight : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section tracking via Intersection Observer
  useEffect(() => {
    if (!isHome) return;
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [isHome, pathname]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape key
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  // Close sheet on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* ── Link builders ───────────────────────────────── */
  function navLink(hash: string, label: string) {
    const isActive = activeSection === hash;
    const className = `relative transition-colors ${
      isActive ? "text-dark" : "text-muted hover:text-dark"
    }`;

    if (isHome) {
      return (
        <MagneticLink href={`#${hash}`} className={className}>
          {label}
          {isActive && (
            <motion.span
              layoutId="nav-dot"
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </MagneticLink>
      );
    }
    return (
      <MagneticRouterLink to={`/#${hash}`} className={className}>
        {label}
      </MagneticRouterLink>
    );
  }

  function mobileNavLink(hash: string, label: string) {
    const base =
      "block text-3xl font-display tracking-tight text-dark transition-colors hover:text-orange";

    if (isHome) {
      return (
        <a
          href={`#${hash}`}
          className={base}
          onClick={() => setOpen(false)}
        >
          {label}
        </a>
      );
    }
    return (
      <Link
        to={`/#${hash}`}
        className={base}
        onClick={() => setOpen(false)}
      >
        {label}
      </Link>
    );
  }

  /* ── Stagger entrance delays ─────────────────────── */
  const navItems = [
    { hash: "about", label: "About" },
    { hash: "work", label: "Work" },
    { hash: "capabilities", label: "Capabilities" },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-5 transition-all duration-500 ${
          scrolled
            ? "bg-cream/80 backdrop-blur-md border-b border-line/60"
            : "bg-transparent"
        }`}
      >
        {/* Progress bar */}
        <motion.div
          className="absolute top-0 left-0 h-[2px] bg-orange origin-left"
          style={{ scaleX: scrollProgress, width: "100%" }}
        />

        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Animated logo */}
          <Link
            to="/"
            className="font-display text-xl text-dark tracking-tight"
          >
            <ScrambleText text="SW" delay={200} speed={100} />
            <span className="text-orange">.</span>
          </Link>

          {/* Desktop links — staggered entrance */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
            {navItems.map((item, i) => (
              <motion.div
                key={item.hash}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
              >
                {navLink(item.hash, item.label)}
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + navItems.length * 0.08 }}
            >
              {isHome ? (
                <MagneticLink
                  href="#contact"
                  className="ml-2 px-5 py-2 rounded-full bg-dark text-cream text-sm hover:bg-dark-soft transition-colors"
                >
                  Contact
                </MagneticLink>
              ) : (
                <MagneticRouterLink
                  to="/#contact"
                  className="ml-2 px-5 py-2 rounded-full bg-dark text-cream text-sm hover:bg-dark-soft transition-colors"
                >
                  Contact
                </MagneticRouterLink>
              )}
            </motion.div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-2 text-dark"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-dark/40 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              className="fixed bottom-0 left-0 right-0 z-50 bg-cream rounded-t-2xl px-8 pt-10 pb-14 md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              {/* Drag handle */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-dark/15" />

              <nav className="grid grid-cols-2 gap-y-8 gap-x-6">
                {mobileNavLink("about", "About")}
                {mobileNavLink("work", "Work")}
                {mobileNavLink("capabilities", "Capabilities")}
                <a
                  href={isHome ? "#contact" : undefined}
                  onClick={(e) => {
                    if (!isHome) e.preventDefault();
                    setOpen(false);
                  }}
                  className="block text-3xl font-display tracking-tight text-orange transition-colors hover:text-orange-dark"
                >
                  {isHome ? (
                    "Contact"
                  ) : (
                    <Link
                      to="/#contact"
                      className="text-orange hover:text-orange-dark"
                    >
                      Contact
                    </Link>
                  )}
                </a>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
