// live.glsl — per-state live animation (SPEC §3.10 "Live"). Each pair
// endpoint runs live() on its LOCAL position (su, before the anchor
// transform); the results are mixed by the eased progress e.
//
// Adding a state = a generator file (states/sNN-*.ts) + one case here + a
// STATE_PARAMS row (uniforms.ts). Cases receive `t` = uTimeA / uTimeB: the
// clock in full motion, the state's poster time under reduced motion.

struct Live {
  vec3 p;       // local position, su
  float alpha;  // × base alpha
  float bright; // × colour (additive: brightness)
  float size;   // × point size
  float ramp;   // + palette ramp position
};

// S1 NAME: α shimmer .8–1.0 at .3–.9 Hz; the scan beam (+180% within .02 su
// of uScanX, world x); printed (uPrinted 1): α ×.45, size ×1.5 — the
// particles become a halo behind the DOM type.
void liveName(inout Live L, vec4 meta, vec4 off, float t) {
  if (roleOf(meta) != R_SPARK) {
    float hz = 0.3 + 0.6 * gSeed.y;
    L.alpha *= 0.9 + 0.1 * sin(TAU * (hz * t + gSeed.x));
  }
  float wx = L.p.x * off.z + off.x;
  L.bright *= 1.0 + 1.8 * (1.0 - smoothstep(0.012, 0.02, abs(wx - uScanX)));
  L.alpha *= mix(1.0, 0.45, uPrinted);
  L.size *= mix(1.0, 1.5, uPrinted);
}

Live live(int kind, vec3 p, vec4 meta, vec4 off, float t) {
  Live L = Live(p, 1.0, 1.0, 1.0, 0.0);
  switch (kind) {
    case K_NAME:
      liveName(L, meta, off, t);
      break;
    // K_STATIC: none (drift only).
    // Later phases add, per §3.10:
    // K_CHART (5): fizz y = base + fract(u0 + .12t)·band, α·(1 − f)²; AI point .5 Hz pulse, reticle .3 rad/s.
    // K_REDACTED (5): scan band .06 su tall every 4.5 s (+45%); uCharge: ×3 speed, dim 30% top → bottom.
    // K_PULSE (6): highlight along u (2.4 s, signal → ember); rings +.12W·fract(t/2.4), fading.
    // K_LATTICE (6): write-head row sweeps up in 3.2 s + .8 s hold; below α .85, row ember +80%, above α .22 ±.01.
    // K_DECK (6): underscore blink 1.06 s square wave (80 ms edges); stroke flows along u at .05/s.
    // K_CONSTELLATION (6): rotate about Y .07 rad/s; spokes u = fract(u0 ± .2t); packets 1.8× size.
    // K_STACK (7): active plate lifts +.06s, slides +.08s (uGroupW), 70% ember; others +1.2 CoC.
    // K_BEACON (7): shell spin .06 rad/s, breath R(1 + .03 sin(2π·.2t)); ring .12 rad/s; infall; rim ember; uCharge, uNova.
    // K_FLATLINE (7): y += uBeat·.14·ECG(x); heat to ember where |ECG| > .5.
    default:
      break;
  }
  return L;
}
