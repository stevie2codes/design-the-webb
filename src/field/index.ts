/**
 * Field entry (SPEC §8.4, §9.1, §9.10): feature detection, then a dynamic
 * import of the WebGL engine (or, later, the Canvas2D fallback), behind a
 * ref-counted, StrictMode-safe acquire/release.
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. Owner: engine.
 *
 * This module is in the initial bundle: it must never import `three`
 * statically (only `import('./engine')`). SSR-safe: nothing runs at import.
 *
 * Integration (see docs/redesign/CONTRACTS.md):
 * - App shell: render <FieldCanvas /> (field/FieldCanvas.tsx) in place of the
 *   `#field-root` placeholder. It acquires on mount (after first paint, in an
 *   idle callback), releases on unmount, and forwards the motion preference
 *   to `handle.setMode`.
 * - Everything else is automatic: the intro, the lock print (from the
 *   director's lockEdge), the probe, resize regeneration, context loss.
 * - Reduced motion: the scroll infra's passive scroll listener calls
 *   `handle.invalidate()` (the handle comes from `getField()`).
 */
import type { LayoutMode } from './layout.ts';
import type { TierName } from './tiers.ts';
import { isFeebleDevice, readTierEnv } from './tiers.ts';
import { exposeGlobal, getDebugParams } from '../debugParams.ts';
import { frame } from '../scroll/director.ts';
import { store, type FieldFrame, type FieldStore } from '../scroll/store.ts';

/** Motion mode of a running field (§8.2 step 5: `handle.setMode`). */
export type FieldMode = 'full' | 'reduced';

/** What is drawing: WebGL2 engine, the Canvas2D fallback, or nothing (CSS glow). */
export type FieldKind = 'webgl' | 'canvas2d' | 'none';

/**
 * Why the loop is paused. Pauses are per reason: the loop runs only when
 * no reason holds (e.g. the menu closes while the tab is still hidden).
 */
export type PauseReason = 'hidden' | 'menu' | 'context-lost' | 'route' | 'debug';

export interface FieldBootOptions {
  mode: FieldMode;
  layout: LayoutMode;
  /** Forced tier (QA `?tier=`); null → the §3.2 rule + probe. */
  tier: TierName | null;
  /** `?debug=field` overlay. */
  debug: boolean;
  /** Run the §6 intro (false with `?intro=0`, `?film=`, or when the hero is past p .06). */
  intro: boolean;
  /** Create the context without failIfMajorPerformanceCaveat (QA on SwiftShader). */
  softwareGL: boolean;
}

/**
 * The §6 intro ("the defocus"), engine side. It runs by itself when the field
 * becomes ready on the home route with the hero at p < .06, full motion and
 * `opts.intro`; any wheel / touch / key / pointerdown skips it. While it runs
 * `html[data-intro="running"]` is set (CSS can hold the scroll cue until it
 * ends, §6 step 4).
 */
export interface FieldIntro {
  /** Run it now (no-op while running / under reduced motion). Resolves when it ends or is skipped. */
  run(): Promise<void>;
  /** End it now: the damp glides to the scroll target, print follows the lock (§6 step 5). */
  skip(): void;
  readonly running: boolean;
}

/** A snapshot for QA / the debug overlay (`window.__field.stats()`). */
export interface FieldStats {
  readonly ready: boolean;
  readonly mode: FieldMode;
  /** Drawn tier (the warm-up probe may lower High → Mid by drawRange). */
  readonly tier: TierName;
  /** Tier the textures were built for (fixed per session). */
  readonly textureTier: TierName;
  /** `?tier=` forced it (no probe, no adaptive downgrade). */
  readonly forced: boolean;
  readonly N: number;
  readonly drawRange: number;
  readonly dpr: number;
  readonly glow: boolean;
  readonly bokehCap: number;
  readonly fps: number;
  /** Highest k with S0…Sk resident (the director's film ceiling). */
  readonly ceiling: number;
  /** State ids with resident textures. */
  readonly resident: readonly number[];
  /** Adaptive steps fired so far (§3.2). */
  readonly adaptive: readonly string[];
  readonly lost: boolean;
  readonly intro: boolean;
  /** S1 sampling: from the DOM h1 or the layout.ts fallback; font state; ms. */
  readonly name: { readonly source: 'dom' | 'layout'; readonly fontReady: boolean; readonly ms: number } | null;
  readonly cores: number;
}

/** The running field. Methods are safe to call at any time, including after dispose (no-ops). */
export interface FieldHandle {
  readonly kind: FieldKind;
  /** Current tier (live getter: the probe / adaptive downgrade may lower it). Null unless WebGL. */
  readonly tier: TierName | null;
  /** Ready (§6: three loaded, fonts loaded, S0 + S1 built, one frame rendered). */
  readonly ready: boolean;
  /** The §6 intro. */
  readonly intro: FieldIntro;
  /**
   * Force the hero print (normally automatic: the engine reacts to the
   * director's lock edge, §9.5). true = beam + print + relax to the halo;
   * false = the 120 ms unprint.
   */
  print(on: boolean): void;
  /** QA snapshot; null unless a renderer is running. */
  stats(): FieldStats | null;
  /** Full ↔ reduced motion: rAF loop ↔ on-demand renders with frozen uTime (§8.2). */
  setMode(mode: FieldMode): void;
  pause(reason: PauseReason): void;
  resume(reason: PauseReason): void;
  /** Render one frame soon (on-demand paths: reduced motion scroll, fallback, debug). */
  invalidate(): void;
  /**
   * Called once when the field is ready (§6: three loaded, fonts loaded,
   * S0 + S1 built, one frame rendered off-screen) — immediately if it
   * already is. Returns an unsubscribe function.
   */
  onReady(cb: () => void): () => void;
  /** Release every GPU resource and listener; the canvas stays in the DOM. */
  dispose(): void;
}

/** What `window.__field` exposes (dev, or `?debug`). Read-only by convention. */
export interface FieldDebugHandle {
  readonly store: FieldStore;
  /** The director's reused frame (the one the engine rendered last). */
  readonly frame: Readonly<FieldFrame>;
  readonly tier: TierName | null;
  readonly kind: FieldKind;
  /** The field is drawing (QA: `await page.waitForFunction(() => window.__field?.ready)`). */
  readonly ready: boolean;
  stats(): FieldStats | null;
}

/**
 * The module contract of `./engine` (WebGL) and later `./fallback2d`
 * (Canvas2D): `export const createEngine: CreateField`. The context is
 * created here, on the host canvas, so detection never costs a second
 * WebGL context (§12: StrictMode creates exactly one).
 */
export type CreateField<Ctx> = (
  canvas: HTMLCanvasElement,
  ctx: Ctx,
  opts: FieldBootOptions,
) => Promise<FieldHandle>;

/** WebGL2 context attributes (§3.4 renderer). */
export function glAttributes(softwareGL: boolean): WebGLContextAttributes {
  return {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: !softwareGL,
  };
}

/** Boot options from the current page state and the QA params. Browser only. */
export function defaultBootOptions(mode: FieldMode, layout: LayoutMode): FieldBootOptions {
  const q = getDebugParams();
  return { mode, layout, tier: q.tier, debug: q.field, intro: q.intro, softwareGL: q.softwareGL };
}

const inertIntro: FieldIntro = {
  run: () => Promise.resolve(),
  skip() {},
  running: false,
};

function inertHandle(kind: FieldKind): FieldHandle {
  return {
    kind,
    tier: null,
    ready: false,
    intro: inertIntro,
    print() {},
    stats: () => null,
    setMode() {},
    pause() {},
    resume() {},
    invalidate() {},
    onReady() {
      return () => {};
    },
    dispose() {},
  };
}

/**
 * Detect, then load and start a renderer on `canvas` (§8.4). Never throws:
 * failures resolve to a handle of kind 'canvas2d' or 'none'.
 */
export async function bootField(canvas: HTMLCanvasElement, opts: FieldBootOptions): Promise<FieldHandle> {
  if (typeof window === 'undefined') return inertHandle('none');
  if (isFeebleDevice(readTierEnv())) {
    // TODO(phase8-engine): Canvas2D fallback — import('./fallback2d').
    return inertHandle('none');
  }
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', glAttributes(opts.softwareGL));
  } catch {
    gl = null;
  }
  if (!gl) {
    // TODO(phase8-engine): Canvas2D fallback — import('./fallback2d').
    return inertHandle('none');
  }
  try {
    const { createEngine } = await import('./engine.ts');
    return await createEngine(canvas, gl, opts);
  } catch (e) {
    // Chunk load failure or a throw during setup: keep the CSS glow.
    console.error('[field] engine failed to start', e);
    // TODO(phase8-engine): Canvas2D fallback — import('./fallback2d').
    return inertHandle('none');
  }
}

// ---------------------------------------------------------------------------
// Ref-counted singleton (§9.10).

let refs = 0;
let current: Promise<FieldHandle> | null = null;
let currentHandle: FieldHandle | null = null;
let currentCanvas: HTMLCanvasElement | null = null;
let disposeTimer: ReturnType<typeof setTimeout> | null = null;
let unexpose: () => void = () => {};

/**
 * Take a reference on the field for `canvas` (FieldCanvas's mount effect).
 * StrictMode's unmount/remount returns the same handle: the dispose that
 * releaseField() scheduled is cancelled.
 */
export function acquireField(canvas: HTMLCanvasElement, opts: FieldBootOptions): Promise<FieldHandle> {
  refs++;
  if (disposeTimer !== null) {
    clearTimeout(disposeTimer);
    disposeTimer = null;
  }
  if (current && currentCanvas === canvas) return current;
  if (current) void current.then((h) => h.dispose());
  currentHandle = null;
  currentCanvas = canvas;
  const booting = bootField(canvas, opts);
  current = booting;
  void booting.then((h) => {
    if (current !== booting) return;
    currentHandle = h;
    unexpose();
    unexpose = exposeGlobal('__field', {
      store,
      frame,
      get tier() {
        return h.tier;
      },
      kind: h.kind,
      get ready() {
        return h.ready;
      },
      stats: () => h.stats(),
    });
  });
  return booting;
}

/**
 * Drop a reference (FieldCanvas's cleanup). The last release disposes after
 * one macrotask, unless a re-acquire arrives first.
 */
export function releaseField(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0 || !current || disposeTimer !== null) return;
  disposeTimer = setTimeout(() => {
    disposeTimer = null;
    if (refs > 0 || !current) return;
    const dying = current;
    current = null;
    currentHandle = null;
    currentCanvas = null;
    unexpose();
    unexpose = () => {};
    void dying.then((h) => h.dispose());
  }, 0);
}

/**
 * The running field's handle, or null before it has booted / after dispose.
 * Synchronous, for code outside React: the reduced-motion scroll listener
 * (`getField()?.invalidate()`), the mobile menu (`pause('menu')`), QA.
 */
export function getField(): FieldHandle | null {
  return currentHandle;
}
