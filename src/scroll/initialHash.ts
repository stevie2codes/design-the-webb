/**
 * The first load's URL hash (SPEC §4.4 hash jumps, §9.11).
 *
 * index.html's body script strips the hash before the first paint (so the
 * browser never jumps to a fragment before the sticky layout and the fonts
 * have settled, and the hero paints first) and keeps it in
 * `window.__dtwHash`. The pre-paint script does not expect the §6 intro when
 * there is one; the App's ScrollToHash runs the jump after the first
 * ScrollTrigger refresh and puts the hash back.
 *
 * SSR-safe: nothing touches window at import.
 */

declare global {
  interface Window {
    __dtwHash?: string;
  }
}

/** The hash the page was loaded with ('' for none), whether or not it has been handled. */
export function initialHash(): string {
  if (typeof window === 'undefined') return '';
  const h = window.__dtwHash;
  return typeof h === 'string' && h.length > 1 ? h : '';
}
