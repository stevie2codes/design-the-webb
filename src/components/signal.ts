import { isIntroPending } from '../field/index';
import { isReducedMotion } from '../motion/motionPref';
import { filmTargetOf, frame, hudSignal, hudSignalAt } from '../scroll/director';
import { store } from '../scroll/store';

/** §6: S/N is damped over 200 ms. */
const DAMP_S = 0.2;

/**
 * The S/N readout's value (SPEC §6), shared by the corner HUD and the hero
 * meter: `sn = 1 − clamp(.75·(aperture − .04)/.86 + .25·turb/.4, 0, 1)` from
 * the director's latest FieldFrame (director.hudSignal: rest reads 0.03,
 * every hold 1.00), damped over 200 ms. Until the field has produced a frame
 * (no WebGL, before it is ready) it follows the scroll-derived film target
 * instead, so the readout still tells the story. While the §6 intro is
 * expected (`html[data-intro="pending"]`, set before first paint) it reads
 * 1.00 — the name on screen is resolved — so the intro starts from the value
 * already shown and the readout never bounces.
 *
 * Returns a sampler: call it at ≤ 10 Hz (onSample); it returns sn ∈ [0, 1].
 */
export function createSignal(initial: number): () => number {
  let sn = initial;
  let lastT = performance.now() / 1000;
  return () => {
    const t = performance.now() / 1000;
    const dt = Math.min(0.25, Math.max(0, t - lastT));
    lastT = t;
    // frame.now is the gsap clock of the last rendered frame; 0 = none yet.
    const pending = isIntroPending();
    const target = pending ? 1 : frame.now > 0 ? hudSignal(frame) : hudSignalAt(filmTargetOf(store));
    // Reduced motion samples on scroll only (no loop to finish a damp): jump.
    sn = isReducedMotion() || pending ? target : sn + (target - sn) * (1 - Math.pow(2, (-dt * 5) / DAMP_S));
    return Number.isFinite(sn) ? Math.min(1, Math.max(0, sn)) : 0;
  };
}
