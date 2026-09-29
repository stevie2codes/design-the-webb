/**
 * Motion tokens (SPEC §2.7) as plain data, plus a small cubic-bézier solver.
 *
 * Pure and dependency-free, so any module in the initial bundle may import
 * it: gsap itself is loaded after hydration (motion/lazy.ts), and
 * motion/gsap.ts registers the named eases below with `gsap.registerEase`
 * (no CustomEase, whose SVG-path parser would only serve four béziers).
 */

/** Ease names. Every scrubbed tween uses 'none' (Lenis + the field damp smooth it). */
export const EASE = {
  cine: 'cine',
  outExpo: 'out-expo',
  inExpo: 'in-expo',
  inOutExpo: 'expo.inOut',
  ui: 'ui',
  none: 'none',
} as const;

/** The custom eases: cubic-bézier control points, identical to the --ease-* CSS tokens. */
export const BEZIER: Readonly<Record<'cine' | 'out-expo' | 'in-expo' | 'ui', readonly [number, number, number, number]>> = {
  cine: [0.7, 0, 0.2, 1],
  'out-expo': [0.16, 1, 0.3, 1],
  'in-expo': [0.7, 0, 0.84, 0],
  ui: [0.22, 1, 0.36, 1],
};

/** Durations in seconds (§2.7). */
export const DUR = {
  micro: 0.18,
  ui: 0.24,
  reveal: 0.7,
  revealStagger: 0.09,
  groupFocus: 0.5,
  morph: 1.1,
  scan: 0.9,
  cutOut: 0.25,
  cutIn: 0.4,
  rewind: 2.4,
} as const;

/** Loop periods in seconds (§2.7). */
export const LOOP = {
  caret: 1.06,
  pulse: 2.4,
  writeHeadSweep: 3.2,
  writeHeadHold: 0.8,
  beaconBreath: 5,
} as const;

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` as an ease function p ∈ [0, 1] → eased
 * value (the UnitBezier method: Newton–Raphson on x(t), bisection fallback).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const EPS = 1e-6;

  const solveT = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < EPS) return t;
      const d = slopeX(t);
      if (Math.abs(d) < EPS) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < EPS) break;
      if (x > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : sampleY(solveT(p)));
}
