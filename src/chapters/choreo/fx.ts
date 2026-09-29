/**
 * UI → field effects (SPEC §3.10, §5, §9.2 writers "UI handlers"): the
 * chapters' writes to `store.fx`. The director damps `groupW`, `focusOn` and
 * `charge` (500 / 500 / 400 ms, FX_DUR); `nova` and `exposure` are copied,
 * so their one-shots are tweened here. Every write asks the engine for a
 * frame (reduced motion renders on demand: poster-safe).
 *
 * Focus groups are shared by every state (S1 lines, S2 bars, S4 ghosts, S7
 * spokes, S8 plates all use low group ids), so two chapters must never leave
 * weights behind for each other. `claimFocus(owner, …)` / `releaseFocus(owner)`
 * arbitrate: the most recent live claim wins, and with no claim every group
 * is neutral (1) and `focusOn` is 0. Chapters claim only while the field
 * shows their state (a film gate), so a stale hover can never dim another
 * chapter's shape.
 *
 * No gsap import (lazy): one-shots take the instance from the chapter's
 * useChapter context. SSR-safe.
 */
import { LIMITS } from '../../field/uniforms';
import type { ScrollRuntime } from '../../motion/lazy';
import { store } from '../../scroll/store';
import { invalidateField } from './film';

type Gsap = ScrollRuntime['gsap'];
/** A running one-shot (a gsap timeline). */
type OneShot = { kill(): unknown };

const GROUPS = LIMITS.groups;

interface Claim {
  readonly w: Float32Array;
  focusOn: number;
}

const claims = new Map<string, Claim>();
/** Reused while comparing a claim with the current one (no allocation when nothing changed). */
const scratch = new Float32Array(GROUPS);

function applyFocus(): void {
  let top: Claim | null = null;
  for (const c of claims.values()) top = c; // insertion order: the last claim is the newest
  const target = store.fx.groupW;
  let changed = false;
  for (let i = 0; i < GROUPS; i++) {
    const v = top ? top.w[i] : 1;
    if (target[i] !== v) {
      target[i] = v;
      changed = true;
    }
  }
  const on = top ? top.focusOn : 0;
  if (store.fx.focusOn !== on) {
    store.fx.focusOn = on;
    changed = true;
  }
  if (changed) invalidateField();
}

/**
 * Set `owner`'s focus: `lit` groups at weight 1, every other group in
 * `dim` at `low` (default 0 → the shader's α ×.35), the rest neutral.
 * Re-claiming with the same weights is a no-op.
 */
export function claimFocus(
  owner: string,
  lit: readonly number[],
  dim: readonly number[],
  opts: { low?: number; focusOn?: number } = {},
): void {
  const low = opts.low ?? 0;
  const w = scratch.fill(1);
  for (const g of dim) if (g >= 0 && g < GROUPS) w[g] = low;
  for (const g of lit) if (g >= 0 && g < GROUPS) w[g] = 1;
  const focusOn = opts.focusOn ?? 0;
  const prev = claims.get(owner);
  if (prev && prev.focusOn === focusOn && prev.w.every((v, i) => v === w[i])) return;
  claims.delete(owner); // re-insert: the newest claim wins
  claims.set(owner, { w: Float32Array.from(w), focusOn });
  applyFocus();
}

/** Drop `owner`'s claim (the next newest claim, or neutral, applies). */
export function releaseFocus(owner: string): void {
  if (claims.delete(owner)) applyFocus();
}

// ---------------------------------------------------------------------------
// Charge (§3.10 S3 / S9 uCharge; C2's "Request by email", C5's beacon CTA).

let chargeOwner: string | null = null;

/** Hover / focus on → 1, off → 0 (damped 400 ms by the director). Only the owner that set it clears it. */
export function setCharge(owner: string, on: boolean, level = 1): void {
  if (on) {
    chargeOwner = owner;
    if (store.fx.charge === level) return;
    store.fx.charge = level;
  } else {
    if (chargeOwner !== owner) return;
    chargeOwner = null;
    if (store.fx.charge === 0) return;
    store.fx.charge = 0;
  }
  invalidateField();
}

// ---------------------------------------------------------------------------
// One-shots (§5 C5, §3.10 S9). Suppressed while rewinding (§4.4).

/** The beacon nova (§3.10 S9 uNova): R ×1.8 over .5 s expo.out, then back over 1.2 s. */
export const NOVA = { up: 0.5, down: 1.2 } as const;
/** The C5 ignition (§5): exposure 1 → 1.35 → 1 over 600 ms. */
export const IGNITION = { peak: 1.35, up: 0.2, down: 0.4 } as const;

let novaTween: OneShot | null = null;
let ignitionTween: OneShot | null = null;

/** Fire the nova (never delays the mailto: call it from the click, do not preventDefault). */
export function fireNova(gsap: Gsap): void {
  if (store.flags.rewinding) return;
  novaTween?.kill();
  const fx = store.fx;
  novaTween = gsap
    .timeline({ onComplete: () => (novaTween = null) })
    .to(fx, { nova: 1, duration: NOVA.up, ease: 'out-expo' })
    .to(fx, { nova: 0, duration: NOVA.down, ease: 'cine' });
  invalidateField();
}

/** Fire the C5 ignition: exposure 1 → 1.35 → 1 (600 ms). */
export function fireIgnition(gsap: Gsap): void {
  ignitionTween?.kill();
  const fx = store.fx;
  ignitionTween = gsap
    .timeline({ onComplete: () => (ignitionTween = null) })
    .to(fx, { exposure: IGNITION.peak, duration: IGNITION.up, ease: 'out-expo' })
    .to(fx, { exposure: 1, duration: IGNITION.down, ease: 'ui' });
  invalidateField();
}

/** Stop the one-shots and restore their resting values (unmount, mode switch). */
export function settleOneShots(): void {
  novaTween?.kill();
  novaTween = null;
  ignitionTween?.kill();
  ignitionTween = null;
  store.fx.nova = 0;
  store.fx.exposure = 1;
}
