/**
 * The chapters' view of the film (SPEC §5, §8.5, §9.5): what the field is
 * DISPLAYING right now, so DOM moments (the C1 numerals, the AI ignition,
 * the C4 plate focus, the C5 ignition) follow the grains on screen, not the
 * scroll target.
 *
 * - `watchFilm(gsap, fn)`: one shared gsap ticker listener that calls every
 *   subscriber once per tick with the director's displayed film position.
 *   It keeps itself AFTER the engine's renderFrame in the tick (§9.5 order):
 *   when it sees that the engine has produced frames recently but not yet
 *   this tick, it re-adds itself at the end of the ticker (rate-limited), so
 *   subscribers read the frame that is painted in the same rAF. Full motion
 *   only: under reduced motion the ticker must be allowed to sleep (§8.2 on
 *   demand), so chapters there read `posterF()` from scroll events instead.
 * - `fieldDraws(state)` / `onFieldStates(fn)`: whether the live WebGL field
 *   is drawing a state (html[data-field="live"][data-field-states~="k"], the
 *   same test as the `field-sN:` CSS variants), cached by a MutationObserver
 *   so nothing reads the DOM per frame.
 * - `invalidateField()`: ask the engine for a frame (reduced motion renders
 *   on demand; in full motion it also resets the 30 fps idle throttle).
 *
 * No gsap import (it is lazy, motion/lazy.ts): callers pass the instance
 * they got from their useChapter context. SSR-safe: nothing runs at import.
 */
import { getField } from '../../field';
import type { StateId } from '../../field/states/ids';
import type { ScrollRuntime } from '../../motion/lazy';
import { frame, posterState } from '../../scroll/director';
import { store, type FieldFrame } from '../../scroll/store';

type Gsap = ScrollRuntime['gsap'];
type Ticker = Gsap['ticker'];

/** A subscriber: displayed film position F, the director's frame (read-only, reused), tick time (s). */
export type FilmListener = (F: number, f: Readonly<FieldFrame>, time: number) => void;

const listeners = new Set<FilmListener>();
let ticker: Ticker | null = null;
let lastReorder = -Infinity;
/** The engine counts as ticking when its last frame is this recent (s). */
const ENGINE_RECENT_S = 0.1;
/** Re-add ourselves behind the engine at most this often (s). */
const REORDER_EVERY_S = 0.5;

function onTick(time: number): void {
  const t = ticker;
  if (!t) return;
  // Behind the engine: re-add at the end of the listener list (next tick on).
  if (frame.now !== time && frame.now > 0 && time - frame.now < ENGINE_RECENT_S && time - lastReorder > REORDER_EVERY_S) {
    lastReorder = time;
    t.remove(onTick);
    t.add(onTick);
  }
  const F = frame.F;
  for (const fn of listeners) fn(F, frame, time);
}

/**
 * Call `fn` once per gsap tick with the displayed film (full motion only).
 * Returns the unsubscribe function; the shared listener leaves the ticker
 * with its last subscriber. `fn` must not read layout or render React.
 */
export function watchFilm(gsap: Gsap, fn: FilmListener): () => void {
  listeners.add(fn);
  if (!ticker) {
    ticker = gsap.ticker;
    ticker.add(onTick);
  }
  fn(frame.F, frame, gsap.ticker.time);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && ticker) {
      ticker.remove(onTick);
      ticker = null;
    }
  };
}

/**
 * The film position a reduced-motion visitor sees at rest (§8.2): the poster
 * of the chapter that has crossed 50% of the viewport (an integer state id).
 * Pure store read; call it from scroll callbacks.
 */
export function posterF(): number {
  return posterState(store);
}

// ---------------------------------------------------------------------------
// Which states the live field draws (html attributes, cached).

let observer: MutationObserver | null = null;
let live = false;
let drawn = new Set<number>();
const stateListeners = new Set<() => void>();

function readStates(): void {
  const html = document.documentElement;
  const nextLive = html.getAttribute('data-field') === 'live';
  const ids = (html.getAttribute('data-field-states') ?? '').split(/\s+/).filter(Boolean).map(Number);
  const next = new Set(ids);
  let changed = nextLive !== live || next.size !== drawn.size;
  if (!changed) for (const id of next) if (!drawn.has(id)) changed = true;
  live = nextLive;
  drawn = next;
  if (changed) for (const fn of [...stateListeners]) fn();
}

function ensureObserver(): void {
  if (observer || typeof document === 'undefined') return;
  readStates();
  observer = new MutationObserver(readStates);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-field', 'data-field-states'] });
}

/** The live WebGL field is drawing `state` (the `field-sN:` CSS test). Browser only. */
export function fieldDraws(state: StateId): boolean {
  ensureObserver();
  return live && drawn.has(state);
}

/** Called whenever the live flag or the resident state list changes. Returns the unsubscribe function. */
export function onFieldStates(fn: () => void): () => void {
  ensureObserver();
  stateListeners.add(fn);
  return () => {
    stateListeners.delete(fn);
  };
}

/** Render a frame soon (reduced motion is on demand; full motion leaves the idle throttle). */
export function invalidateField(): void {
  getField()?.invalidate();
}
