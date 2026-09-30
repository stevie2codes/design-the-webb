/**
 * The WebGL field engine (SPEC §3, §6 intro, §8.4 context loss, §8.5
 * budgets, §9.5 loop, §9.7 resize, §9.9 generation, §9.10 lifecycle).
 *
 * Dynamically imported by field/index.ts after feature detection, so three
 * lives in its own chunk. Entry point: `createEngine` (the CreateField
 * contract): it wraps the context index.ts created on the host canvas, starts
 * generation, and resolves with the FieldHandle right away; readiness is
 * reported through `handle.onReady`.
 *
 * Per gsap tick (normal priority, after Lenis + ScrollTrigger + tweens):
 *   director.tick → lock edge → loop control → uniform writes → render.
 * No React, no layout reads and no allocation per frame (§8.5): the only
 * per-frame inputs are the store, the director's reused frame and numbers
 * this module keeps.
 */
import { AdditiveBlending, Color, NormalBlending, PerspectiveCamera, Scene, Vector3, Vector4, WebGLRenderer } from 'three';
import { gsap, ScrollTrigger } from '../motion/gsap.ts';
import { getDebugParams } from '../debugParams.ts';
import { getTheme, onThemeChange, type Theme } from '../theme.ts';
import { CHAPTERS } from '../scroll/chapters.ts';
import { anchorTransform } from '../scroll/anchors.ts';
import { FILM_MAX, filmOverride, setFilmCeiling, tick } from '../scroll/director.ts';
import { HERO_P } from '../scroll/segments.ts';
import { store, type FieldFrame, type Vec4 } from '../scroll/store.ts';
import { resolveAnchor } from './layout.ts';
import { StateId } from './states/ids.ts';
import { createIndexLayout, makeDust, type AnchorSize, type DustData, type GenViewport, type IndexLayout } from './states/common.ts';
import { findNameElements, isNameFontReady, sampleName, waitForNameFont, type NameElements, type NameSample } from './states/name-sampler.ts';
import { AdaptiveGovernor, dprCap, pickTier, readTierEnv, TIERS, WarmupProbe, type AdaptiveStep, type TierName } from './tiers.ts';
import { CAMERA_Z, CLEAR_COLOR, PAPER_COLOR, POSTER_TIME, SCAN_OFF, STATE_PARAMS, pxToSu } from './uniforms.ts';
import { createMeshes, createUniforms, paletteFloats, placeholderTextures, type FieldMeshes, type FieldUniforms } from './material.ts';
import { TextureSet, WORKER_BOOT_ORDER } from './textures.ts';
import { GeneratorClient, type GenJob } from './generation.ts';
import { Choreo, INTRO } from './choreo.ts';
import { attachInput } from './input.ts';
import type { DebugOverlay } from './debug.ts';
import type { LossFallback } from './fallback2d.ts';
import { clearIntroPending } from './index.ts';
import type { CreateField, FieldBootOptions, FieldHandle, FieldMode, FieldStats, PauseReason } from './index.ts';

/** §8.5 idle: 30 fps after this long with no scroll, pointer, morph or one-shot. */
const IDLE_AFTER_S = 6;
/** §6 mobile menu: the loop stops once its 400 ms open animation completes. */
const MENU_STOP_S = 0.45;
/** §9.7: debounce, then regenerate only past these deltas. */
const RESIZE_DEBOUNCE_MS = 200;
const REGEN_DW = 40;
const REGEN_DH_FINE = 120;
/** §9.7 atomic swap: dip uOpacity to .6 over 150 ms, swap, restore. */
const SWAP_DIP = { to: 0.6, dur: 0.15 } as const;
/** §8.4: crossfade back after a context restore. */
const RESTORE_FADE_S = 0.4;
/** Reduced motion (§8.2 on demand): how long an invalidation keeps frames coming. */
const DIRTY_S = 0.3;
/** §9.8: S1 is resampled in place when its anchor box changed by more than this (CSS px). */
const NAME_RESAMPLE_PX = 0.5;

const html = (): HTMLElement => document.documentElement;

type Idle = (cb: () => void) => void;
const whenIdle: Idle = (cb) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 800 });
  else setTimeout(cb, 16);
};

/** 100svh in px, measured once (generation time only; never per frame). */
function measureSvh(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h || window.innerHeight;
}

class FieldEngine {
  readonly handle: FieldHandle;

  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly opts: FieldBootOptions;
  private readonly renderer: WebGLRenderer;
  /** The void clear colour; re-applied after a context restore (three resets it to black). */
  private readonly clearColor = new Color(CLEAR_COLOR);
  private readonly camera: PerspectiveCamera;
  private readonly scene: Scene;
  private readonly uniforms: FieldUniforms;
  private readonly meshes: FieldMeshes;
  private readonly placeholder: ReturnType<typeof placeholderTextures>;
  private readonly gen: GeneratorClient;
  private readonly choreo: Choreo;

  /** Texture tier (fixed for the session) and the drawn tier (the probe may lower it). */
  private readonly texTier: TierName;
  private tier: TierName;
  private readonly forced: boolean;
  private readonly cores: number;
  private dpr: number;
  private drawN: number;
  private bokehCap: number;
  private glowOn: boolean;
  private readonly fired: AdaptiveStep[] = [];
  private probe: WarmupProbe | null = null;
  private governor: AdaptiveGovernor | null = null;

  private layout: IndexLayout | null = null;
  private dust: DustData | null = null;
  private set: TextureSet;
  private bootJob = -1;
  /** Lazy single-state jobs (states outside the boot order, e.g. S10 on the 404). */
  private readonly lazyJobs = new Set<number>();
  /**
   * Home states not built yet because the page booted on the 404 (§3.4 "S10
   * lazily, only on the 404"): generated once the route leaves the 404.
   */
  private deferredHome: StateId[] | null = null;
  /** Every state asked for once (boot, lazy): never re-requested. */
  private readonly requested = new Set<StateId>();
  private pending: {
    set: TextureSet;
    job: number;
    expect: Set<StateId>;
    name: NameSample | null;
    layoutMode: typeof store.layout;
    /** The atomic swap is fading (the set is committed at its midpoint). */
    swapping: boolean;
  } | null = null;
  /** A regeneration was asked for during a swap: run it once the swap commits. */
  private regenAfterSwap = false;
  private genLayoutMode: typeof store.layout = store.layout;
  private name: NameSample | null = null;
  /**
   * S1's scale now vs when it was sampled (§9.8): the DOM name follows
   * --name-fs on every resize, below the regeneration thresholds too. The
   * in-place resample makes it 1 again; until then S1 scales with it.
   */
  private nameK = 1;
  private nameResampling = false;
  private nameEls: NameElements = { h1: null, anchor: null };
  private fontUnlisten: (() => void) | null = null;

  private mode: FieldMode;
  private readonly pauses = new Map<PauseReason, number>();
  private ready = false;
  /** The programs are linked (compileAsync, kicked off at boot): the ready frame never links them. */
  private compiled = false;
  private readonly readyCbs = new Set<() => void>();
  private disposed = false;
  private lost = false;
  private lossCount = 0;
  private dead = false;
  /**
   * §8.4 context loss: the Canvas2D fallback (fallback2d.ts, loaded on the
   * first loss) on an overlay canvas, painted by this loop from the cached
   * arrays while the context is gone — and for good after a second loss.
   */
  private fb: LossFallback | null = null;
  private fbLoading = false;
  /** QA (`?debug`): synthetic ms added to what the probe and the governor measure. */
  private slowMs = 0;

  /** Canvas CSS size (100% × 100lvh). */
  private W = 0;
  private H = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly opacityMul = { v: 1 };
  private swapping = false;
  private lastActive = 0;
  private parity = 0;
  private lastScrollY = Number.NaN;
  private menuSince = -1;
  /** renderFrame is on the gsap ticker (always in full motion; reduced motion leaves it at rest). */
  private ticking = false;
  /** An invalidation arrived (reduced motion): the next frame opens a DIRTY_S render window. */
  private dirtyReq = false;
  private dirtyUntil = 0;
  private frozenTime = 0;
  /** The last frame drawn was settled (reduced motion stops only after drawing one). */
  private shownSettled = false;
  private seenVersion = -1;
  private fps = 60;
  private rendered = 0;
  private readonly cleanups: (() => void)[] = [];
  private debug: DebugOverlay | null = null;

  private readonly tmp2: [number, number] = [0, 0];
  private readonly tmp4: Vec4 = [0, 0, 1, 1];
  /** Crossfade stash (reduced-motion posters): the B side while pass A draws. */
  private readonly xOff = new Vector4();
  private readonly xIdle = new Vector3();
  /** html[data-field-states]: the resident state ids, as last written. */
  private statesAttr = '';

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, opts: FieldBootOptions) {
    this.canvas = canvas;
    this.gl = gl;
    this.opts = opts;
    this.mode = opts.mode;
    const env = readTierEnv();
    this.forced = opts.tier !== null;
    this.texTier = opts.tier ?? pickTier(env);
    this.tier = this.texTier;
    this.cores = env.cores;
    const spec = TIERS[this.texTier];
    this.dpr = Math.min(window.devicePixelRatio || 1, dprCap(this.texTier, env.cores));
    this.drawN = spec.N;
    this.bokehCap = spec.bokehCap;
    this.glowOn = spec.glow;

    this.renderer = new WebGLRenderer({
      canvas,
      context: gl,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'default',
    });
    this.renderer.setClearColor(this.clearColor, 1);
    this.renderer.setPixelRatio(this.dpr);
    this.camera = new PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, CAMERA_Z);
    this.scene = new Scene();
    this.placeholder = placeholderTextures();
    this.uniforms = createUniforms(this.placeholder);
    this.meshes = createMeshes(spec.N, this.uniforms, { lowTier: this.texTier === 'low' });
    this.meshes.geometry.setDrawRange(0, this.drawN);
    this.meshes.glowGeometry.setDrawRange(0, spec.sparks);
    this.scene.add(this.meshes.points);
    if (this.glowOn) this.scene.add(this.meshes.glow);
    this.applyTheme(getTheme(), false);
    this.cleanups.push(onThemeChange((t) => this.applyTheme(t, true)));
    this.uniforms.uMotion.value = this.mode === 'full' ? 1 : 0;
    this.set = new TextureSet(spec.texH, 0, 0);

    this.gen = new GeneratorClient({
      onState: (job, id, pos, meta, extras) => this.onState(job, id, pos, meta, extras),
      onMissing: (job, id) => this.onMissing(job, id),
      onError: (job, id, message) => {
        console.error(`[field] generator S${id} failed: ${message}`);
        this.onMissing(job, id);
      },
      onDone: () => {},
    });

    this.choreo = new Choreo({
      canvas,
      h1: () => (this.nameEls.h1?.isConnected ? this.nameEls.h1 : null),
      nameSpan: (out) => this.nameSpan(out),
      wake: () => this.wake(),
      cutting: () => this.frameCutting,
    });

    const tierNow = () => this.tier;
    const readyNow = () => this.ready;
    const introNow = () => this.choreo.introRunning;
    const kindNow = () => (this.lost || this.dead ? 'canvas2d' : 'webgl');
    this.handle = {
      get kind() {
        return kindNow();
      },
      get tier() {
        return tierNow();
      },
      get ready() {
        return readyNow();
      },
      setMode: (m) => this.setMode(m),
      pause: (r) => {
        this.pauses.set(r, (this.pauses.get(r) ?? 0) + 1);
      },
      resume: (r) => {
        const n = (this.pauses.get(r) ?? 0) - 1;
        if (n > 0) this.pauses.set(r, n);
        else this.pauses.delete(r);
        this.wake();
      },
      invalidate: () => this.invalidate(),
      onReady: (cb) => {
        if (this.ready) {
          cb();
          return () => {};
        }
        this.readyCbs.add(cb);
        return () => {
          this.readyCbs.delete(cb);
        };
      },
      dispose: () => this.dispose(),
      intro: {
        run: () => this.choreo.runIntro(),
        skip: () => this.choreo.skipIntro(),
        get running() {
          return introNow();
        },
      },
      print: (on) => {
        if (on) this.choreo.printOn(true);
        else this.choreo.printOff();
      },
      stats: () => this.stats(),
      debugSlowFrames: (ms) => {
        if (getDebugParams().debug) this.slowMs = Math.max(0, ms);
      },
    };
  }

  private frameCutting = false;

  // -------------------------------------------------------------------------
  // Boot (§9.9): tier → layout + perm → dust → S0 (worker) → S1 (main) →
  // first frame → S2–S9 (worker, as they arrive).

  start(): void {
    this.canvas.style.opacity = '0';
    const r = this.canvas.getBoundingClientRect();
    this.setCanvasSize(r.width || window.innerWidth, r.height || window.innerHeight);
    // Bootstrap the viewport the scroll infra normally writes (so the director
    // has a centre before its first refresh). Only when still unset.
    if (store.scroll.W === 0 || store.scroll.H === 0) {
      store.scroll.W = window.innerWidth;
      store.scroll.H = measureSvh();
    }
    const q = getDebugParams();
    if (q.film !== null && store.film.override === null) {
      store.film.override = filmOverride(q.film, true);
      store.flags.intro = false;
    }
    store.fx.scanX = SCAN_OFF;
    setFilmCeiling(0);
    html().setAttribute('data-tier', this.tier);
    this.listen();
    this.startTicking();
    if (this.opts.debug) {
      void import('./debug.ts').then(({ createDebugOverlay }) => {
        if (this.disposed) return;
        this.debug = createDebugOverlay({
          stats: () => this.stats(),
          name: () => this.name,
          gl: this.gl,
          dpr: () => this.renderer.getPixelRatio(),
        });
      });
    }
    void this.bootStates();
  }

  private async bootStates(): Promise<void> {
    const spec = TIERS[this.texTier];
    this.layout = createIndexLayout({ N: spec.N, S: spec.sparks, texH: spec.texH });
    const view = this.viewport();
    this.dust = makeDust(this.layout, view.A);
    this.set = new TextureSet(spec.texH, view.W, view.H);
    this.genLayoutMode = store.layout;
    // Route-aware (§3.4): a direct hit on the 404 builds the only state it
    // shows first, S10 right after S0, and leaves S2–S9 until a home route
    // (NotFoundPage's enterRoute('404') has run before this idle boot).
    const on404 = store.route.kind === '404';
    const first: readonly StateId[] = on404 ? [StateId.STATIC, StateId.FLATLINE] : WORKER_BOOT_ORDER;
    this.bootJob = this.gen.start(this.jobFor(first, view));
    for (const id of first) this.requested.add(id);
    this.requested.add(StateId.NAME);
    this.deferredHome = on404 ? WORKER_BOOT_ORDER.filter((id) => !first.includes(id)) : null;
    // Link the field (and glow) programs now, while the worker generates and
    // the fonts load, not inside the ready frame's task (§8.5 TBT): with
    // KHR_parallel_shader_compile the driver links off the main thread.
    // (Headless SwiftShader has no such extension: there the first draw
    // still links them, so the QA profile shows that one task.)
    const compiling = this.precompile();

    const fontReady = await waitForNameFont();
    if (this.disposed) return;
    await new Promise<void>((r) => whenIdle(r));
    if (this.disposed) return;
    this.setName(this.sampleNameInto(this.set, view));
    if (!fontReady) this.listenForFont();
    this.onSetChanged();
    await compiling;
    if (this.disposed) return;
    this.maybeReady();
  }

  /**
   * compileAsync over the scene (field + glow when on); never rejects.
   * Without KHR_parallel_shader_compile it would gain nothing (and three
   * warns): the first frame links the programs as before.
   */
  private async precompile(): Promise<void> {
    try {
      const parallel = this.gl.getExtension('KHR_parallel_shader_compile') !== null;
      if (parallel && !this.dead && !this.lost) await this.renderer.compileAsync(this.scene, this.camera);
    } catch (e) {
      console.warn('[field] precompile failed; the first frame links the programs', e);
    }
    this.compiled = true;
  }

  private viewport(): GenViewport {
    const W = this.W || window.innerWidth;
    const H = this.H || window.innerHeight;
    return { W, H, A: W / H, svh: store.scroll.H > 0 ? store.scroll.H : measureSvh() };
  }

  /** A worker job: ids + tier + viewport + anchor sizes (layout.ts, refined by measured anchors). */
  private jobFor(ids: readonly StateId[], view: GenViewport): GenJob {
    const spec = TIERS[this.texTier];
    const short = store.layout === 'mobile' && view.svh < 600;
    const vp = { W: view.W, H: view.svh };
    const anchors: Partial<Record<StateId, AnchorSize>> = {};
    for (const id of ids) {
      const b = resolveAnchor(id, store.layout, vp, short);
      const m = store.anchors.get(id);
      anchors[id] = { w: m?.w ?? b.w, h: m?.h ?? b.h, extra: b.extra };
    }
    return { ids, tier: { N: spec.N, S: spec.sparks, texH: spec.texH }, view, layout: store.layout, short, anchors };
  }

  private sampleNameInto(set: TextureSet, view: GenViewport): NameSample | null {
    if (!this.layout) return null;
    if (!this.dust || this.dust.A !== view.A) this.dust = makeDust(this.layout, view.A);
    this.nameEls = findNameElements();
    const sample = sampleName({ layout: this.layout, dust: this.dust, view, mode: store.layout, elements: this.nameEls });
    set.set(StateId.NAME, sample.pos, sample.meta);
    this.choreo.refreshDom();
    return sample;
  }

  private setName(n: NameSample | null): void {
    this.name = n;
    this.updateNameScale();
  }

  /** nameK = the S1 anchor's measured width now / at sampling (1 without a measurement). */
  private updateNameScale(): void {
    const n = this.name;
    const rec = store.anchors.get(StateId.NAME);
    this.nameK = n && rec && n.anchorW > 0 && rec.w > 0 ? rec.w / n.anchorW : 1;
  }

  /**
   * Resample S1 into the resident set, in place (§9.8): two same-size
   * texture uploads, not a regeneration. Coalesced into one idle callback.
   * It keeps the set's generation size (px-registered, like every state).
   */
  private resampleName(after?: () => void): void {
    if (this.nameResampling) return;
    this.nameResampling = true;
    whenIdle(() => {
      this.nameResampling = false;
      if (this.disposed || !this.layout) return;
      const svh = this.viewport().svh;
      const p = this.pending;
      if (p) {
        // A regeneration in flight: its own S1 (swapped atomically), if already sampled.
        const g = p.set;
        if (p.name) p.name = this.sampleNameInto(g, { W: g.genW, H: g.genH, A: g.genW / g.genH, svh });
      } else {
        const g = this.set;
        this.setName(this.sampleNameInto(g, { W: g.genW, H: g.genH, A: g.genW / g.genH, svh }));
      }
      after?.();
      this.wake();
    });
  }

  /**
   * S1 registers to the DOM glyphs, not to the viewport (§9.8): whenever its
   * anchor box no longer matches the sample (the h1 rescaled with --name-fs
   * on a resize below the §9.7 thresholds), resample it in place. Called on
   * store refreshes and after the resize debounce; a full regeneration
   * (pending) resamples S1 itself.
   */
  private checkName(): void {
    this.updateNameScale();
    const n = this.name;
    const rec = store.anchors.get(StateId.NAME);
    if (!this.ready || !n || n.source !== 'dom' || !rec || this.pending || this.resizeTimer !== null) return;
    if (Math.abs(rec.w - n.anchorW) > NAME_RESAMPLE_PX || Math.abs(rec.h - n.anchorH) > NAME_RESAMPLE_PX) this.resampleName();
  }

  /** §9.8: the h1 font arrived after sampling → resample S1 once, re-upload, refresh ScrollTrigger. */
  private listenForFont(): void {
    const fonts = document.fonts;
    if (!fonts) return;
    const onDone = () => {
      if (!isNameFontReady()) return;
      this.fontUnlisten?.();
      this.resampleName(() => ScrollTrigger.refresh());
    };
    fonts.addEventListener('loadingdone', onDone);
    this.fontUnlisten = () => {
      fonts.removeEventListener('loadingdone', onDone);
      this.fontUnlisten = null;
    };
  }

  private onState(job: number, id: StateId, pos: Float32Array, meta: Uint8Array, extras?: Record<string, number[]>): void {
    if (this.disposed) return;
    if (job === this.bootJob || this.lazyJobs.has(job)) {
      this.set.set(id, pos, meta, extras);
      this.upload(this.set, id);
      this.onSetChanged();
      this.maybeReady();
    } else if (this.pending && job === this.pending.job) {
      this.pending.set.set(id, pos, meta, extras);
      this.upload(this.pending.set, id);
      this.maybeSwap();
    }
  }

  /**
   * §9.9 "uploaded when it arrives": push a state's textures to the GPU now,
   * not on the first frame that draws it — a far jump would otherwise pay
   * two RGBA32F uploads in that frame (a long first frame mid jump cut).
   */
  private upload(set: TextureSet, id: StateId): void {
    if (this.dead || this.lost) return;
    const p = set.pos[id];
    const m = set.meta[id];
    if (p) this.renderer.initTexture(p);
    if (m) this.renderer.initTexture(m);
  }

  /** The route left the 404 it booted on: build the home states now (queued behind any job). */
  private buildDeferredHome(): void {
    const ids = this.deferredHome;
    this.deferredHome = null;
    if (!ids || !this.layout) return;
    const todo = ids.filter((id) => !this.requested.has(id));
    if (!todo.length) return;
    for (const id of todo) this.requested.add(id);
    const g = this.set;
    const view = { W: g.genW, H: g.genH, A: g.genW / g.genH, svh: this.viewport().svh };
    this.lazyJobs.add(this.gen.start(this.jobFor(todo, view), false));
  }

  /** §3.4: S10 (and any state outside the boot order) is generated when a frame first needs it. */
  private requestLazy(id: StateId): void {
    if (this.requested.has(id) || !this.layout) return;
    this.requested.add(id);
    const g = this.set;
    const view = { W: g.genW, H: g.genH, A: g.genW / g.genH, svh: this.viewport().svh };
    this.lazyJobs.add(this.gen.start(this.jobFor([id], view), false));
  }

  private onMissing(job: number, id: StateId): void {
    if (this.pending && job === this.pending.job) {
      this.pending.expect.delete(id);
      this.maybeSwap();
    }
  }

  /** The resident set changed: film ceiling (§9.9) and per-state uniform extras. */
  private onSetChanged(): void {
    setFilmCeiling(Math.max(0, this.set.ceiling()));
    // CSS stand-ins (the chart's SVG bars, emblem outlines…) stay until
    // their state is actually drawn: html[data-field-states~="k"]. While the
    // Canvas2D fallback covers a lost context, S2 is left out: §8.4 keeps the
    // chart's SVG bars there (fallback2d.ts fallbackStatesAttr).
    const skip = this.lost || this.dead ? StateId.CHART : -1;
    let ids = '';
    for (let id = 0; id <= StateId.FLATLINE; id++) {
      if (id !== skip && this.set.has(id as StateId)) ids += ids ? ` ${id}` : `${id}`;
    }
    if (ids !== this.statesAttr) {
      this.statesAttr = ids;
      html().setAttribute('data-field-states', ids);
    }
    const piv = this.set.extras[StateId.CHART]?.uBarPivot;
    if (piv) this.uniforms.uBarPivot.value.set(piv.slice(0, this.uniforms.uBarPivot.value.length));
    this.wake();
  }

  private maybeReady(): void {
    if (this.ready || this.disposed || !this.compiled || !this.set.has(StateId.STATIC) || !this.set.has(StateId.NAME)) return;
    this.ready = true;
    this.onSetChanged();

    const heroP = store.chapters.top
      ? store.chapters.top.progress
      : window.scrollY / Math.max(1, (CHAPTERS.top.L / 100) * window.innerHeight);
    // A context lost before the first frame: the fallback shows, no intro.
    const gl = !this.lost && !this.dead;
    const intro =
      gl &&
      this.opts.intro &&
      this.mode === 'full' &&
      store.route.kind === 'home' &&
      this.nameEls.h1 !== null &&
      store.film.override === null &&
      heroP < HERO_P[store.layout].p0;

    // §6 step 2: one frame rendered off-screen (the canvas is still at 0), then fade in.
    this.choreo.attach();
    if (intro) {
      // Override first, so the off-screen frame (it compiles the programs
      // while the canvas is still at 0) is already the intro's S1 printed —
      // the frame the HUD reads next (1.00, like the pending guess).
      void this.choreo.runIntro();
      this.renderNow();
    } else {
      // The pre-paint script guessed an intro (html[data-intro="pending"]
      // holds the scroll cue and the HUD); it will not run.
      clearIntroPending();
      this.renderNow();
      if (gl) gsap.to(this.canvas, { opacity: 1, duration: this.mode === 'full' ? INTRO.lateFadeIn : 0.2, ease: 'none' });
      if (this.mode !== 'full') this.choreo.setMode('reduced');
      else if (gl) this.choreo.syncToLock(INTRO.lateFadeIn);
    }
    if (gl) html().setAttribute('data-field', 'live');
    if (!this.forced && this.mode === 'full') {
      if (this.texTier === 'high') this.probe = new WarmupProbe();
      this.governor = new AdaptiveGovernor(this.fired.length);
    }
    const cbs = [...this.readyCbs];
    this.readyCbs.clear();
    for (const cb of cbs) cb();
  }

  // -------------------------------------------------------------------------
  // The loop (§9.5).

  private readonly renderFrame = (time: number, deltaMs: number): void => {
    if (this.disposed || !this.ready) return;
    this.frameAt(time, deltaMs);
  };

  private renderNow(): void {
    this.frameAt(gsap.ticker.time, 0, true);
  }

  private frameAt(time: number, deltaMs: number, force = false): void {
    const s = store;
    if (s.version !== this.seenVersion) this.onStoreVersion();
    if (this.ready && s.layout !== this.genLayoutMode) this.regenerate();

    if (this.deferredHome && s.route.kind !== '404') this.buildDeferredHome();
    const f = tick(s, deltaMs / 1000, time);
    this.frameCutting = f.cutting;
    if (!this.set.has(f.a)) this.requestLazy(f.a);
    if (!this.set.has(f.b)) this.requestLazy(f.b);
    if (f.lockEdge !== 0) this.choreo.onLockEdge(f.lockEdge);
    // §8.4: while the context is lost (for good after a second loss) the
    // Canvas2D fallback paints the frame instead, under the same loop control.
    const gl = !this.dead && !this.lost;
    if (!gl && !this.fb) return;

    const active = this.isActive(f, time);
    if (this.dirtyReq) {
      // Opened here, on the ticker's clock: gsap.ticker.time is stale while it sleeps.
      this.dirtyReq = false;
      this.dirtyUntil = Math.max(this.dirtyUntil, time + DIRTY_S);
    }
    if (!force) {
      if (this.isPaused(time)) return;
      if (this.mode === 'reduced') {
        // On demand (§8.2): render while invalidated or still settling; at
        // rest leave the ticker, so gsap can sleep (no rAF loop at rest).
        // Stop only once a SETTLED frame is on screen: with frames > 100 ms
        // apart (a hitch, software GL) the frame that finishes a poster
        // crossfade could arrive after the window closed and never be drawn,
        // leaving the canvas on a half-faded poster.
        if (time > this.dirtyUntil && f.settled && this.shownSettled) {
          this.stopTicking();
          return;
        }
        if (!f.settled) this.dirtyUntil = Math.max(this.dirtyUntil, time + 0.1);
      } else if (!active && time - this.lastActive > IDLE_AFTER_S && (++this.parity & 1) === 1) {
        return; // 30 fps idle throttle
      }
    }

    if (gl) {
      this.writeUniforms(f);
      if (this.mode === 'reduced' && f.seg < 0 && f.a !== f.b && store.film.override === null) this.renderCrossfade(f);
      else this.renderer.render(this.scene, this.camera);
    } else {
      // Paints only when the picture changed (scroll, settling, crossfades).
      this.fb!.paint(f, this.W, this.H, this.mode === 'reduced', force);
    }
    this.shownSettled = f.settled;
    this.rendered++;
    if (gl) this.debug?.afterRender(f);
    if (!force && gl) this.measure(deltaMs);
  }

  private isActive(f: Readonly<FieldFrame>, time: number): boolean {
    const fx = store.fx;
    let act = !f.settled || this.choreo.busy || this.swapping;
    if (store.scroll.y !== this.lastScrollY) {
      this.lastScrollY = store.scroll.y;
      act = true;
    }
    if (f.ripple[2] >= 0 && time - f.ripple[2] < 0.6) act = true;
    // Damped values still converging (a resting pointer does not count: §8.5
    // idles after 6 s without pointer *moves*).
    const p = store.pointer;
    const mouseTarget = p.active && p.fine && store.mode === 'full' ? 1 : 0;
    if (
      Math.abs(f.charge - fx.charge) > 1e-3 ||
      Math.abs(f.disperse - fx.disperse) > 1e-3 ||
      Math.abs(f.focusOn - fx.focusOn) > 1e-3 ||
      Math.abs(f.mouseAmt - mouseTarget) > 1e-3
    ) {
      act = true;
    }
    for (let i = 0; i < 8 && !act; i++) if (Math.abs(f.groupW[i] - fx.groupW[i]) > 1e-3) act = true;
    if (act) this.lastActive = time;
    return act;
  }

  private isPaused(time: number): boolean {
    if (store.flags.hidden || this.pauses.size > 0) return true;
    if (store.flags.menuOpen) {
      if (this.menuSince < 0) this.menuSince = time;
      return time - this.menuSince > MENU_STOP_S;
    }
    this.menuSince = -1;
    return false;
  }

  /** Input or a one-shot: full rate now; under reduced motion only scroll / state changes render. */
  private wake(source: 'scroll' | 'pointer' | 'state' = 'state'): void {
    this.lastActive = gsap.ticker.time;
    if (this.mode === 'reduced' && source !== 'pointer') {
      this.dirtyReq = true;
      this.startTicking();
    }
  }

  private invalidate(): void {
    this.lastActive = gsap.ticker.time;
    this.dirtyReq = true;
    this.startTicking();
  }

  /**
   * Put renderFrame on the gsap ticker (this wakes a sleeping ticker, which
   * may run one tick synchronously). Full motion keeps it there for good;
   * reduced motion removes it at rest (§8.2, §8.5: on demand, no rAF loop).
   */
  private startTicking(): void {
    if (this.ticking || this.disposed) return;
    this.ticking = true;
    gsap.ticker.add(this.renderFrame);
  }

  private stopTicking(): void {
    if (!this.ticking) return;
    this.ticking = false;
    gsap.ticker.remove(this.renderFrame);
  }

  /** Uniform writes (§9.5 step 3.2): numbers only, into preallocated objects. */
  private writeUniforms(f: Readonly<FieldFrame>): void {
    const u = this.uniforms;
    const set = this.set;
    const { W, H } = this;
    const ph = this.placeholder;
    u.uPosA.value = set.pos[f.a] ?? ph.pos;
    u.uPosB.value = set.pos[f.b] ?? ph.pos;
    u.uMetaA.value = set.meta[f.a] ?? ph.meta;
    u.uMetaB.value = set.meta[f.b] ?? ph.meta;
    u.uKindA.value = f.a;
    u.uKindB.value = f.b;

    // px-registered states keep their px size until a regeneration catches up
    // with a height change; viewport-relative S0 is authored in su. S1 also
    // follows the DOM name's scale until its in-place resample lands (§9.8).
    const gs = set.genH > 0 && H > 0 ? set.genH / H : 1;
    const t = this.tmp2;
    pxToSu(f.offA[0], f.offA[1], W, H, t);
    u.uOffA.value.set(t[0], t[1], f.offA[2] * this.stateScale(f.a, gs), f.offA[3]);
    pxToSu(f.offB[0], f.offB[1], W, H, t);
    u.uOffB.value.set(t[0], t[1], f.offB[2] * this.stateScale(f.b, gs), f.offB[3]);

    u.uMix.value = f.mix;
    u.uStagger.value = f.stagger;
    u.uTurb.value = f.turb;
    u.uPath.value = f.path;
    const full = this.mode === 'full';
    if (full) this.frozenTime = f.now;
    u.uTime.value = this.frozenTime;
    u.uTimeA.value = full ? f.now : POSTER_TIME[f.a];
    u.uTimeB.value = full ? f.now : POSTER_TIME[f.b];
    u.uDt.value = f.dt;
    u.uAperture.value = f.aperture;

    const spec = TIERS[this.tier];
    u.uSizeMin.value = spec.sizeMin;
    u.uSizeMax.value = spec.sizeMax;
    // Low tier: bokeh in S0 only (§3.2); elsewhere eligible points cap at 6px like the rest.
    u.uBokehCap.value =
      this.texTier === 'low'
        ? (f.a === StateId.STATIC ? this.bokehCap : 6) * (1 - f.mix) + (f.b === StateId.STATIC ? this.bokehCap : 6) * f.mix
        : this.bokehCap;
    u.uDpr.value = this.renderer.getPixelRatio();

    const pa = STATE_PARAMS[f.a];
    const pb = STATE_PARAMS[f.b];
    u.uDensityA.value = pa.density;
    u.uDensityB.value = pb.density;
    u.uIdleA.value.set(pa.idle.amp, pa.idle.freq, pa.idle.speed);
    u.uIdleB.value.set(pb.idle.amp, pb.idle.freq, pb.idle.speed);

    pxToSu(f.mouse[0], f.mouse[1], W, H, t);
    u.uMouse.value.set(t[0], t[1], 0);
    u.uMouseAmt.value = full ? f.mouseAmt : 0;
    u.uMouseMode.value = f.mouseMode;
    pxToSu(f.ripple[0], f.ripple[1], W, H, t);
    u.uRipple.value.set(t[0], t[1], f.ripple[2], f.ripple[3]);
    u.uScrollPx.value = f.scrollPx;
    u.uVelocity.value = f.velocity;

    u.uSafe.value = f.safe.rects;
    u.uSafeW.value = f.safe.weights;
    u.uSafeF.value = f.safe.feathers;
    u.uSafeCount.value = f.safe.count;
    u.uGroupW.value = f.groupW;
    u.uFocusOn.value = f.focusOn;
    u.uDisperse.value = f.disperse;
    u.uCharge.value = f.charge;
    u.uNova.value = f.nova;
    u.uBeat.value = f.beat;
    u.uSink.value = f.sink;
    u.uScanX.value = f.scanX;
    u.uPrinted.value = f.printed;
    u.uOpacity.value = f.opacity * this.opacityMul.v;
    u.uExposure.value = f.exposure;
  }

  /** Uniform scale of a state's local su (see writeUniforms). */
  private stateScale(id: StateId, gs: number): number {
    return id === StateId.STATIC ? 1 : id === StateId.NAME ? gs * this.nameK : gs;
  }

  /**
   * Reduced-motion posters (§8.2): a 400 ms CROSSFADE, not a morph. Two
   * passes over the same scene: A alone at α·(1 − mix), then B alone at
   * α·mix (each pass binds its state on both sides of the pair at mix 0,
   * with that state's resting aperture).
   */
  private renderCrossfade(f: Readonly<FieldFrame>): void {
    const u = this.uniforms;
    const base = u.uOpacity.value;
    const posB = u.uPosB.value;
    const metaB = u.uMetaB.value;
    const kindB = u.uKindB.value;
    const timeB = u.uTimeB.value;
    const densB = u.uDensityB.value;
    this.xOff.copy(u.uOffB.value);
    this.xIdle.copy(u.uIdleB.value);
    u.uMix.value = 0;

    // Pass A: A on both sides.
    u.uPosB.value = u.uPosA.value;
    u.uMetaB.value = u.uMetaA.value;
    u.uKindB.value = u.uKindA.value;
    u.uTimeB.value = u.uTimeA.value;
    u.uDensityB.value = u.uDensityA.value;
    u.uOffB.value.copy(u.uOffA.value);
    u.uIdleB.value.copy(u.uIdleA.value);
    u.uAperture.value = STATE_PARAMS[f.a].aperture;
    u.uOpacity.value = base * (1 - f.mix);
    this.renderer.render(this.scene, this.camera);

    // Pass B: B on both sides, added over A.
    u.uPosA.value = u.uPosB.value = posB;
    u.uMetaA.value = u.uMetaB.value = metaB;
    u.uKindA.value = u.uKindB.value = kindB;
    u.uTimeA.value = u.uTimeB.value = timeB;
    u.uDensityA.value = u.uDensityB.value = densB;
    u.uOffA.value.copy(this.xOff);
    u.uOffB.value.copy(this.xOff);
    u.uIdleA.value.copy(this.xIdle);
    u.uIdleB.value.copy(this.xIdle);
    u.uAperture.value = STATE_PARAMS[f.b].aperture;
    u.uOpacity.value = base * f.mix;
    this.renderer.autoClear = false;
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = true;
  }

  /** The printed name's left / right edge in world su (h1 box + the S1 anchor now). */
  private nameSpan(out: [number, number]): [number, number] | null {
    const n = this.name;
    if (!n || this.H <= 0) return null;
    const a = anchorTransform(StateId.NAME, store, this.tmp4);
    const gs = this.set.genH > 0 ? this.set.genH / this.H : 1;
    pxToSu(a[0], a[1], this.W, this.H, this.tmp2);
    const k = a[2] * this.stateScale(StateId.NAME, gs);
    out[0] = this.tmp2[0] + n.bounds.x0 * k;
    out[1] = this.tmp2[0] + n.bounds.x1 * k;
    return out;
  }

  // -------------------------------------------------------------------------
  // Tiers: warm-up probe and adaptive downgrade (§3.2).

  private measure(deltaMs: number): void {
    if (deltaMs > 0 && deltaMs < 250) this.fps += (1000 / deltaMs - this.fps) * 0.05;
    if (this.mode !== 'full') return;
    // QA (?debug, handle.debugSlowFrames): synthetic load on top of the real delta.
    const ms = deltaMs > 0 ? deltaMs + this.slowMs : deltaMs;
    const verdict = this.probe?.push(ms);
    if (verdict) {
      this.probe = null;
      if (verdict === 'slow' && this.tier === 'high') this.lowerTier('mid');
    }
    const step = this.governor?.push(ms);
    if (step) this.applyStep(step);
  }

  /** High → Mid by drawRange only (the textures stay). */
  private lowerTier(to: TierName): void {
    this.tier = to;
    const spec = TIERS[to];
    this.drawN = Math.min(this.drawN, spec.N);
    this.meshes.geometry.setDrawRange(0, this.drawN);
    this.bokehCap = Math.min(this.bokehCap, spec.bokehCap);
    html().setAttribute('data-tier', to);
  }

  private applyStep(step: AdaptiveStep): void {
    this.fired.push(step);
    switch (step) {
      case 'bokeh':
        this.bokehCap = Math.max(4, this.bokehCap - 4);
        break;
      case 'drawRange':
        this.drawN = Math.max(TIERS[this.texTier].sparks, Math.floor(this.drawN / 2));
        this.meshes.geometry.setDrawRange(0, this.drawN);
        break;
      case 'dpr':
        this.dpr = 1;
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(this.W, this.H, false);
        break;
      case 'glow':
        this.glowOn = false;
        this.scene.remove(this.meshes.glow);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Resize (§9.7) and store refreshes.

  private setCanvasSize(w: number, h: number): void {
    if (w <= 0 || h <= 0 || (w === this.W && h === this.H)) return;
    this.W = w;
    this.H = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.uniforms.uAspect.value = w / h;
    this.uniforms.uViewport.value.set(w, h);
    this.uniforms.uPxSu.value = 2 / h;
    this.wake();
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.maybeRegenerate();
      this.checkName();
    }, RESIZE_DEBOUNCE_MS);
  }

  /**
   * A ScrollTrigger refresh bumped store.version: rebind the hero h1, maybe
   * regenerate (§9.7), and keep S1 on the DOM glyphs (§9.8).
   */
  private onStoreVersion(): void {
    this.seenVersion = store.version;
    const els = findNameElements();
    if (els.h1 !== this.nameEls.h1 || els.anchor !== this.nameEls.anchor) {
      this.nameEls = els;
      this.choreo.refreshDom();
      // S1 was synthesised from layout.ts (no hero at boot): sample the real glyphs now.
      if (this.ready && els.h1 && this.name?.source === 'layout') this.resampleName();
    }
    this.maybeRegenerate();
    this.checkName();
  }

  private maybeRegenerate(): void {
    if (!this.ready || this.disposed) return;
    // A job in flight for another size is superseded (the worker drops it).
    const g = this.pending ? this.pending.set : this.set;
    const dW = Math.abs(this.W - g.genW);
    const dH = Math.abs(this.H - g.genH);
    const turned = this.W > this.H !== g.genW > g.genH;
    if (dW > REGEN_DW || turned || (store.pointer.fine && dH > REGEN_DH_FINE) || store.layout !== this.genLayoutMode) {
      this.regenerate();
    }
  }

  /** §9.7: worker regenerates while the main thread resamples S1; swap atomically when all are back. */
  private regenerate(): void {
    if (!this.layout) return;
    if (this.pending?.swapping) {
      this.regenAfterSwap = true;
      return;
    }
    const view = this.viewport();
    const expect = new Set<StateId>();
    for (let id = 0; id <= StateId.FLATLINE; id++) if (this.set.has(id as StateId)) expect.add(id as StateId);
    // The boot order plus any lazily requested state (resident or in flight:
    // a superseded lazy job would otherwise never deliver) — minus the home
    // states a 404 boot has not asked for yet (buildDeferredHome).
    const ids: StateId[] = WORKER_BOOT_ORDER.filter((id) => !this.deferredHome?.includes(id));
    for (const id of this.requested) {
      if (id === StateId.NAME || ids.includes(id)) continue;
      ids.push(id);
      expect.add(id);
    }
    this.pending?.set.dispose();
    const next = new TextureSet(TIERS[this.texTier].texH, view.W, view.H);
    this.pending = { set: next, job: -1, expect, name: null, layoutMode: store.layout, swapping: false };
    this.genLayoutMode = store.layout;
    this.pending.job = this.gen.start(this.jobFor(ids, view));
    whenIdle(() => {
      if (this.disposed || this.pending?.set !== next) return;
      this.pending.name = this.sampleNameInto(next, view);
      this.maybeSwap();
    });
  }

  private maybeSwap(): void {
    const p = this.pending;
    if (!p || !p.name || p.swapping) return;
    for (const id of p.expect) if (!p.set.has(id)) return;
    p.swapping = true;
    this.swapping = true;
    const next = p.set;
    gsap
      .timeline({
        onComplete: () => {
          this.swapping = false;
        },
      })
      .to(this.opacityMul, { v: SWAP_DIP.to, duration: SWAP_DIP.dur, ease: 'none' })
      .add(() => {
        if (this.disposed) return;
        const old = this.set;
        this.set = next;
        this.setName(p.name);
        // States of that job still in flight now land in the resident set.
        this.bootJob = p.job;
        this.lazyJobs.clear();
        if (this.pending === p) this.pending = null;
        old.dispose();
        this.onSetChanged();
        if (this.regenAfterSwap) {
          this.regenAfterSwap = false;
          this.maybeRegenerate();
        }
        this.checkName();
      })
      .to(this.opacityMul, { v: 1, duration: SWAP_DIP.dur, ease: 'none' });
  }

  // -------------------------------------------------------------------------
  // Listeners: input, resize, context loss (§8.4).

  private listen(): void {
    this.cleanups.push(
      attachInput({
        wake: (source) => this.wake(source),
        visibility: (hidden) => {
          if (!hidden) this.wake();
        },
      }),
    );

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        const r = entries[entries.length - 1]?.contentRect;
        if (r) this.setCanvasSize(r.width, r.height);
      });
      ro.observe(this.canvas);
      this.cleanups.push(() => ro.disconnect());
    } else {
      const onResize = () => this.setCanvasSize(window.innerWidth, window.innerHeight);
      window.addEventListener('resize', onResize);
      this.cleanups.push(() => window.removeEventListener('resize', onResize));
    }
    this.watchDpr();

    // §8.4: the first loss pauses WebGL and shows the Canvas2D fallback until
    // the context is restored (textures rebuilt from the cached arrays, then
    // a 400 ms crossfade back); a second loss stays on the fallback.
    // The first loss asks the browser for a restore (preventDefault — three's
    // own listener does the same). A second loss must not: the engine gives
    // up on WebGL, so a restore would only rebuild three's GPU state on a
    // context that never draws again. three registers its listener first, so
    // a capture listener on the canvas (at the target, capture listeners run
    // first) stops it from reaching three before it can preventDefault.
    const lose = () => {
      if (this.lost) return;
      this.lost = true;
      this.lossCount++;
      if (this.lossCount >= 2) this.dead = true;
      this.choreo.release();
      gsap.killTweensOf(this.canvas);
      this.canvas.style.opacity = '0';
      if (store.mode === 'full') store.mode = 'fallback';
      html().setAttribute('data-field', 'fallback');
      this.statesAttr = '';
      this.onSetChanged();
      this.showFallback();
    };
    const lost = (e: Event) => {
      e.preventDefault();
      lose();
    };
    const lostForGood = (e: Event) => {
      if (this.lost || this.lossCount < 1) return; // the first loss: restorable
      e.stopImmediatePropagation(); // neither three nor `lost` calls preventDefault
      lose();
    };
    const restored = () => {
      if (this.dead || this.disposed) return;
      this.lost = false;
      if (store.mode === 'fallback') store.mode = this.mode;
      // three's context restore rebuilds its background state with a black
      // clear colour (WebGLBackground defaults): put the void back.
      this.renderer.setClearColor(this.clearColor, 1);
      // Rebuild every resident texture from its cached array now (§8.4, §9.9:
      // never on the first frame that draws it).
      this.set.touch();
      for (let id = 0; id <= StateId.FLATLINE; id++) this.upload(this.set, id as StateId);
      html().setAttribute('data-field', 'live');
      this.statesAttr = '';
      this.onSetChanged();
      this.renderNow();
      gsap.to(this.canvas, { opacity: 1, duration: RESTORE_FADE_S, ease: 'none' });
      this.fb?.hide();
      this.choreo.resume();
      // The first frames after a restore recompile the programs: restart the
      // governor's window (its fired steps stand).
      if (this.governor) this.governor = new AdaptiveGovernor(this.fired.length);
      this.wake();
    };
    this.canvas.addEventListener('webglcontextlost', lostForGood, true);
    this.canvas.addEventListener('webglcontextlost', lost, false);
    this.canvas.addEventListener('webglcontextrestored', restored, false);
    this.cleanups.push(() => {
      this.canvas.removeEventListener('webglcontextlost', lostForGood, true);
      this.canvas.removeEventListener('webglcontextlost', lost, false);
      this.canvas.removeEventListener('webglcontextrestored', restored, false);
    });
  }

  /**
   * Show the context-loss fallback (loaded on the first loss; its chunk never
   * imports three). It paints from this loop (frameAt) and reads the resident
   * set's cached arrays through a reused view (no per-frame allocation).
   */
  private showFallback(): void {
    if (this.fb) {
      this.fb.show();
      this.wake();
      return;
    }
    if (this.fbLoading) return;
    this.fbLoading = true;
    const view = { pos: new Float32Array(0), meta: new Uint8Array(0) };
    import('./fallback2d.ts').then(
      ({ LossFallback }) => {
        this.fbLoading = false;
        if (this.disposed) return;
        try {
          this.fb = new LossFallback(this.canvas, {
            layout: () => this.layout,
            arrays: (id) => {
              const p = this.set.pos[id]?.image.data;
              const m = this.set.meta[id]?.image.data;
              if (!p || !m) return null;
              view.pos = p as Float32Array;
              view.meta = m as Uint8Array;
              return view;
            },
            scale: (id, H) => this.stateScale(id, this.set.genH > 0 && H > 0 ? this.set.genH / H : 1),
            pivots: () => this.set.extras[StateId.CHART]?.uBarPivot ?? null,
          });
        } catch (err) {
          this.fallbackFailed(err);
          return;
        }
        if (this.lost || this.dead) {
          this.fb.show();
          this.wake();
        }
      },
      (err: unknown) => {
        this.fbLoading = false;
        this.fallbackFailed(err);
      },
    );
  }

  /** No Canvas2D either: the CSS glow is the backdrop until a restore (§8.4 last resort). */
  private fallbackFailed(err: unknown): void {
    console.error('[field] Canvas2D fallback unavailable', err);
    if ((this.lost || this.dead) && html().getAttribute('data-field') === 'fallback') {
      html().removeAttribute('data-field');
      html().removeAttribute('data-field-states');
      this.statesAttr = '';
    }
  }

  /**
   * The device-pixel ratio follows the screen (a window dragged to a retina
   * display, browser zoom): `(resolution: Ndppx)` stops matching when it
   * changes, and the query is re-armed for the new ratio. The ResizeObserver
   * only sees CSS size. Once the adaptive 'dpr' step has fired, DPR stays 1.
   */
  private watchDpr(): void {
    let mql: MediaQueryList | null = null;
    const onChange = () => {
      arm();
      if (this.disposed || this.fired.includes('dpr')) return;
      const next = Math.min(window.devicePixelRatio || 1, dprCap(this.texTier, this.cores));
      if (Math.abs(next - this.dpr) < 1e-3) return;
      this.dpr = next;
      this.renderer.setPixelRatio(next);
      this.renderer.setSize(this.W, this.H, false);
      this.wake();
    };
    const arm = () => {
      mql?.removeEventListener('change', onChange);
      try {
        mql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        mql.addEventListener('change', onChange);
      } catch {
        mql = null;
      }
    };
    arm();
    this.cleanups.push(() => {
      mql?.removeEventListener('change', onChange);
      mql = null;
    });
  }

  // -------------------------------------------------------------------------
  // Handle.

  private setMode(mode: FieldMode): void {
    if (mode === this.mode || this.disposed) return;
    this.mode = mode;
    this.uniforms.uMotion.value = mode === 'full' ? 1 : 0;
    // The fallback covering a lost context: 'fallback' in full motion, the director's posters under reduced.
    if (this.lost || this.dead) store.mode = mode === 'reduced' ? 'reduced' : 'fallback';
    if (mode === 'reduced') {
      this.frozenTime = gsap.ticker.time;
      this.probe = null;
      this.governor = null;
    } else if (this.ready && !this.forced && !this.governor) {
      // Back to full motion: the governor resumes after the steps already fired (never back up).
      this.governor = new AdaptiveGovernor(this.fired.length);
    }
    if (this.ready) this.choreo.setMode(mode);
    this.invalidate();
  }

  private stats(): FieldStats {
    return {
      ready: this.ready,
      mode: this.mode,
      tier: this.tier,
      textureTier: this.texTier,
      forced: this.forced,
      N: TIERS[this.texTier].N,
      drawRange: this.drawN,
      dpr: this.renderer.getPixelRatio(),
      glow: this.glowOn,
      bokehCap: this.bokehCap,
      fps: this.fps,
      rendered: this.rendered,
      canvas: [this.W, this.H],
      generatedFor: [this.set.genW, this.set.genH],
      ceiling: this.set.ceiling(),
      resident: Array.from({ length: StateId.FLATLINE + 1 }, (_, i) => i).filter((i) => this.set.has(i as StateId)),
      adaptive: [...this.fired],
      lost: this.lost || this.dead,
      renderer: this.lost || this.dead ? 'canvas2d' : 'webgl',
      ...(this.fb ? { paint: this.fb.stats() } : {}),
      intro: this.choreo.introRunning,
      name: this.name
        ? {
            source: this.name.source,
            fontReady: this.name.fontReady,
            ms: Math.round(this.name.ms * 10) / 10,
            scale: Math.round(this.nameK * 1e4) / 1e4,
          }
        : null,
      cores: this.cores,
    };
  }

  /**
   * Sketch ↔ ink (src/theme.ts): clear colour (paper / void), blending
   * (normal / additive), the palette ramp, the pencil sprites (uSketch) and
   * the spark glow (off on paper: light halos read as dirt). A live switch
   * also resamples S1, whose DOM lettering changed font, and refreshes
   * ScrollTrigger (type metrics moved the layout).
   */
  private applyTheme(theme: Theme, live: boolean): void {
    const sketch = theme === 'sketch';
    this.clearColor.set(sketch ? PAPER_COLOR : CLEAR_COLOR);
    this.renderer.setClearColor(this.clearColor, 1);
    const blending = sketch ? NormalBlending : AdditiveBlending;
    this.meshes.material.blending = blending;
    this.meshes.glowMaterial.blending = blending;
    this.meshes.glow.visible = !sketch;
    paletteFloats(sketch, this.uniforms.uPalette.value);
    this.uniforms.uSketch.value = sketch ? 1 : 0;
    if (!live) return;
    this.invalidate();
    // The hero lettering changes font: resample S1 once that font is in
    // (the next frame's style recalc starts its load).
    requestAnimationFrame(() => {
      void waitForNameFont().then(() => {
        if (!this.disposed && this.ready) this.resampleName(() => ScrollTrigger.refresh());
      });
    });
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTicking();
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    for (const fn of this.cleanups.splice(0)) fn();
    this.fontUnlisten?.();
    this.gen.dispose();
    this.choreo.release();
    gsap.killTweensOf(this.canvas);
    gsap.killTweensOf(this.opacityMul);
    this.pending?.set.dispose();
    this.pending = null;
    this.set.dispose();
    this.placeholder.pos.dispose();
    this.placeholder.meta.dispose();
    this.meshes.geometry.dispose();
    this.meshes.glowGeometry.dispose();
    this.meshes.material.dispose();
    this.meshes.glowMaterial.dispose();
    this.renderer.dispose();
    this.fb?.dispose();
    this.fb = null;
    this.debug?.dispose();
    this.debug = null;
    html().removeAttribute('data-field');
    html().removeAttribute('data-field-states');
    html().removeAttribute('data-tier');
    clearIntroPending();
    this.canvas.style.opacity = '0';
    setFilmCeiling(FILM_MAX);
    this.readyCbs.clear();
  }
}

/** The CreateField contract (field/index.ts): wrap the context, start, hand back the handle. */
export const createEngine: CreateField<WebGL2RenderingContext> = async (canvas, gl, opts) => {
  const engine = new FieldEngine(canvas, gl, opts);
  engine.start();
  return engine.handle;
};
