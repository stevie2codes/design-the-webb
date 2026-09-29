/**
 * Layout mode (SPEC §2.6, §4.2): 'mobile' when width < 768, or width < 1024
 * in portrait (short landscape phones stay 'desktop'). The rule is MQ.mobile
 * in src/field/layout.ts, the same query the pre-paint script and the
 * `mobile:` Tailwind variant use. Keeps html[data-layout] in sync.
 */
import { useSyncExternalStore } from 'react';
import { MQ, type LayoutMode } from '../field/layout';

export type { LayoutMode };

type Listener = (mode: LayoutMode) => void;
const listeners = new Set<Listener>();
let mql: MediaQueryList | null = null;
let current: LayoutMode = 'desktop';
let ready = false;

const read = (): LayoutMode => (mql?.matches ? 'mobile' : 'desktop');

function apply(): void {
  const next = read();
  document.documentElement.setAttribute('data-layout', next);
  if (next === current) return;
  current = next;
  for (const fn of [...listeners]) fn(next);
}

/** Idempotent. Called at boot from main.tsx; every getter also calls it lazily. */
export function initLayoutMode(): void {
  if (ready || typeof window === 'undefined') return;
  ready = true;
  try {
    mql = window.matchMedia(MQ.mobile);
  } catch {
    mql = null;
  }
  current = read();
  document.documentElement.setAttribute('data-layout', current);
  mql?.addEventListener('change', apply);
}

export function getLayoutMode(): LayoutMode {
  initLayoutMode();
  return current;
}

/** Listen for desktop ↔ mobile flips. Returns an unsubscribe function. */
export function subscribeLayoutMode(fn: Listener): () => void {
  initLayoutMode();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * React: the current layout mode. §9.7: when it flips, remount the home
 * chapters (`key={layout}`) before the field regenerates.
 */
export function useLayoutMode(): LayoutMode {
  // getLayoutMode doubles as the server snapshot: 'desktop' in the prerender
  // (no window), the real mode while hydrating. The mode only keys the home
  // chapters (and effects), never the markup, so hydration still matches and
  // a mobile first load does not remount every chapter right after hydrating.
  return useSyncExternalStore(subscribeLayoutMode, getLayoutMode, getLayoutMode);
}
