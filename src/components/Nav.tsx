import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { nav } from '../content/site';
import { loadGsap, reportLoadError } from '../motion/lazy';
import { getLenis, onSample } from '../motion/lenis';
import { isReducedMotion } from '../motion/motionPref';
import { EASE } from '../motion/tokens';
import { subscribeLayoutMode } from '../motion/useLayoutMode';
import { activeJumpIndex, isPlainClick, JUMP_ORDER, jumpTargets, jumpToChapter, type JumpId } from '../scroll/jump';
import { store } from '../scroll/store';
import LinkLabel from './LinkLabel';
import MobileMenu, { type NavChapterId } from './MobileMenu';

/** The scrim fades in once the page has scrolled this far (§6). */
const SCRIM_AFTER_PX = 40;
/** Scroll direction needs this much travel between two samples to count (wordmark collapse). */
const DIRECTION_PX = 4;
/** Desktop hero bottom (190vh) as a fallback before the hero is measured; one viewport off home. */
const HERO_END_VH = 190;
/** The menu's open animation (§6): the field fades to .3, then its loop stops. */
const MENU_FADE_S = 0.4;
const MENU_FIELD_OPACITY = 0.3;

/**
 * Published on <html> while home is mounted: the chapter whose hold the page
 * has reached ("top" … "contact"). Nav styles its active dot from it.
 */
const ACTIVE_ATTR = 'data-active-chapter';

/**
 * Active-dot hook: Nav publishes the chapter in hold on
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
 * folds are 1fr → 0fr grid tracks over 500 ms; Nav sets data-collapsed on
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
 * Fixed nav (SPEC §6): 64px (56px mobile), never hides. Wordmark → "/";
 * desktop chapter links with an active dot and the Email pill; a Menu button
 * opens the mobile overlay. Chapter links jump in place on home with the
 * §4.4 policy (glide within 2 film states, else a jump cut) and navigate to
 * /#id elsewhere.
 *
 * Driven by the store at ≤ 10 Hz (motion/lenis.ts onSample), through
 * attributes — no React state per scroll, no layout reads:
 * - `data-scrolled`: the 96px (mobile 80px) void scrim after 40px of scroll;
 * - `data-collapsed`: the wordmark folds to "SW" past the hero (y > its
 *   bottom, 190vh on desktop) while scrolling down, and expands again on
 *   upward scroll;
 * - html[data-active-chapter]: the chapter whose hold the page has reached.
 *
 * The menu also drives the field (§6): opening fades `fx.opacity` to .3 over
 * 400 ms, then sets `flags.menuOpen` (the engine stops its loop while it is
 * set); closing clears the flag at once and fades back to 1. Lenis is
 * stopped while the menu is open (the page behind it is scroll-locked).
 */
export default function Nav() {
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Scrim, wordmark collapse and active dot: the ≤ 10 Hz store sampler.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const root = document.documentElement;
    const targets: number[] = [];
    let version = -1;
    let lastY = store.scroll.y;
    let scrolled: boolean | null = null;
    let collapsed: boolean | null = null;
    let active: JumpId | null = null;

    const sample = () => {
      const y = store.scroll.y;
      const H = store.scroll.H || window.innerHeight;

      const nextScrolled = y > SCRIM_AFTER_PX;
      if (nextScrolled !== scrolled) {
        scrolled = nextScrolled;
        header.toggleAttribute('data-scrolled', nextScrolled);
      }

      const hero = store.chapters.top;
      const heroEnd = !onHome ? H : hero ? hero.top + hero.height : (HERO_END_VH * H) / 100;
      const dy = y - lastY;
      lastY = y;
      let nextCollapsed = collapsed ?? y > heroEnd;
      if (y <= heroEnd) nextCollapsed = false;
      else if (dy > DIRECTION_PX) nextCollapsed = true;
      else if (dy < -DIRECTION_PX) nextCollapsed = false;
      if (nextCollapsed !== collapsed) {
        collapsed = nextCollapsed;
        header.toggleAttribute('data-collapsed', nextCollapsed);
      }

      if (!onHome) return;
      if (store.version !== version) {
        version = store.version;
        jumpTargets(store, targets);
      }
      const k = activeJumpIndex(y, targets);
      const next = k >= 0 ? JUMP_ORDER[k] : null;
      if (next === active) return;
      active = next;
      if (next) root.setAttribute(ACTIVE_ATTR, next);
      else root.removeAttribute(ACTIVE_ATTR);
    };

    const off = onSample(sample);
    return () => {
      off();
      if (onHome) root.removeAttribute(ACTIVE_ATTR);
    };
  }, [onHome]);

  // The menu dims the field and stops its loop (§6); the page behind is locked.
  // gsap is lazy (§8.5); both tweens chain on the same promise, so an open
  // and a close always apply in order.
  useEffect(() => {
    if (!menuOpen) return;
    let open = true;
    const lenis = getLenis();
    lenis?.stop();
    const fade = isReducedMotion() ? 0 : MENU_FADE_S;
    loadGsap().then(({ gsap }) => {
      if (!open) return;
      gsap.to(store.fx, {
        opacity: MENU_FIELD_OPACITY,
        duration: fade,
        ease: EASE.outExpo,
        overwrite: true,
        onComplete: () => {
          store.flags.menuOpen = true;
        },
      });
    }, reportLoadError);
    return () => {
      open = false;
      store.flags.menuOpen = false;
      const back = isReducedMotion() ? 0 : MENU_FADE_S;
      loadGsap().then(
        ({ gsap }) => gsap.to(store.fx, { opacity: 1, duration: back, ease: EASE.outExpo, overwrite: true }),
        () => {
          store.fx.opacity = 1;
        },
      );
      getLenis()?.start();
    };
  }, [menuOpen]);

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
