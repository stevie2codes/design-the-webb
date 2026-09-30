/**
 * Site theme (sketch branch): `html[data-theme]` is "sketch" (a hand-drawn
 * notebook on paper) or "ink" (the original dark field). The pre-paint
 * script in index.html sets it before first paint from
 * localStorage['dtw:theme'] (default DEFAULT_THEME), and the static
 * attribute on <html> covers no-JS. CSS swaps the colour tokens and type
 * roles under [data-theme="sketch"]; the field engine and the Canvas2D
 * fallback subscribe with onThemeChange (clear colour, blending, palette,
 * sprite shapes, and an S1 resample for the hand-lettered name).
 *
 * Pure and tiny: safe in the initial bundle and in the lazy field chunks.
 * SSR-safe (no DOM access at import).
 */
import { useSyncExternalStore } from 'react';

export type Theme = 'sketch' | 'ink';

export const THEME_KEY = 'dtw:theme';
export const DEFAULT_THEME: Theme = 'sketch';
/** Paper and void, for <meta name="theme-color"> (keep in sync with index.css). */
export const THEME_BG: Readonly<Record<Theme, string>> = { sketch: '#f3eee3', ink: '#050507' };

const listeners = new Set<(t: Theme) => void>();

export function getTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const t = document.documentElement.dataset.theme;
  return t === 'ink' || t === 'sketch' ? t : DEFAULT_THEME;
}

export function setTheme(t: Theme): void {
  if (typeof document === 'undefined' || t === getTheme()) return;
  const d = document.documentElement;
  d.dataset.theme = t;
  d.style.background = THEME_BG[t];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[t]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t === 'ink' ? 'dark' : 'light');
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage blocked: the choice lasts for this page view */
  }
  for (const fn of listeners) fn(t);
}

export function toggleTheme(): void {
  setTheme(getTheme() === 'sketch' ? 'ink' : 'sketch');
}

/** Subscribe to theme changes; returns the unsubscribe function. */
export function onThemeChange(fn: (t: Theme) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React: the current theme (the server snapshot is the default). */
export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => onThemeChange(cb),
    getTheme,
    () => DEFAULT_THEME,
  );
}
