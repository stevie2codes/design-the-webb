/**
 * FieldStore (SPEC §9.2): the one plain mutable singleton that connects
 * scroll, UI and the field. No React state: React never subscribes to it.
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. The object shape is the
 * §9.2 shape verbatim; the types below only name its parts (the one type-
 * level tightening: `chapters` is Partial, because it starts empty).
 *
 * Writers (each field has exactly one owner):
 * - scroll infra (Lenis `scroll`, or the passive listener under reduced
 *   motion): `scroll.y`, `scroll.vel`. On init / resize / refresh only:
 *   `scroll.W`, `scroll.H`, `layout`, `mode`.
 * - chapter ScrollTriggers (useChapter): `chapters`, `anchors`, `safe`,
 *   `segments` (via segments.resolve), `version`, and the scrubbed fx
 *   (`disperse`, `sink`).
 * - UI handlers: `fx.charge`, `fx.groupW`, `fx.focusOn`, `fx.nova`,
 *   `fx.beat`, `flags.menuOpen`, `flags.rewinding`, `route`.
 * - engine: `fx.printed`, `fx.scanX`, `fx.exposure` (intro, print,
 *   ignition), `fx.ripple`, `pointer`, `flags.intro`, `flags.hidden`,
 *   `film.override` during the intro.
 * - director (tick): `film.target`, `film.shown`, `film.farFor`,
 *   `film.lastCut`, `flags.printedLock`.
 * - `fx.opacity`: route transitions / menu (UI). The jump cut does NOT
 *   write it; the director multiplies its own cut fade into FieldFrame.opacity.
 *
 * Readers: the engine's render loop (through director.tick), plus HUD,
 * Rail and Nav through refs at ≤ 10 Hz.
 *
 * Units: every length here is CSS px (viewport, stage-local or document,
 * as noted) except `fx.scanX`, which is su (engine-owned). Times are
 * seconds on the gsap ticker clock (`gsap.ticker.time`).
 *
 * SSR-safe: nothing here touches window/document.
 */
import type { LayoutMode } from '../field/layout.ts';
import type { StateId } from '../field/states/ids.ts';
import type { MouseMode, PathId } from '../field/uniforms.ts';
import type { ChapterId } from './chapters.ts';

export type { ChapterId };

// ---------------------------------------------------------------------------
// Parts of the store.

/** Which renderer path the page is on (§9.12). 'full' | 'reduced' are WebGL motion modes. */
export type StoreMode = 'full' | 'reduced' | 'fallback' | 'css';

export type RouteKind = 'home' | 'detail' | '404';

/**
 * One chapter's document geometry, written in its ScrollTrigger `onRefresh`
 * (top / height / L / sticky) and `onUpdate` / `onToggle` (progress /
 * active). The footer (C6) is recorded too: its `top` is the sink horizon.
 */
export interface ChapterRecord {
  /** Section top in document px. */
  top: number;
  /** Section height in px. */
  height: number;
  /** Sticky length in px (`self.end − self.start`); 0 for flow chapters. */
  L: number;
  /** The stage is actually sticky right now (computed position, fit guard included). */
  sticky: boolean;
  /** ScrollTrigger progress 0–1 (sticky: over L; flow: 'top bottom' → 'bottom top'). */
  progress: number;
  active: boolean;
}

/** A film segment resolved to px (§4.3): S_a → S_b while scrollY runs y0 → y1. b = a + 1. */
export interface Seg {
  a: StateId;
  b: StateId;
  y0: number;
  y1: number;
}

/**
 * Director override (§6 intro, §9.4 route mode).
 * - Home film pair (b = a + 1): the target is F* = a + m (the intro takes m 1 → 0).
 * - Route pair (b ≠ a + 1, or route.kind ≠ 'home'): the frame shows (a, b) at mix m directly.
 * - `snap`: no damp and no jump cut; the displayed value equals the target
 *   every frame (QA `?film=` pin, jump-cut resync). A type-level addition to
 *   §9.2; the runtime shape is still `film.override: null | {…}`.
 */
export interface FilmOverride {
  a: StateId;
  b: StateId;
  m: number;
  snap?: boolean;
}

/**
 * A measured anchor box (registerChapterRects, refresh only). Centre and
 * size in px, relative to the chapter's STAGE when the stage is sticky, to
 * the chapter's SECTION when it is flow, and to the viewport when
 * `chapter === 'viewport'` (S0, S10).
 */
export interface AnchorRecord {
  chapter: ChapterId | 'viewport';
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * A `[data-safe]` block, in the same frame as AnchorRecord (stage-local for
 * sticky, section-local for flow). `panel` is the C3 window index (0–3) of
 * the `[data-panel]` it sits in, so only the active window's text masks the
 * field — a type-level addition to §9.2 (inactive panels stay in the DOM).
 */
export interface SafeRecord {
  chapter: ChapterId;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  panel?: number;
}

/** Touch ripple: viewport px x, y; t0 in seconds (gsap.ticker.time; −1 = none); amp. */
export type Ripple = [x: number, y: number, t0: number, amp: number];

// ---------------------------------------------------------------------------
// The store (§9.2).

export const store = {
  mode: 'full' as StoreMode,
  layout: 'desktop' as LayoutMode,
  route: { kind: 'home' as RouteKind, slug: '' },
  /**
   * y: scrollY in px (Lenis `animatedScroll`); vel: Lenis velocity (px/frame).
   * W: viewport width (CSS px). H: the SMALL viewport height (100svh in px:
   * the stage height and the svh basis of layout.ts / segments.ts). Not the
   * canvas height — the canvas is 100lvh and only the engine measures it.
   */
  scroll: { y: 0, vel: 0, H: 0, W: 0 },
  chapters: {} as Partial<Record<ChapterId, ChapterRecord>>, // top/height on refresh only
  segments: [] as Seg[], // px, resolved on refresh
  film: { target: 0, shown: 0, farFor: 0, lastCut: -1, override: null as null | FilmOverride },
  fx: {
    /** Per-group focus weight targets (1 = neutral); the director damps them. */
    groupW: new Float32Array(8).fill(1),
    focusOn: 0,
    disperse: 0,
    charge: 0,
    nova: 0,
    beat: 0,
    sink: 0,
    printed: 0,
    /** Hero beam position in su (engine-owned). */
    scanX: 0,
    exposure: 1,
    opacity: 1,
    ripple: [0, 0, -1, 0] as Ripple,
  },
  anchors: new Map<StateId, AnchorRecord>(),
  safe: [] as SafeRecord[], // stage-local px
  /** Pointer in viewport CSS px (clientX/Y). `fine`: pointer: fine and full motion. */
  pointer: { x: 0, y: 0, active: false, fine: false },
  flags: { rewinding: false, intro: false, menuOpen: false, hidden: false, printedLock: false },
  version: 0, // bumped on refresh → engine regenerates if needed
};

export type FieldStore = typeof store;

// ---------------------------------------------------------------------------
// Director → engine, once per frame.

/** Entering parameters of the pair's B state (§3.9): spread S, turbulence T, path. */
export interface EnteringParams {
  stagger: number;
  turb: number;
  path: PathId;
}

/** A mutable 4-vector (reused every frame; copy with `Vector4.fromArray`). */
export type Vec4 = [number, number, number, number];
export type Vec3 = [number, number, number];

/** `uSafe[6]` + `uSafeCount`: `rects` holds 6 × (x0, y0, x1, y1) in viewport CSS px. */
export interface SafeRectBuffer {
  readonly rects: Float32Array;
  count: number;
}

/**
 * Everything the engine needs for one frame, produced by director.tick().
 * The object is allocated once and reused: read it during the frame, never
 * retain it (copy what you need). Scroll-side units: viewport CSS px — the
 * engine converts xy to su with its canvas size (field/uniforms.ts pxToSu).
 */
export interface FieldFrame extends EnteringParams {
  /** gsap.ticker.time in seconds: the clock of uTime (full motion) and ripple t0. */
  now: number;
  /** Frame delta in seconds (clamped). */
  dt: number;

  /** Displayed film position after damp / override / cut (§4.3). Route mode: a + mix. */
  F: number;
  /** Target film position F* (from scroll, or the override). */
  target: number;
  /** Home segment index 0–8 (pair = seg → seg + 1); −1 in route mode. */
  seg: number;
  /** Pair on screen (`uKindA/B`, `uPosA/B`, `uMetaA/B`). */
  a: StateId;
  b: StateId;
  /** `uMix`: displayed progress within the pair. */
  mix: number;
  /** |F* − F| < 1e−3 and no cut running: the idle throttle may engage. */
  settled: boolean;
  /** A jump cut is fading (the engine may skip one-shots). */
  cutting: boolean;

  /** `uAperture` (segment-shaped, §3.9). */
  aperture: number;
  /**
   * Anchor transform per endpoint: [x, y, scale, alpha] with x, y the anchor
   * CENTRE in viewport CSS px (follows its stage every frame, sink / curtain
   * applied). The engine writes `uOffA = (pxToSu(x, y), scale, alpha)`.
   */
  offA: Vec4;
  offB: Vec4;
  /** Text-safe rects (`uSafe`, `uSafeCount`). */
  safe: SafeRectBuffer;

  /** Damped per-group focus weights (`uGroupW`, 8). */
  groupW: Float32Array;
  focusOn: number;
  disperse: number;
  charge: number;
  nova: number;
  beat: number;
  sink: number;
  printed: number;
  /** su. */
  scanX: number;
  exposure: number;
  /** fx.opacity × the jump-cut fade (`uOpacity`). */
  opacity: number;

  /** Damped pointer in viewport CSS px, z = 0 (`uMouse` after pxToSu). */
  mouse: Vec3;
  /** `uMouseAmt` 0–1 (eases to 0 over 400 ms on leave / blur / coarse / reduced). */
  mouseAmt: number;
  /** `uMouseMode` of the dominant endpoint. */
  mouseMode: MouseMode;
  /** `uRipple`: viewport px x, y, t0 (s, same clock as `now`), amp. */
  ripple: Vec4;

  /** `uVelocity`: Lenis velocity / 40, clamped ±1. */
  velocity: number;
  /** `uScrollPx`: scrollY in px (dust parallax). */
  scrollPx: number;

  /** Hero lock edge this frame (§9.5 Schmitt trigger): +1 rising → print, −1 falling → unprint, 0 none. */
  lockEdge: -1 | 0 | 1;
}
