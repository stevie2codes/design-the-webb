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
import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { gsap, ScrollTrigger } from '../motion/gsap.ts';
import { getDebugParams } from '../debugParams.ts';
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
import { CAMERA_Z, CLEAR_COLOR, POSTER_TIME, SCAN_OFF, STATE_PARAMS, pxToSu } from './uniforms.ts';
import { createMeshes, createUniforms, placeholderTextures, type FieldMeshes, type FieldUniforms } from './material.ts';
import { TextureSet, WORKER_BOOT_ORDER } from './textures.ts';
import { GeneratorClient, type GenJob } from './generation.ts';
import { Choreo, INTRO } from './choreo.ts';
import { attachInput } from './input.ts';
import type { DebugOverlay } from './debug.ts';
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
  private pending: {
    set: TextureSet;
    job: number;
    expect: Set<StateId>;
    name: NameSample | null;
    layoutMode: typeof store.layout;
  } | null = null;
  private genLayoutMode: typeof store.layout = store.layout;
  private name: NameSample | null = null;
  private nameEls: NameElements = { h1: null, anchor: null };
  private fontUnlisten: (() => void) | null = null;

  private mode: FieldMode;
  private readonly pauses = new Map<PauseReason, number>();
  private ready = false;
  private readonly readyCbs = new Set<() => void>();
  private disposed = false;
  private lost = false;
  private lossCount = 0;
  private dead = false;

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
  private dirtyUntil = 0;
  private frozenTime = 0;
  private seenVersion = -1;
  private fps = 60;
  private readonly cleanups: (() => void)[] = [];
  private debug: DebugOverlay | null = null;

  private readonly tmp2: [number, number] = [0, 0];
  private readonly tmp4: Vec4 = [0, 0, 1, 1];

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
    this.renderer.setClearColor(new Color(CLEAR_COLOR), 1);
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
    this.handle = {
      kind: 'webgl',
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
    gsap.ticker.add(this.renderFrame);
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
    this.bootJob = this.gen.start(this.jobFor(WORKER_BOOT_ORDER, view));

    const fontReady = await waitForNameFont();
    if (this.disposed) return;
    await new Promise<void>((r) => whenIdle(r));
    if (this.disposed) return;
    this.name = this.sampleNameInto(this.set, view);
    if (!fontReady) this.listenForFont();
    this.onSetChanged();
    this.maybeReady();
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

  /** §9.8: the h1 font arrived after sampling → resample S1 once, re-upload, refresh ScrollTrigger. */
  private listenForFont(): void {
    const fonts = document.fonts;
    if (!fonts) return;
    const onDone = () => {
      if (!isNameFontReady()) return;
      this.fontUnlisten?.();
      whenIdle(() => {
        if (this.disposed) return;
        const set = this.set;
        this.name = this.sampleNameInto(set, { W: set.genW, H: set.genH, A: set.genW / set.genH, svh: this.viewport().svh });
        ScrollTrigger.refresh();
        this.wake();
      });
    };
    fonts.addEventListener('loadingdone', onDone);
    this.fontUnlisten = () => {
      fonts.removeEventListener('loadingdone', onDone);
      this.fontUnlisten = null;
    };
  }

  private onState(job: number, id: StateId, pos: Float32Array, meta: Uint8Array, extras?: Record<string, number[]>): void {
    if (this.disposed) return;
    if (job === this.bootJob) {
      this.set.set(id, pos, meta, extras);
      this.onSetChanged();
      this.maybeReady();
    } else if (this.pending && job === this.pending.job) {
      this.pending.set.set(id, pos, meta, extras);
      this.maybeSwap();
    }
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
    const piv = this.set.extras[StateId.CHART]?.uBarPivot;
    if (piv) this.uniforms.uBarPivot.value.set(piv.slice(0, this.uniforms.uBarPivot.value.length));
    this.wake();
  }

  private maybeReady(): void {
    if (this.ready || this.disposed || !this.set.has(StateId.STATIC) || !this.set.has(StateId.NAME)) return;
    this.ready = true;
    this.onSetChanged();

    const heroP = store.chapters.top
      ? store.chapters.top.progress
      : window.scrollY / Math.max(1, (CHAPTERS.top.L / 100) * window.innerHeight);
    const intro =
      this.opts.intro &&
      this.mode === 'full' &&
      store.route.kind === 'home' &&
      this.nameEls.h1 !== null &&
      store.film.override === null &&
      heroP < HERO_P[store.layout].p0;

    // §6 step 2: one frame rendered off-screen (the canvas is still at 0), then fade in.
    if (intro) {
      void this.choreo.runIntro();
      this.renderNow();
    } else {
      this.renderNow();
      gsap.to(this.canvas, { opacity: 1, duration: this.mode === 'full' ? INTRO.lateFadeIn : 0.2, ease: 'none' });
      if (this.mode === 'full') this.choreo.syncToLock(INTRO.lateFadeIn);
      else this.choreo.setMode('reduced');
    }
    html().setAttribute('data-field', 'live');
    if (!this.forced && this.mode === 'full') {
      if (this.texTier === 'high') this.probe = new WarmupProbe();
      this.governor = new AdaptiveGovernor();
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
    if (this.ready && s.layout !== this.genLayoutMode && !this.pending) this.regenerate();

    const f = tick(s, deltaMs / 1000, time);
    this.frameCutting = f.cutting;
    if (f.lockEdge !== 0) this.choreo.onLockEdge(f.lockEdge);
    if (this.dead || this.lost) return;

    const active = this.isActive(f, time);
    if (!force) {
      if (this.isPaused(time)) return;
      if (this.mode === 'reduced') {
        // On demand (§8.2): render while invalidated or still settling.
        if (time > this.dirtyUntil && f.settled) return;
        if (!f.settled) this.dirtyUntil = Math.max(this.dirtyUntil, time + 0.1);
      } else if (!active && time - this.lastActive > IDLE_AFTER_S && (++this.parity & 1) === 1) {
        return; // 30 fps idle throttle
      }
    }

    this.writeUniforms(f);
    this.renderer.render(this.scene, this.camera);
    this.debug?.afterRender(f);
    if (!force) this.measure(deltaMs);
  }

  private isActive(f: Readonly<FieldFrame>, time: number): boolean {
    const fx = store.fx;
    let act = !f.settled || this.choreo.busy || this.swapping;
    if (store.scroll.y !== this.lastScrollY) {
      this.lastScrollY = store.scroll.y;
      act = true;
    }
    if (f.ripple[2] >= 0 && time - f.ripple[2] < 0.6) act = true;
    if (
      Math.abs(f.charge - fx.charge) > 1e-3 ||
      Math.abs(f.disperse - fx.disperse) > 1e-3 ||
      Math.abs(f.focusOn - fx.focusOn) > 1e-3 ||
      f.mouseAmt > 1e-3
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

  private wake(): void {
    const t = gsap.ticker.time;
    this.lastActive = t;
    if (this.mode === 'reduced') this.dirtyUntil = Math.max(this.dirtyUntil, t + 0.3);
  }

  private invalidate(): void {
    const t = gsap.ticker.time;
    this.dirtyUntil = Math.max(this.dirtyUntil, t + 0.3);
    this.lastActive = t;
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
    // with a height change; viewport-relative S0 is authored in su.
    const gs = set.genH > 0 && H > 0 ? set.genH / H : 1;
    const t = this.tmp2;
    pxToSu(f.offA[0], f.offA[1], W, H, t);
    u.uOffA.value.set(t[0], t[1], f.offA[2] * (f.a === StateId.STATIC ? 1 : gs), f.offA[3]);
    pxToSu(f.offB[0], f.offB[1], W, H, t);
    u.uOffB.value.set(t[0], t[1], f.offB[2] * (f.b === StateId.STATIC ? 1 : gs), f.offB[3]);

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
    u.uSafeCount.value = f.safe.count;
    u.uGroupW.value = f.groupW;
    u.uFocusOn.value = f.focusOn;
    u.uDisperse.value = f.disperse;
    u.uCharge.value = f.charge;
    u.uNova.value = f.nova;
    u.uBeat.value = f.beat;
    u.uScanX.value = f.scanX;
    u.uPrinted.value = f.printed;
    u.uOpacity.value = f.opacity * this.opacityMul.v;
    u.uExposure.value = f.exposure;
  }

  /** The printed name's left / right edge in world su (h1 box + the S1 anchor now). */
  private nameSpan(out: [number, number]): [number, number] | null {
    const n = this.name;
    if (!n || this.H <= 0) return null;
    const a = anchorTransform(StateId.NAME, store, this.tmp4);
    const gs = this.set.genH > 0 ? this.set.genH / this.H : 1;
    pxToSu(a[0], a[1], this.W, this.H, this.tmp2);
    const k = a[2] * gs;
    out[0] = this.tmp2[0] + n.bounds.x0 * k;
    out[1] = this.tmp2[0] + n.bounds.x1 * k;
    return out;
  }

  // -------------------------------------------------------------------------
  // Tiers: warm-up probe and adaptive downgrade (§3.2).

  private measure(deltaMs: number): void {
    if (deltaMs > 0 && deltaMs < 250) this.fps += (1000 / deltaMs - this.fps) * 0.05;
    if (this.mode !== 'full') return;
    const verdict = this.probe?.push(deltaMs);
    if (verdict) {
      this.probe = null;
      if (verdict === 'slow' && this.tier === 'high') this.lowerTier('mid');
    }
    const step = this.governor?.push(deltaMs);
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
    }, RESIZE_DEBOUNCE_MS);
  }

  /** A ScrollTrigger refresh bumped store.version: rebind the hero h1, maybe regenerate. */
  private onStoreVersion(): void {
    this.seenVersion = store.version;
    const els = findNameElements();
    if (els.h1 !== this.nameEls.h1 || els.anchor !== this.nameEls.anchor) {
      this.nameEls = els;
      this.choreo.refreshDom();
      // S1 was synthesised from layout.ts (no hero at boot): sample the real glyphs now.
      if (this.ready && els.h1 && this.name?.source === 'layout') {
        whenIdle(() => {
          if (this.disposed) return;
          const set = this.set;
          this.name = this.sampleNameInto(set, { W: set.genW, H: set.genH, A: set.genW / set.genH, svh: this.viewport().svh });
          this.wake();
        });
      }
    }
    this.maybeRegenerate();
  }

  private maybeRegenerate(): void {
    if (!this.ready || this.disposed || this.pending) return;
    const g = this.set;
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
    const view = this.viewport();
    const expect = new Set<StateId>();
    for (let id = 0; id <= StateId.FLATLINE; id++) if (this.set.has(id as StateId)) expect.add(id as StateId);
    const ids: StateId[] = [...WORKER_BOOT_ORDER];
    if (this.set.has(StateId.FLATLINE)) ids.push(StateId.FLATLINE);
    this.pending?.set.dispose();
    const next = new TextureSet(TIERS[this.texTier].texH, view.W, view.H);
    this.pending = { set: next, job: -1, expect, name: null, layoutMode: store.layout };
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
    if (!p || !p.name) return;
    for (const id of p.expect) if (!p.set.has(id)) return;
    this.pending = null;
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
        this.name = p.name;
        old.dispose();
        this.onSetChanged();
      })
      .to(this.opacityMul, { v: 1, duration: SWAP_DIP.dur, ease: 'none' });
  }

  // -------------------------------------------------------------------------
  // Listeners: input, resize, context loss (§8.4).

  private listen(): void {
    this.cleanups.push(
      attachInput({
        wake: () => this.wake(),
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

    const lost = (e: Event) => {
      e.preventDefault();
      this.lost = true;
      this.lossCount++;
      this.choreo.release();
      html().removeAttribute('data-field');
      gsap.killTweensOf(this.canvas);
      this.canvas.style.opacity = '0';
      // TODO(phase8-engine): show the Canvas2D fallback (fallback2d.ts) from the cached arrays.
      if (this.lossCount >= 2) this.dead = true;
    };
    const restored = () => {
      if (this.dead || this.disposed) return;
      this.lost = false;
      this.set.touch();
      html().setAttribute('data-field', 'live');
      this.renderNow();
      gsap.to(this.canvas, { opacity: 1, duration: RESTORE_FADE_S, ease: 'none' });
      this.choreo.resume();
      this.wake();
    };
    this.canvas.addEventListener('webglcontextlost', lost, false);
    this.canvas.addEventListener('webglcontextrestored', restored, false);
    this.cleanups.push(() => {
      this.canvas.removeEventListener('webglcontextlost', lost, false);
      this.canvas.removeEventListener('webglcontextrestored', restored, false);
    });
  }

  // -------------------------------------------------------------------------
  // Handle.

  private setMode(mode: FieldMode): void {
    if (mode === this.mode || this.disposed) return;
    this.mode = mode;
    this.uniforms.uMotion.value = mode === 'full' ? 1 : 0;
    if (mode === 'reduced') {
      this.frozenTime = gsap.ticker.time;
      this.probe = null;
      this.governor = null;
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
      ceiling: this.set.ceiling(),
      resident: Array.from({ length: StateId.FLATLINE + 1 }, (_, i) => i).filter((i) => this.set.has(i as StateId)),
      adaptive: [...this.fired],
      lost: this.lost || this.dead,
      intro: this.choreo.introRunning,
      name: this.name
        ? { source: this.name.source, fontReady: this.name.fontReady, ms: Math.round(this.name.ms * 10) / 10 }
        : null,
      cores: this.cores,
    };
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    gsap.ticker.remove(this.renderFrame);
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
    this.debug?.dispose();
    this.debug = null;
    html().removeAttribute('data-field');
    html().removeAttribute('data-tier');
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
