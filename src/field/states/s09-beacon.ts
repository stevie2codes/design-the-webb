/**
 * S9 BEACON — Contact (SPEC §3.10 S9, §5 C5): a star that pulls the whole
 * film in. Anchor: the S9 box of layout.ts — desktop centre (50vw, 52svh),
 * R = 12svh; mobile centre (50vw, 46svh), R = 24vw (`extra.r`). Local su
 * about the beacon centre, which is also the centre of the DOM CTA disc
 * (chapters/Contact.tsx places it at --anchor-beacon-cx / -cy), so the disc
 * sits exactly on the core.
 *
 * | Element | Share | Role   | Recipe                                                               |
 * |---------|-------|--------|----------------------------------------------------------------------|
 * | Shell   | 52%   | edge   | Fibonacci sphere at R ± .01R; p-signal α .5, the rim (abs(n·v) < .25) ember |
 * | Core    | 18%   | fill   | 3D Gaussian σ .22R, p-core                                           |
 * | Ring    | 14%   | ring   | r 1.45R, band .03R, tilted 18° (and rolled 8°, like the DOM stand-in); dotted |
 * | Infall  | 13%   | flow   | 5 log spirals 2.6R → R in a tilted disc; param = u (0 at R, 1 at 2.6R) |
 * | Halo    |  3%   | halo   | dim Gaussian, p-steel                                                |
 * | Sparks  |  S    | spark  | core, σ .06R, p-core                                                 |
 *
 * Live (shaders/live/s09.glsl): the shell spins about Y at .06 rad/s and
 * breathes R·(1 + .03·sin(2π·.2t)); its rim is recomputed from the rotated
 * normal; the ring spins at .12 rad/s about its own axis; the infall moves
 * inward, u = fract(u0 − .07t), by the log spiral's self-similarity (scale
 * 2.6^Δu and turn with it — no radius needed in the shader), fading in at
 * 2.6R and out into the shell. uCharge: core σ ×1.4, ring ×3 (a crossfade to
 * a second, triple-speed population: no phase jump), rim .25 → .45,
 * brightness +25%. uNova: everything ×1.8 about the centre (the UI tweens
 * uNova 0 → 1 over .5 s expo.out, back over 1.2 s).
 *
 * Shader contracts (keep s09.glsl in sync with BEACON below):
 * - Every particle is in group G_BEACON = 7: no focus writer ever lights or
 *   dims it (S2 keeps uGroupW[5–7] at 1; S8 uses 0–3), so a stale plate focus
 *   cannot dim the beacon while seg8 plays.
 * - Shell (edge): α and ramp are baked with the rim / back-face weights of
 *   the unrotated normal (rimWeight / backWeight below); live() multiplies
 *   by the ratio of the rotated to the baked weights, so t = 0 is exact.
 * - Ring (ring): generated in the ring frame (x, z in its plane, y its axis)
 *   then tilted RING_TILT about X and rolled RING_ROLL about Z.
 * - Infall (flow): meta.b = u0; generated in the infall frame the same way
 *   (INFALL_TILT, INFALL_ROLL); θ = θk − 2π·TURNS·u, r = R·2.6^u, so matter
 *   orbits in the ring's sense as it falls. Baked ramp = infallRamp(u0), α
 *   without the fade envelope (live applies it).
 *
 * Sort (§3.3): polar angle about the centre (spiral coherence with S8).
 * Entering key (§3.9): 1 − normalised distance from the centre (outer
 * first), so the infall and ring land first and the core ignites last.
 *
 * Reduced-motion poster (§3.10 "breath at mean radius"): sin(2π·.2t) = 0 at
 * t = 0, so POSTER_TIME[BEACON] stays 0 (BEACON_POSTER_T).
 */
import { StateId } from './ids.ts';
import { RAMP, fibonacciSphere, gauss, type StateGenerator } from './common.ts';
import { Role } from '../uniforms.ts';

const DEG = Math.PI / 180;

/** Geometry and live constants (units of R unless noted). Mirrors shaders/live/s09.glsl. */
export const BEACON = {
  /** Shell radial jitter ±.01R (§3.10). */
  shellJitter: 0.01,
  /** Core Gaussian σ (§3.10: .22R). */
  coreSigma: 0.22,
  /** Ring radius and band (§3.10: 1.45R, .03R). */
  ringR: 1.45,
  ringBand: 0.03,
  /** Ring tilt about X (§3.10: 18°), and a roll about Z matching the DOM stand-in's rotate(−8°). */
  ringTilt: 18 * DEG,
  ringRoll: 8 * DEG,
  /** The ring is dotted: this many beads carry RING_BEAD_SHARE of its particles. */
  ringBeads: 96,
  /** Infall: 5 log spirals from 2.6R to R (§3.10), TURNS turns over the fall. */
  arms: 5,
  infallOuter: 2.6,
  turns: 0.42,
  /**
   * The infall disc's tilt about X (from edge-on) and roll. §3.10 leaves the
   * plane open; face-on, the 2.6R streams would run under the headline
   * (13–31svh) and the email row (74svh). At 30° the disc spans ±1.3R
   * vertically, inside the text-free band (31–74svh ≈ ±1.8R).
   */
  infallTilt: 30 * DEG,
  infallRoll: 8 * DEG,
  /** Live: shell spin (rad/s), breath amplitude and frequency (Hz), ring spin, infall rate (§3.10). */
  spin: 0.06,
  breath: 0.03,
  breathHz: 0.2,
  ringSpin: 0.12,
  infallRate: 0.07,
  /** Rim threshold on abs(n·v), and the smoothstep half-width around it. */
  rim: 0.25,
  rimSoft: 0.05,
} as const;

/** Share of the shape budget (§3.10); halo takes the rest (3%). */
const SHARE = { shell: 0.52, core: 0.18, ring: 0.14, infall: 0.13 } as const;

/**
 * α before density (.6) × FIELD_GAIN (3). §3.10 gives the shell .5 and the
 * core 1; tuned down on 1440 × 900 / 390 × 844 screenshots so the shell reads
 * as a grained sphere with a burning limb instead of a blown-out disc (a
 * Fibonacci shell projects ≈ .6 particles per px² on desktop).
 */
export const BEACON_ALPHA = {
  shell: 0.28,
  /** The rim's α multiplier (ember reads darker than bone at equal α). */
  rimGain: 2.4,
  /** Back hemisphere α multiplier (depth: additive points have no occlusion). */
  back: 0.5,
  core: 0.46,
  ring: 0.4,
  infall: 0.6,
  halo: 0.05,
  spark: 0.9,
} as const;

/** Ring: this share of its particles sits on the beads, the rest on a continuous band. */
const RING_BEAD_SHARE = 0.65;
/** Bead angular σ, as a fraction of the bead spacing. */
const RING_BEAD_SIGMA = 0.11;
/** Ring ramp: between signal and ember (the DOM stand-in's ring is ember). */
const RING_RAMP = 0.64;
/** Spark σ (units of R, §3.10). */
const SPARK_SIGMA = 0.06;
/** Halo σ (units of R). */
const HALO_SIGMA = [1.25, 0.95, 0.9] as const;
/** Infall stream width: angular σ (rad) and out-of-plane σ (units of r). */
const INFALL_SPREAD = { angle: 0.03, logR: 0.02, plane: 0.018 } as const;

/** Every beacon particle's group (see the file comment). */
export const G_BEACON = 7;

/** Reduced-motion poster (§3.10): breath at mean radius. */
export const BEACON_POSTER_T = 0;

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Rim weight of a unit normal's z (1 on the limb). Mirrors beaconRim() in s09.glsl. */
export const rimWeight = (nz: number, threshold: number = BEACON.rim): number =>
  1 - smooth(threshold - BEACON.rimSoft, threshold + BEACON.rimSoft, Math.abs(nz));
/** Back-face α weight of a unit normal's z. Mirrors beaconBack() in s09.glsl. */
export const backWeight = (nz: number): number => BEACON_ALPHA.back + (1 - BEACON_ALPHA.back) * smooth(-0.7, 0.35, nz);
/** Infall colour by u: ember where it meets the shell, steel far out. Mirrors beaconInfallRamp(). */
export const infallRamp = (u: number): number => 0.72 + (0.3 - 0.72) * u;

type V3 = [number, number, number];

/** Disc frame → local: tilt about X (front edge down), then roll about Z. */
function fromDisc(x: number, y: number, z: number, tilt: number, roll: number, out: V3): V3 {
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const y1 = y * ct - z * st;
  const z1 = y * st + z * ct;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  out[0] = x * cr - y1 * sr;
  out[1] = x * sr + y1 * cr;
  out[2] = z1;
  return out;
}

export const generator: StateGenerator = {
  id: StateId.BEACON,
  sort: { kind: 'polar', cx: 0, cy: 0 },
  generate(ctx, { shape, spark }) {
    const { rand } = ctx;
    const M = shape.capacity;
    const rPx = ctx.anchor.extra.r ?? Math.min(ctx.anchor.w, ctx.anchor.h) / 2;
    const R = ctx.su(rPx);
    const reach = BEACON.infallOuter * R * 1.08;
    const keyOf = (x: number, y: number, z: number) => 1 - Math.min(1, Math.hypot(x, y, z) / reach);
    const v: V3 = [0, 0, 0];

    // Shell 52%: Fibonacci sphere, R ± .01R. The rim and back-face weights of
    // the unrotated normal are baked; live() re-derives them as it spins.
    const nShell = Math.round(M * SHARE.shell);
    for (let i = 0; i < nShell; i++) {
      fibonacciSphere(i, nShell, v);
      const r = R * (1 + (rand() * 2 - 1) * BEACON.shellJitter);
      const rim = rimWeight(v[2]);
      const alpha = BEACON_ALPHA.shell * (1 + (BEACON_ALPHA.rimGain - 1) * rim) * backWeight(v[2]);
      const ramp = RAMP.signal + (RAMP.ember - RAMP.signal) * rim;
      const x = v[0] * r;
      const y = v[1] * r;
      const z = v[2] * r;
      shape.push(x, y, z, keyOf(x, y, z), ramp, alpha, 0, Role.EDGE, G_BEACON);
    }

    // Core 18%: 3D Gaussian σ .22R, p-core.
    const nCore = Math.round(M * SHARE.core);
    const cs = BEACON.coreSigma * R;
    for (let i = 0; i < nCore; i++) {
      const x = gauss(rand) * cs;
      const y = gauss(rand) * cs;
      const z = gauss(rand) * cs;
      shape.push(x, y, z, keyOf(x, y, z), RAMP.core, BEACON_ALPHA.core, 0, Role.FILL, G_BEACON);
    }

    // Ring 14%: r 1.45R, band .03R, dotted (beads + a faint continuous band).
    const nRing = Math.round(M * SHARE.ring);
    for (let i = 0; i < nRing; i++) {
      let th: number;
      if (rand() < RING_BEAD_SHARE) {
        const b = Math.floor(rand() * BEACON.ringBeads);
        th = ((b + 0.5 + gauss(rand) * RING_BEAD_SIGMA) / BEACON.ringBeads) * 2 * Math.PI;
      } else {
        th = rand() * 2 * Math.PI;
      }
      const rr = R * (BEACON.ringR + (rand() - 0.5) * BEACON.ringBand);
      const h = gauss(rand) * 0.004 * R;
      fromDisc(rr * Math.cos(th), h, rr * Math.sin(th), BEACON.ringTilt, BEACON.ringRoll, v);
      shape.push(v[0], v[1], v[2], keyOf(v[0], v[1], v[2]), RING_RAMP, BEACON_ALPHA.ring, 0, Role.RING, G_BEACON);
    }

    // Infall 13%: 5 log spirals, u0 stratified per arm; r = R·2.6^u,
    // θ = θk − 2π·TURNS·u (+ a self-similar spread, so the moving stream
    // keeps the same cross-section statistics).
    const nInfall = Math.round(M * SHARE.infall);
    const lnOuter = Math.log(BEACON.infallOuter);
    for (let i = 0; i < nInfall; i++) {
      const arm = i % BEACON.arms;
      const u0 = (Math.floor(i / BEACON.arms) + rand()) / Math.ceil(nInfall / BEACON.arms);
      const u = Math.min(0.999, u0);
      const th = (2 * Math.PI * arm) / BEACON.arms - 2 * Math.PI * BEACON.turns * u + gauss(rand) * INFALL_SPREAD.angle;
      const r = R * Math.exp(lnOuter * u + gauss(rand) * INFALL_SPREAD.logR);
      const h = gauss(rand) * INFALL_SPREAD.plane * r;
      fromDisc(r * Math.cos(th), h, r * Math.sin(th), BEACON.infallTilt, BEACON.infallRoll, v);
      shape.push(v[0], v[1], v[2], keyOf(v[0], v[1], v[2]), infallRamp(u), BEACON_ALPHA.infall, u, Role.FLOW, G_BEACON);
    }

    // Halo 3% (the rest): dim steel Gaussian about the beacon.
    while (!shape.full) {
      const x = gauss(rand) * HALO_SIGMA[0] * R;
      const y = gauss(rand) * HALO_SIGMA[1] * R;
      const z = gauss(rand) * HALO_SIGMA[2] * R;
      shape.push(x, y, z, 0.5 * rand(), RAMP.steel, BEACON_ALPHA.halo, 0, Role.HALO, G_BEACON);
    }

    // Sparks: the core, σ .06R, p-core; they ignite last (key ≈ 1).
    const ss = SPARK_SIGMA * R;
    while (!spark.full) {
      const x = gauss(rand) * ss;
      const y = gauss(rand) * ss;
      const z = gauss(rand) * ss;
      const a = BEACON_ALPHA.spark * (0.6 + 0.4 * rand());
      spark.push(x, y, z, keyOf(x, y, z), RAMP.core, a, 0, Role.SPARK, G_BEACON);
    }
  },
};
