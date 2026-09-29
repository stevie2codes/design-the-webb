// live/s03.glsl — S3 REDACTED live animation (SPEC §3.10 S3). Spliced into
// live.glsl (after the Live struct, before live()); called as
//   case K_REDACTED: liveRedacted(L, meta, off, t); break;
// Generator: states/s03-redacted.ts. meta.b = row fraction, 0 at the top of
// the block → 1 at the bottom (the band and the wipe are in block fractions,
// so they scale with the block on every layout).
//
// - Scan band: .06 su tall (of the .85 su block) sweeping top → bottom every
//   4.5 s, +45% brightness. It enters above the block and leaves below it, so
//   the wrap never pops.
// - uCharge (hovering / focusing "Request by email", damped on the CPU): the
//   scan runs ×3 — a second band at triple speed crossfades in with the
//   charge, so the phase never jumps — and the slabs dim 30%, the dim wiping
//   in from the top row to the bottom as the charge rises. The lock outline
//   brightens a touch. A peek that reveals nothing.
//
// Reduced motion: t frozen at POSTER_TIME (0): the band sits above the block
// (not drawn), plain bone-grey slabs.

#define REDACT_SCAN_PERIOD 4.5
#define REDACT_SCAN_HALF 0.0353
#define REDACT_SCAN_OVER 0.1
#define REDACT_SCAN_GAIN 0.45
#define REDACT_CHARGE_SPEED 3.0
#define REDACT_CHARGE_DIM 0.3
#define REDACT_CHARGE_LOCK 0.35

float redactBand(float v, float phase) {
  float c = -REDACT_SCAN_OVER + (1.0 + 2.0 * REDACT_SCAN_OVER) * fract(phase);
  return 1.0 - smoothstep(0.0, REDACT_SCAN_HALF, abs(v - c));
}

void liveRedacted(inout Live L, vec4 meta, vec4 off, float t) {
  float v = meta.b;
  float ph = t / REDACT_SCAN_PERIOD;
  float band = mix(redactBand(v, ph), redactBand(v, REDACT_CHARGE_SPEED * ph), uCharge);
  L.bright *= 1.0 + REDACT_SCAN_GAIN * band;
  int role = roleOf(meta);
  if (role == R_FILL) {
    L.alpha *= 1.0 - REDACT_CHARGE_DIM * smoothstep(0.6 * v, 0.6 * v + 0.4, uCharge);
  } else if (role == R_SPARK) {
    L.bright *= 1.0 + REDACT_CHARGE_LOCK * uCharge;
  }
}
