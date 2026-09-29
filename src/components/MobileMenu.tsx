import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { nav, socials } from '../content/site';
import { useReducedMotion } from '../motion/motionPref';
import LinkLabel from './LinkLabel';

/** Chapters listed in the nav and the menu. */
export type NavChapterId = (typeof nav.items)[number]['id'];

export interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  /**
   * A chapter link was clicked. Nav closes the menu first, then jumps in
   * place on home; elsewhere the <Link> navigates to /#id.
   */
  onChapterClick: (event: MouseEvent<HTMLAnchorElement>, id: NavChapterId) => void;
  /** The Menu button: focus returns here on close. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Overlay fade (§6: the 400 ms open animation). */
const OPEN_MS = 400;
/** Items and footer rise in with a 60 ms stagger once the overlay opens. */
const STAGGER_MS = 60;
const FIRST_DELAY_MS = 120;

/**
 * Full-screen mobile menu (SPEC §6): `deep` at 97%, no blur. Chapter links in
 * .t-display-l, then Email / GitHub / LinkedIn at the bottom. Always mounted
 * so it can fade (400 ms); `inert` while closed. While open: page scroll is
 * locked, the rest of the page is inert, Tab is trapped, Esc closes, and
 * focus returns to the Menu button.
 *
 * Hook for the field phase: the overlay carries data-open; the engine drops
 * uOpacity to .3 and stops its loop once the open transition ends.
 */
export default function MobileMenu({ open, onClose, onChapterClick, returnFocusRef }: MobileMenuProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();

  // Layout effect: the lock and inert state must be gone synchronously when
  // Nav closes the menu with flushSync right before a chapter jump.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = returnFocusRef.current;
    const html = document.documentElement;
    const body = document.body;
    const prevOverflow = [html.style.overflow, body.style.overflow] as const;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    const siblings = Array.from(dialog.parentElement?.children ?? []).filter(
      (el): el is HTMLElement => el !== dialog && el instanceof HTMLElement && !el.inert,
    );
    for (const el of siblings) el.inert = true;

    closeRef.current?.focus({ preventScroll: true });

    return () => {
      for (const el of siblings) el.inert = false;
      html.style.overflow = prevOverflow[0];
      body.style.overflow = prevOverflow[1];
      const active = document.activeElement;
      if (!active || active === document.body || dialog.contains(active)) {
        opener?.focus({ preventScroll: true });
      }
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const items = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    if (!dialog || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /** Rise-in for the kth element: 16px + fade, opacity only under reduced motion. */
  const rise = 'translate-y-4 opacity-0 transition-[opacity,translate] duration-500 ease-out-expo group-data-[open]/menu:translate-y-0 group-data-[open]/menu:opacity-100 rm:translate-y-0 rm:duration-200';
  const fadeMs = reduced ? 200 : OPEN_MS;
  const delay = (k: number) => ({
    transitionDelay: open && !reduced ? `${FIRST_DELAY_MS + k * STAGGER_MS}ms` : '0ms',
  });

  return (
    <div
      ref={dialogRef}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label={nav.menu.open}
      inert={!open}
      data-open={open || undefined}
      onKeyDown={trapTab}
      style={{
        // Visibility flips at once on open (so focus can land) and only after
        // the fade on close.
        transitionDuration: `${fadeMs}ms, 0s`,
        transitionDelay: open ? '0s, 0s' : `0s, ${fadeMs}ms`,
      }}
      className="group/menu invisible fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-deep/97 opacity-0 transition-[opacity,visibility] ease-out-expo data-[open]:visible data-[open]:opacity-100 desktop:hidden"
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-gutter">
        <span aria-hidden="true" className="t-label text-ink">
          {nav.wordmark}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="t-label -mr-2 inline-flex min-h-11 items-center gap-2 px-2 text-ink"
        >
          {nav.menu.close}
          <X aria-hidden="true" size={16} strokeWidth={1.5} />
        </button>
      </div>

      <ul className="flex flex-1 flex-col justify-center gap-1 px-gutter py-10">
        {nav.items.map((item, i) => (
          <li key={item.id} className={rise} style={delay(i)}>
            <Link
              to={`/#${item.id}`}
              onClick={(e) => onChapterClick(e, item.id)}
              className="t-display-l flex min-h-14 items-baseline gap-4 py-1.5 text-ink transition-colors duration-240 ease-ui hover:text-ember focus-visible:text-ember"
            >
              <span aria-hidden="true" className="t-label w-7 shrink-0 text-ember">
                {item.num}
              </span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className={`mx-gutter border-t border-line pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${rise}`} style={delay(nav.items.length)}>
        <ul className="flex flex-wrap gap-x-7">
          <li>
            <a href={nav.email.href} aria-label={nav.email.ariaLabel} className="link-line t-label gap-[0.6em] text-ink">
              <LinkLabel cta={nav.email} />
            </a>
          </li>
          {socials.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="link-line t-label gap-[0.6em] text-ink">
                <LinkLabel cta={s} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
