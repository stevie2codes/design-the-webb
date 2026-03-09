import { Link, useLocation } from "react-router-dom";

export default function Nav() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  function navLink(hash: string, label: string, className = "hover:text-dark transition-colors") {
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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-5 bg-cream/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl text-dark tracking-tight"
        >
          SW<span className="text-orange">.</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          {navLink("about", "About")}
          {navLink("work", "Work")}
          {navLink("capabilities", "Capabilities")}
          {navLink("contact", "Contact", "ml-2 px-5 py-2 rounded-full bg-dark text-cream text-sm hover:bg-dark-soft transition-colors")}
        </div>
      </div>
    </nav>
  );
}
