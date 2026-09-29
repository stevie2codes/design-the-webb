/**
 * QA / debug URL parameters (SPEC §12 debug overlay) and the window globals
 * headless screenshots use to pin states deterministically.
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. Shared by both sides:
 * scroll reads `film` / `intro`; the engine reads `tier`, `field`,
 * `softwareGL`, `intro`.
 *
 *   ?debug=field     the §12 overlay (F, segment, tier, fps, safe rects,
 *                    anchor boxes, S1 glyph registration dots). `?debug`
 *                    with any value also exposes the globals below.
 *   ?film=<number>   pin the displayed film position F ∈ [0, 9] (director
 *                    override with snap: no damp, no jump cut); skips the intro.
 *   ?tier=high|mid|low   force a tier.
 *   ?intro=0         skip the intro.
 *
 * `?tier=` or `?debug` also allow software GL (SwiftShader in headless
 * Chromium): the context is then created without
 * `failIfMajorPerformanceCaveat`, which would otherwise send it to the
 * Canvas2D fallback.
 *
 * Globals (dev builds, or whenever `?debug` is present):
 *   window.__lenis   the Lenis instance (scroll infra sets it)
 *   window.__field   { store, frame, tier } read-only (field/index.ts sets it)
 *
 * SSR-safe: nothing touches window at import; getDebugParams() returns the
 * defaults on the server.
 */
import type Lenis from 'lenis';
import type { FieldDebugHandle } from './field/index.ts';
import type { TierName } from './field/tiers.ts';

export interface DebugParams {
  /** `?debug` present (any value). */
  readonly debug: boolean;
  /** `?debug=field` (comma lists allowed: `?debug=field,luma`). */
  readonly field: boolean;
  /** `?film=<number>`, clamped to [0, 9]; null when absent or not a number. */
  readonly film: number | null;
  /** `?tier=high|mid|low`; null when absent or invalid. */
  readonly tier: TierName | null;
  /** False with `?intro=0|false|off`, or when `film` is pinned. */
  readonly intro: boolean;
  /** Create the WebGL2 context without failIfMajorPerformanceCaveat (QA on SwiftShader). */
  readonly softwareGL: boolean;
  /** Expose window.__lenis / window.__field (dev, or `?debug`). */
  readonly expose: boolean;
}

export const DEFAULT_DEBUG_PARAMS: DebugParams = {
  debug: false,
  field: false,
  film: null,
  tier: null,
  intro: true,
  softwareGL: false,
  expose: false,
};

const FILM_MAX = 9;
const TIER_NAMES: readonly TierName[] = ['high', 'mid', 'low'];

/** Pure parser (tests, SSR). `dev` = import.meta.env.DEV. */
export function parseDebugParams(search: string, dev = false): DebugParams {
  const q = new URLSearchParams(search);
  const debug = q.has('debug');
  const flags = (q.get('debug') ?? '').split(',').map((s) => s.trim().toLowerCase());
  const filmRaw = q.get('film');
  const filmNum = filmRaw === null || filmRaw.trim() === '' ? NaN : Number(filmRaw);
  const film = Number.isFinite(filmNum) ? Math.min(FILM_MAX, Math.max(0, filmNum)) : null;
  const tierRaw = (q.get('tier') ?? '').toLowerCase();
  const tier = (TIER_NAMES as readonly string[]).includes(tierRaw) ? (tierRaw as TierName) : null;
  const introRaw = (q.get('intro') ?? '').toLowerCase();
  const introOff = introRaw === '0' || introRaw === 'false' || introRaw === 'off';
  return {
    debug,
    field: debug && flags.includes('field'),
    film,
    tier,
    intro: !introOff && film === null,
    softwareGL: debug || tier !== null,
    expose: dev || debug,
  };
}

let cached: DebugParams | null = null;

/** The params of this page load (parsed once). Defaults on the server. */
export function getDebugParams(): DebugParams {
  if (cached) return cached;
  if (typeof window === 'undefined') return DEFAULT_DEBUG_PARAMS;
  cached = parseDebugParams(window.location.search, import.meta.env.DEV);
  return cached;
}

/** The globals QA reads. */
export interface DebugGlobals {
  __lenis: Lenis;
  __field: FieldDebugHandle;
}

declare global {
  interface Window {
    __lenis?: Lenis;
    __field?: FieldDebugHandle;
  }
}

/**
 * Set a debug global when allowed (dev, or `?debug`). Returns a function
 * that removes it again if it still holds this value (call it on dispose).
 */
export function exposeGlobal<K extends keyof DebugGlobals>(key: K, value: DebugGlobals[K]): () => void {
  if (typeof window === 'undefined' || !getDebugParams().expose) return () => {};
  (window as Window)[key] = value as Window[K];
  return () => {
    if ((window as Window)[key] === value) delete (window as Window)[key];
  };
}
