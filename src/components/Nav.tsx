import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function Nav() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);

  // Lock body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape key
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  // Close sheet on route change (for detail-page links)
  useEffect(() => { setOpen(false); }, [pathname]);

  function navLink(
    hash: string,
    label: string,
    className = "hover:text-dark transition-colors"
  ) {
    if (isHome) {
      return (
        <a href={`#${hash}`} className={className}>
          {label}
        </a>
      );
    }
    return (
      <Link to={`/#${hash}`} className={className}>
        {label}
      </Link>
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

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-5 bg-cream/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="font-display text-xl text-dark tracking-tight"
          >
            SW<span className="text-orange">.</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
            {navLink("about", "About")}
            {navLink("work", "Work")}
            {navLink("capabilities", "Capabilities")}
            {navLink(
              "contact",
              "Contact",
              "ml-2 px-5 py-2 rounded-full bg-dark text-cream text-sm hover:bg-dark-soft transition-colors"
            )}
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
                    <Link to="/#contact" className="text-orange hover:text-orange-dark">
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
