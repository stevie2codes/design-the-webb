/**
 * Field constants shared by the director (scroll side) and the engine
 * (SPEC §2.1 particle palette, §3.4 meta roles, §3.5 uniform limits, §3.6
 * paths, §3.7 mouse modes, §3.9 per-state constants).
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. Owner: engine (the
 * STATE_PARAMS rows are shared data; the director reads them every frame).
 *
 * Rules:
 * - Pure data and pure math. No DOM, no `three` import: the director pulls
 *   this file into the initial bundle, and the generator worker imports it.
 *   The engine builds its THREE uniform objects elsewhere (engine/material
 *   code) from these constants.
 * - Adding a state = a generator file (states/sNN-*.ts) + a live() case in
 *   the shader + one STATE_PARAMS row here.
 */
import { StateId } from './states/ids.ts';
import type { EnteringParams } from '../scroll/store';

// ---------------------------------------------------------------------------
// Enumerations shared with the shaders (ints in GLSL).

/** Morph path of the ENTERING state (§3.6 table; `uPath`). */
export const PathId = {
  DEFAULT: 0,
  POUR: 1,
  TOPPLE: 2,
  DIGITIZE: 3,
  DEAL: 4,
  SPIRAL: 5,
} as const;
export type PathId = (typeof PathId)[keyof typeof PathId];

/** Pointer behaviour of a state (§3.7; `uMouseMode`). */
export const MouseMode = {
  LOUPE: 0,
  PUSH: 1,
  ATTRACT: 2,
} as const;
export type MouseMode = (typeof MouseMode)[keyof typeof MouseMode];

/** Particle role, packed in meta.a as `role << 4 | group` (§3.4). */
export const Role = {
  FILL: 0,
  EDGE: 1,
  SPARK: 2,
  DUST: 3,
  HALO: 4,
  FLOW: 5,
  GHOST: 6,
  BLINK: 7,
  RING: 8,
  PACKET: 9,
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Array uniform sizes (§3.5). The director fills buffers of exactly these sizes. */
export const LIMITS = {
  /** `uSafe[6]`: text-safe rects (the nav band + 5 blocks). */
  safeRects: 6,
  /** `uGroupW[8]`: per-group focus weights. */
  groups: 8,
  /** `uBarPivot[3]`: S2 bar pivots for TOPPLE. */
  barPivots: 3,
  /** `uPalette[5]`: colour ramp stops. */
  palette: 5,
  /** Texture width in texels (§3.2); every tier uses 256. */
  texW: 256,
} as const;

// ---------------------------------------------------------------------------
// Palette (§2.1). Shader constants, never used for text.

export interface PaletteStop {
  readonly name: 'p-noise' | 'p-steel' | 'p-signal' | 'p-ember' | 'p-core';
  /** 0xRRGGBB (sRGB). */
  readonly hex: number;
  /** Ramp position read by the shader (`uPalette`, meta.r). */
  readonly ramp: number;
}

export const PALETTE: readonly PaletteStop[] = [
  { name: 'p-noise', hex: 0x3e4557, ramp: 0 },
  { name: 'p-steel', hex: 0x8c97ad, ramp: 0.25 },
  { name: 'p-signal', hex: 0xf2eee6, ramp: 0.5 },
  { name: 'p-ember', hex: 0xff6a3d, ramp: 0.75 },
  { name: 'p-core', hex: 0xffd2b8, ramp: 1 },
];

/** WebGL clear colour = --color-void. */
export const CLEAR_COLOR = 0x050507;

/**
 * Global exposure calibration: multiplies every particle's α (shader
 * `FIELD_GAIN`). §3.6 fixes relative brightness (base α × density / DOF
 * falloff) but not the absolute scale, which depends on N and the point
 * sizes; this is the one number that sets it (tuned on screenshots: S1 reads
 * as bone type made of light, S0 as a faint bokeh volume).
 */
export const FIELD_GAIN = 3;

// ---------------------------------------------------------------------------
// Per-state constants (§3.9).

/** Idle drift (§3.7): 3D curl noise (sin flow on Low), mixed by the eased progress. */
export interface IdleParams {
  /** Amplitude in su. */
  readonly amp: number;
  /** Spatial frequency. */
  readonly freq: number;
  /** Time speed. */
  readonly speed: number;
}

export interface StateParams {
  /** Per-state alpha gain (`uDensityA/B`), so dense shapes don't blow out. */
  readonly density: number;
  readonly idle: IdleParams;
  /**
   * Resting aperture while this state is displayed alone. The director's
   * segment-shaped aperture (segAperture, §3.9) overrides it on the home film;
   * route mode (detail, 404) uses it directly.
   */
  readonly aperture: number;
  readonly mouse: MouseMode;
  /**
   * Entering parameters: apply when this state is the pair's B side, and
   * unchanged in reverse. The per-particle stagger KEY is generator-side
   * (pos.w of this state's texture); only S, T and the path live here.
   */
  readonly enter: EnteringParams;
}

const IDLE_HOLD = { freq: 1.6, speed: 0.06 } as const;

/** S1 NAME's entering params; S0 has none of its own (it is only ever entered by the intro, the reverse of S1). */
const ENTER_NAME: EnteringParams = { stagger: 0.55, turb: 0.35, path: PathId.DEFAULT };

export const STATE_PARAMS: Readonly<Record<StateId, StateParams>> = {
  [StateId.STATIC]: {
    density: 0.55,
    idle: { amp: 0.2, freq: 0.3, speed: 0.035 },
    aperture: 0.9,
    mouse: MouseMode.LOUPE,
    enter: ENTER_NAME,
  },
  [StateId.NAME]: {
    // §3.9 .42; tuned so the resolved name reads as bone light, not grey sand.
    density: 0.6,
    idle: { amp: 0.003, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: ENTER_NAME,
  },
  [StateId.CHART]: {
    density: 0.5,
    idle: { amp: 0.002, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: { stagger: 0.6, turb: 0.02, path: PathId.POUR },
  },
  [StateId.REDACTED]: {
    density: 0.38,
    idle: { amp: 0.002, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: { stagger: 0.45, turb: 0.06, path: PathId.TOPPLE },
  },
  [StateId.PULSE]: {
    density: 0.55,
    idle: { amp: 0.004, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: { stagger: 0.6, turb: 0.2, path: PathId.DEFAULT },
  },
  [StateId.LATTICE]: {
    density: 0.55,
    idle: { amp: 0.004, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: { stagger: 0.55, turb: 0.08, path: PathId.DIGITIZE },
  },
  [StateId.DECK]: {
    density: 0.55,
    idle: { amp: 0.004, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: { stagger: 0.5, turb: 0.1, path: PathId.DEAL },
  },
  [StateId.CONSTELLATION]: {
    density: 0.55,
    idle: { amp: 0.004, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: { stagger: 0.35, turb: 0.4, path: PathId.DEFAULT },
  },
  [StateId.STACK]: {
    density: 0.5,
    idle: { amp: 0.003, ...IDLE_HOLD },
    // Plus a per-group blur (+1.2 CoC for unfocused plates) in the shader.
    aperture: 0.04,
    mouse: MouseMode.PUSH,
    enter: { stagger: 0.5, turb: 0.18, path: PathId.DEFAULT },
  },
  [StateId.BEACON]: {
    density: 0.6,
    idle: { amp: 0.004, ...IDLE_HOLD },
    aperture: 0.04,
    mouse: MouseMode.ATTRACT,
    enter: { stagger: 0.5, turb: 0.2, path: PathId.SPIRAL },
  },
  [StateId.FLATLINE]: {
    density: 0.5,
    idle: { amp: 0.002, ...IDLE_HOLD },
    // .50 → .04 on CTA hover (route mode, §6 404).
    aperture: 0.5,
    mouse: MouseMode.LOUPE,
    // Route entry is time-based (1,100 ms); S and T still apply.
    enter: { stagger: 0.4, turb: 0.2, path: PathId.DEFAULT },
  },
};

// ---------------------------------------------------------------------------
// Stage units (§3.1).

/** Camera distance: 1 / tan(15°), so the z = 0 plane spans y ∈ [−1, 1]. */
export const CAMERA_Z = 3.732;

/**
 * Viewport CSS px → stage units on the z = 0 plane (§3.1). `W`/`H` are the
 * CANVAS CSS size (100% × 100lvh), which only the engine knows; everything
 * the scroll side hands over (FieldFrame offsets, mouse, safe rects, ripple)
 * is in viewport CSS px and goes through this at uniform-write time.
 */
export function pxToSu(x: number, y: number, W: number, H: number, out: [number, number]): [number, number] {
  if (W <= 0 || H <= 0) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  out[0] = ((2 * x) / W - 1) * (W / H);
  out[1] = 1 - (2 * y) / H;
  return out;
}

/** 1 CSS px in su for a canvas of CSS height H (§3.1). */
export const suPerPx = (H: number): number => (H > 0 ? 2 / H : 0);

// ---------------------------------------------------------------------------
// Reduced-motion poster frames (§3.10): under reduced motion the engine
// freezes each endpoint's live() clock (uTimeA / uTimeB) at its state's
// poster time, in seconds of that state's live loop. States without a live
// loop (S0) or whose loop has no key frame yet use 0; the generator phases
// set the rest (S4 highlight on the spike, S5 fully printed, S6 caret on,
// S7 packets mid-spoke, S9 breath at mean radius, S10 flat).
export const POSTER_TIME: Readonly<Record<StateId, number>> = {
  [StateId.STATIC]: 0,
  [StateId.NAME]: 0,
  [StateId.CHART]: 0,
  [StateId.REDACTED]: 0,
  [StateId.PULSE]: 0,
  [StateId.LATTICE]: 0,
  [StateId.DECK]: 0,
  [StateId.CONSTELLATION]: 0,
  [StateId.STACK]: 0,
  [StateId.BEACON]: 0,
  [StateId.FLATLINE]: 0,
};

/** Hero scan beam "off" position (su): far outside any shape, so no particle brightens. */
export const SCAN_OFF = -1e4;
