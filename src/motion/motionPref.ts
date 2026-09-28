/**
 * Motion preference (SPEC §8.2): reduced when the visitor chose "Reduced" in
 * the footer toggle, or when the OS asks for reduced motion and they have not
 * explicitly chosen "Full". The choice persists in localStorage['dtw:motion'].
 *
 * html.rm is set before first paint by the inline script in index.html; this
 * module keeps it in sync afterwards (OS changes, the toggle, other tabs).
 * html.rm flips synchronously *before* subscribers run, so a subscriber can
 * revert its gsap contexts / Lenis and then ScrollTrigger.refresh().
 */
import { useSyncExternalStore } from 'react';

export type MotionPref = 'full' | 'reduced';
/** The visitor's explicit choice, or null to follow the OS setting. */
export type MotionChoice = MotionPref | null;

export const MOTION_STORAGE_KEY = 'dtw:motion';
const QUERY = '(prefers-reduced-motion: reduce)';

type Listener = (pref: MotionPref) => void;
const listeners = new Set<Listener>();
let mql: MediaQueryList | null = null;
let choice: MotionChoice = null;
let current: MotionPref = 'full';
let ready = false;

function readChoice(): MotionChoice {
  try {
    const v = localStorage.getItem(MOTION_STORAGE_KEY);
    return v === 'full' || v === 'reduced' ? v : null;
  } catch {
    return null;
  }
}

function writeChoice(c: MotionChoice): void {
  try {
    if (c) localStorage.setItem(MOTION_STORAGE_KEY, c);
    else localStorage.removeItem(MOTION_STORAGE_KEY);
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
}

const osPref = (): MotionPref => (mql?.matches ? 'reduced' : 'full');
const resolve = (): MotionPref => choice ?? osPref();

function apply(): void {
  const next = resolve();
  document.documentElement.classList.toggle('rm', next === 'reduced');
  if (next === current) return;
  current = next;
  for (const fn of [...listeners]) fn(next);
}

/** Idempotent. Called at boot from main.tsx; every getter also calls it lazily. */
export function initMotionPref(): void {
  if (ready || typeof window === 'undefined') return;
  ready = true;
  try {
    mql = window.matchMedia(QUERY);
  } catch {
    mql = null;
  }
  choice = readChoice();
  current = resolve();
  document.documentElement.classList.toggle('rm', current === 'reduced');
  mql?.addEventListener('change', apply);
  window.addEventListener('storage', (e) => {
    if (e.key !== MOTION_STORAGE_KEY) return;
    choice = readChoice();
    apply();
  });
}

/** The resolved preference right now. */
export function getMotionPref(): MotionPref {
  initMotionPref();
  return current;
}

export const isReducedMotion = (): boolean => getMotionPref() === 'reduced';

/** The explicit choice stored by the toggle (null = following the OS). */
export function getMotionChoice(): MotionChoice {
  initMotionPref();
  return choice;
}

/**
 * Set the preference. A choice equal to the OS setting is stored as "follow
 * the OS" (null), so later OS changes still apply.
 */
export function setMotionPref(next: MotionChoice): void {
  initMotionPref();
  choice = next === osPref() ? null : next;
  writeChoice(choice);
  apply();
}

/** Flip Full ↔ Reduced (the footer toggle). Returns the new preference. */
export function toggleMotionPref(): MotionPref {
  setMotionPref(getMotionPref() === 'reduced' ? 'full' : 'reduced');
  return current;
}

/** Listen for changes of the resolved preference. Returns an unsubscribe function. */
export function subscribeMotionPref(fn: Listener): () => void {
  initMotionPref();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export { subscribeMotionPref as subscribe };

/** React: the resolved preference; re-renders when it changes. */
export function useMotionPref(): MotionPref {
  return useSyncExternalStore(subscribeMotionPref, getMotionPref, () => 'full');
}

/** React: true under reduced motion. */
export function useReducedMotion(): boolean {
  return useMotionPref() === 'reduced';
}
