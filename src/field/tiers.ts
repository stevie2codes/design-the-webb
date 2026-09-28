/**
 * Quality tiers (SPEC §3.2): the table, the boot rule, and the constants of
 * the warm-up probe and the adaptive downgrade.
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. Owner: engine.
 * Pure: no DOM at import (readTierEnv() touches `navigator`/`matchMedia`
 * only when called). Never imports three.
 */
import { MQ } from './layout.ts';

export type TierName = 'high' | 'mid' | 'low';

/** Downgrade order: a probe or adaptive step only ever moves right. */
export const TIER_ORDER: readonly TierName[] = ['high', 'mid', 'low'];

export interface TierSpec {
  readonly name: TierName;
  /** Texture height in texels (width is always 256). N = 256 × texH. */
  readonly texH: number;
  /** Particle count. */
  readonly N: number;
  /** Sparks, index range [0, S) (3%). */
  readonly sparks: number;
  /**
   * Dust and shape counts from the §3.2 table (15% / 82%, rounded). The
   * golden-ratio rule of §3.3 in states/common.ts is the source of truth and
   * lands within ±1 of these (High: 7,372 dust / 40,305 shape).
   */
  readonly dust: number;
  readonly M: number;
  /** Device-pixel-ratio cap. Low drops to 1.25 on ≤ 4 cores (see dprCap()). */
  readonly dpr: number;
  /** Base point size range in CSS px (`uSizeMin`, `uSizeMax`). */
  readonly sizeMin: number;
  readonly sizeMax: number;
  /** Bokeh cap in CSS px (`uBokehCap`). Low: S0 only. */
  readonly bokehCap: number;
  /** Spark glow pass (second Points, drawRange [0, S)). */
  readonly glow: boolean;
  /** Film grain in the atmosphere layer. */
  readonly grain: 'animated' | 'static';
}

export const TIERS: Readonly<Record<TierName, TierSpec>> = {
  high: {
    name: 'high',
    texH: 192,
    N: 49_152,
    sparks: 1_475,
    dust: 7_373,
    M: 40_304,
    dpr: 1.5,
    sizeMin: 1.1,
    sizeMax: 2.6,
    bokehCap: 12,
    glow: true,
    grain: 'animated',
  },
  mid: {
    name: 'mid',
    texH: 112,
    N: 28_672,
    sparks: 860,
    dust: 4_301,
    M: 23_511,
    dpr: 1.5,
    sizeMin: 1.2,
    sizeMax: 2.8,
    bokehCap: 10,
    glow: true,
    grain: 'static',
  },
  low: {
    name: 'low',
    texH: 56,
    N: 14_336,
    sparks: 430,
    dust: 2_150,
    M: 11_756,
    dpr: 1.5,
    sizeMin: 1.4,
    sizeMax: 3.2,
    bokehCap: 8,
    glow: false,
    grain: 'static',
  },
};

/** Share of particles eligible for bokeh (aSeed.w < .35). */
export const BOKEH_SHARE = 0.35;

/** What the boot rule looks at. */
export interface TierEnv {
  /** Viewport width in CSS px. */
  readonly width: number;
  readonly finePointer: boolean;
  /** navigator.hardwareConcurrency (0 when unknown). */
  readonly cores: number;
  /** navigator.deviceMemory in GB, or null when the browser does not expose it. */
  readonly memory: number | null;
  /** The mobile layout (MQ.mobile). */
  readonly mobileLayout: boolean;
  /** Landscape phone with height < 500px: desktop layout at Low tier (§4.2). */
  readonly shortLandscape: boolean;
}

/** The §3.2 boot rule. Pure. */
export function pickTier(env: TierEnv): TierName {
  const lowMemory = env.memory !== null && env.memory <= 4;
  if (env.mobileLayout || env.shortLandscape || lowMemory) return 'low';
  if (env.width >= 1024 && env.finePointer && env.cores >= 8) return 'high';
  if (env.width >= 768) return 'mid';
  return 'low';
}

/** DPR cap for a tier on this device (§3.2: Low is 1.25 on ≤ 4 cores). */
export function dprCap(tier: TierName, cores: number): number {
  return tier === 'low' && cores > 0 && cores <= 4 ? 1.25 : TIERS[tier].dpr;
}

/** Canvas2D fallback triggers that do not need a context attempt (§3.2): ≤ 2 GB and ≤ 2 cores. */
export function isFeebleDevice(env: Pick<TierEnv, 'cores' | 'memory'>): boolean {
  return env.memory !== null && env.memory <= 2 && env.cores > 0 && env.cores <= 2;
}

/** Read the environment. Browser only (call from effects / boot, never at import or in render). */
export function readTierEnv(): TierEnv {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mq = (q: string) => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  return {
    width: window.innerWidth,
    finePointer: mq(MQ.finePointer),
    cores: nav.hardwareConcurrency || 0,
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    mobileLayout: mq(MQ.mobile),
    shortLandscape: mq(MQ.shortLandscape),
  };
}

/**
 * Warm-up probe during the intro (§3.2): High drops to Mid by drawRange only.
 *
 * §3.2 says "p75 of the rAF deltas over 14 ms", but a rAF delta is never
 * shorter than the display's refresh interval: at 60 Hz every frame is
 * 16.7 ms however light the load, so the literal rule demoted every 60 Hz
 * desktop. The probe judges DROPPED frames against the display instead
 * (CONTRACTS.md tuning notes): the refresh interval is estimated as the
 * fast end of the window (its 10th percentile), and the verdict is slow when
 * more than a quarter of the frames took over 1.5 intervals (i.e. the p75
 * exceeds 1.5 intervals), or when even the fast end is slower than a 48 Hz
 * frame (a steady 30 fps render on a 60 Hz panel never drops a vsync, so
 * the interval estimate itself is too long).
 */
export const PROBE = {
  /** Frames sampled (≈ the intro). */
  frames: 45,
  /** Refresh-interval estimate: this percentile of the window's deltas. */
  intervalPct: 0.1,
  /** A delta above interval × this is a dropped frame. */
  dropFactor: 1.5,
  /** Slow when more than this share of the frames dropped. */
  dropShare: 0.25,
  /** Slow when the interval estimate itself exceeds this (sub-48 fps steady). */
  maxIntervalMs: 1000 / 48,
} as const;

/** Adaptive downgrade (§3.2): one step per firing, never back up in a session. */
export const ADAPTIVE = {
  /** Rolling window. */
  windowFrames: 60,
  /** Average frame time that counts as slow. */
  avgMs: 20,
  /** How long it must stay slow before a step fires. */
  sustainS: 2,
  /** Bokeh cap reduction of step 1, in CSS px. */
  bokehStepPx: 4,
  steps: ['bokeh', 'drawRange', 'dpr', 'glow'] as const,
} as const;
export type AdaptiveStep = (typeof ADAPTIVE.steps)[number];

/** Frame deltas above this are stalls (tab switch, long task), not load: ignored. */
const STALL_MS = 250;

/**
 * The warm-up verdict for a window of rAF deltas (ms), relative to the
 * display's refresh interval (see PROBE). Pure.
 */
export function probeVerdict(deltas: readonly number[]): 'slow' | 'ok' {
  if (deltas.length === 0) return 'ok';
  const s = [...deltas].sort((a, b) => a - b);
  const interval = s[Math.min(s.length - 1, Math.floor(s.length * PROBE.intervalPct))];
  if (interval > PROBE.maxIntervalMs) return 'slow';
  const limit = interval * PROBE.dropFactor;
  let dropped = 0;
  for (const d of s) if (d > limit) dropped++;
  return dropped / s.length > PROBE.dropShare ? 'slow' : 'ok';
}

/**
 * Warm-up probe (§3.2): the first PROBE.frames rAF deltas, judged by
 * probeVerdict(). Feed it the engine's tick deltas; it answers once.
 */
export class WarmupProbe {
  private readonly samples: number[] = [];
  private done = false;

  get finished(): boolean {
    return this.done;
  }

  /** 'slow' or 'ok' once enough frames are in; null before and after. */
  push(ms: number): 'slow' | 'ok' | null {
    if (this.done || !(ms > 0) || ms > STALL_MS) return null;
    this.samples.push(ms);
    if (this.samples.length < PROBE.frames) return null;
    this.done = true;
    return probeVerdict(this.samples);
  }
}

/**
 * Adaptive downgrade (§3.2): when the rolling ADAPTIVE.windowFrames average
 * stays above ADAPTIVE.avgMs for ADAPTIVE.sustainS, return the next step of
 * ADAPTIVE.steps (bokeh cap −4px → halve drawRange → DPR 1 → glow off). One
 * step per firing; never back up. The window restarts after each step so the
 * next one judges the downgraded frame time.
 */
export class AdaptiveGovernor {
  private readonly ring = new Float32Array(ADAPTIVE.windowFrames);
  private n = 0;
  private head = 0;
  private sum = 0;
  private slowFor = 0;
  private next = 0;

  /** Every step has fired. */
  get exhausted(): boolean {
    return this.next >= ADAPTIVE.steps.length;
  }

  /** Steps fired so far. */
  get fired(): readonly AdaptiveStep[] {
    return ADAPTIVE.steps.slice(0, this.next);
  }

  /** Feed one frame delta (ms); returns the step to apply now, or null. */
  push(ms: number): AdaptiveStep | null {
    if (this.exhausted || !(ms > 0) || ms > STALL_MS) return null;
    if (this.n === this.ring.length) this.sum -= this.ring[this.head];
    else this.n++;
    this.ring[this.head] = ms;
    this.sum += ms;
    this.head = (this.head + 1) % this.ring.length;
    const full = this.n === this.ring.length;
    this.slowFor = full && this.sum / this.n > ADAPTIVE.avgMs ? this.slowFor + ms / 1000 : 0;
    if (this.slowFor < ADAPTIVE.sustainS) return null;
    this.slowFor = 0;
    this.n = 0;
    this.head = 0;
    this.sum = 0;
    return ADAPTIVE.steps[this.next++];
  }
}
