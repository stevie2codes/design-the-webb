import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { nav } from '../content/site';
import { subscribeLayoutMode } from '../motion/useLayoutMode';
import { isPlainClick, jumpToChapter, type JumpId } from '../scroll/jump';
import LinkLabel from './LinkLabel';
import MobileMenu, { type NavChapterId } from './MobileMenu';

/** The scrim fades in once the page has scrolled this far (§6). */
const SCRIM_AFTER_PX = 40;

/**
 * Active-dot hook: Rail publishes the chapter in hold on
 * html[data-active-chapter] (home only). Static strings, so Tailwind sees them.
 */
const ACTIVE: Record<NavChapterId, { link: string; dot: string }> = {
  about: {
    link: '[html[data-active-chapter=about]_&]:text-ink',
    dot: '[html[data-active-chapter=about]_&]:opacity-100',
  },
  work: {
    link: '[html[data-active-chapter=work]_&]:text-ink',
    dot: '[html[data-active-chapter=work]_&]:opacity-100',
  },
  capabilities: {
    link: '[html[data-active-chapter=capabilities]_&]:text-ink',
    dot: '[html[data-active-chapter=capabilities]_&]:opacity-100',
  },
  contact: {
    link: '[html[data-active-chapter=contact]_&]:text-ink',
    dot: '[html[data-active-chapter=contact]_&]:opacity-100',
  },
};

/**
 * "Stephen Webb" split for the collapse to "SW" after the hero (§6). The
 * folds are 1fr → 0fr grid tracks; the scroll phase sets data-collapsed on
 * the header. The accessible name stays the full name.
 */
function Wordmark() {
  const fold =
    'inline-grid grid-cols-[1fr] transition-[grid-template-columns] duration-500 ease-cine rm:transition-none group-data-[collapsed]/nav:grid-cols-[0fr]';
  return (
    <span aria-hidden="true" className="inline-flex whitespace-nowrap">
      <span>S</span>
      <span className={fold}>
        <span className="min-w-0 overflow-hidden">tephen{' '}</span>
      </span>
      <span>W</span>
      <span className={fold}>
        <span className="min-w-0 overflow-hidden">ebb</span>
      </span>
    </span>
  );
}

/**
 * Fixed nav (SPEC §6): 64px (56px mobile), never hides. A 96px (mobile 80px) void scrim
 * fades in after 40px of scroll (data-scrolled, set from a passive listener —
 * no React state per scroll). Wordmark → "/"; desktop chapter links with an
 * active dot and the Email pill; a Menu button opens the mobile overlay.
 * Chapter links jump in place on home and navigate to /#id elsewhere.
 */
export default function Nav() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Scrim toggle: passive scroll listener, rAF-throttled, writes an attribute.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let raf = 0;
    let scrolled: boolean | null = null;
    const update = () => {
      raf = 0;
      const next = window.scrollY > SCRIM_AFTER_PX;
      if (next === scrolled) return;
      scrolled = next;
      header.toggleAttribute('data-scrolled', next);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // The menu never outlives its route or the mobile layout.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(
    () =>
      subscribeLayoutMode((mode) => {
        if (mode === 'desktop') setMenuOpen(false);
      }),
    [],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const onChapterClick = (event: MouseEvent<HTMLAnchorElement>, id: JumpId) => {
    if (!isPlainClick(event)) return;
    // Close synchronously so the scroll lock is released and focus is back
    // on the Menu button before the jump moves it to the chapter heading.
    if (menuOpen) flushSync(() => setMenuOpen(false));
    if (onHome && jumpToChapter(id)) event.preventDefault();
    // Elsewhere <Link> navigates to /#id and the App scrolls once it renders.
  };

  return (
    <>
      <header ref={headerRef} className="group/nav fixed inset-x-0 top-0 z-40">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 mobile:h-20 bg-linear-to-b from-void from-85% to-transparent opacity-0 transition-opacity duration-240 ease-ui group-data-[scrolled]/nav:opacity-100"
        />
        <nav aria-label="Primary" className="flex h-16 items-center justify-between gap-6 px-gutter mobile:h-14">
          <Link
            to="/"
            aria-label={nav.wordmark}
            onClick={(e) => onChapterClick(e, 'top')}
            className="t-label -mx-2 inline-flex min-h-11 items-center px-2 text-ink"
          >
            <Wordmark />
          </Link>

          <div className="flex items-center gap-x-8 mobile:hidden xl:gap-x-10">
            <ul className="flex items-center gap-x-6 xl:gap-x-8">
              {nav.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/#${item.id}`}
                    onClick={(e) => onChapterClick(e, item.id)}
                    className={`t-label relative inline-flex min-h-11 items-center gap-[0.6em] text-ink-2 transition-colors duration-240 ease-ui hover:text-ink focus-visible:text-ink ${ACTIVE[item.id].link}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-1/2 -left-3 size-1 -translate-y-1/2 rounded-full bg-ember opacity-0 transition-opacity duration-240 ease-ui ${ACTIVE[item.id].dot}`}
                    />
                    <span aria-hidden="true">{item.num}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <a href={nav.email.href} aria-label={nav.email.ariaLabel} className="btn btn-outline-ember min-h-11 px-5">
              <LinkLabel cta={nav.email} />
            </a>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen(true)}
            className="t-label -mr-2 inline-flex min-h-11 items-center gap-2 px-2 text-ink desktop:hidden nojs:hidden"
          >
            {nav.menu.open}
            <Menu aria-hidden="true" size={16} strokeWidth={1.5} />
          </button>
        </nav>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        onChapterClick={onChapterClick}
        returnFocusRef={menuButtonRef}
      />
    </>
  );
}
