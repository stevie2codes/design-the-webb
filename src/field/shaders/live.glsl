// live.glsl — per-state live animation (SPEC §3.10 "Live"). Each pair
// endpoint runs live() on its LOCAL position (su, before the anchor
// transform); the results are mixed by the eased progress e.
//
// Adding a state = a generator file (states/sNN-*.ts), its live function in
// shaders/live/sNN.glsl (spliced at `// @include states`) + one case here + a
// STATE_PARAMS row (uniforms.ts). Cases receive `t` = uTimeA / uTimeB: the
// clock in full motion, the state's poster time under reduced motion.

struct Live {
  vec3 p;       // local position, su
  float alpha;  // × base alpha
  float bright; // × colour (additive: brightness)
  float size;   // × point size
  float ramp;   // + palette ramp position
  float soft;   // 0 crisp / bokeh, 1 soft glow sprite
};

// S1 printed halo (tuned, CONTRACTS.md "Tuning notes"). §3.10 asks for
// α ×.45 and size ×1.5, but the crisp DOM type covers every particle inside
// the glyphs, so that halo never shows. Instead: interior fill fades out
// (hidden anyway, and it frees the fill rate), half the edge particles grow
// into wide soft glow sprites that bloom past the glyph edges, warmed a
// touch toward ember —
// the type glows. The band and the hairline keep §3.10's ×.45 / ×1.5.
#define NAME_GRAIN_SIZE 1.45
#define HALO_EDGE_SHARE 1.0
// Final review: at ×4.2 / α .085 the sprites stayed discrete and the lock read
// as speckled, eroded edges. Wider, fainter sprites (about the same light)
// overlap into a smooth glow; the DOM edge stays clean.
#ifdef TIER_LOW
#define HALO_EDGE_SIZE 4.2 // larger base points and a smaller name on phones
#define HALO_EDGE_ALPHA 0.045
#else
#define HALO_EDGE_SIZE 6.0
#define HALO_EDGE_ALPHA 0.042
#endif
#define HALO_EDGE_WARM 0.08

// S1 NAME: α shimmer .8–1.0 at .3–.9 Hz; the scan beam (+180% within .02 su
// of uScanX, world x), warmed from bone to p-core through ember (§2.1 "scan
// flash", §10 "an ember scan beam"); printed (uPrinted 1): the halo above.
void liveName(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  if (role != R_SPARK) {
    float hz = 0.3 + 0.6 * gSeed.y;
    L.alpha *= 0.9 + 0.1 * sin(TAU * (hz * t + gSeed.x));
  }
  float wx = L.p.x * off.z + off.x;
  float beam = 1.0 - smoothstep(0.012, 0.02, abs(wx - uScanX));
  L.bright *= 1.0 + 1.8 * beam;
  L.ramp += 0.5 * beam;
  float pr = uPrinted;
  // Resolved glyph grains draw a touch larger than the base pinpoint so the
  // particle name reads as light, not grey sand (tuning).
  if (role == R_FILL || role == R_EDGE) L.size *= NAME_GRAIN_SIZE;
  if (role == R_FILL) {
    L.alpha *= 1.0 - pr;
  } else if (role == R_EDGE) {
    // Edge particles (HALO_EDGE_SHARE of them) become the glow, the rest fade
    // with the fill: wide, faint sprites overlap into a smooth bloom.
    float glow = step(gSeed.y, HALO_EDGE_SHARE);
    L.alpha *= mix(1.0, HALO_EDGE_ALPHA * glow, pr);
    L.size *= mix(1.0, HALO_EDGE_SIZE, pr * glow);
    L.soft = pr * glow;
    L.ramp += HALO_EDGE_WARM * pr;
  } else {
    L.alpha *= mix(1.0, 0.45, pr);
    L.size *= mix(1.0, 1.5, pr);
  }
}

// Per-state live functions (shaders/live/sNN.glsl, spliced here by
// material.ts in file order): liveChart, liveRedacted, livePulse,
// liveLattice, liveDeck, liveConstellation, liveStack, liveBeacon,
// liveFlatline.
// @include states

Live live(int kind, vec3 p, vec4 meta, vec4 off, float t) {
  Live L = Live(p, 1.0, 1.0, 1.0, 0.0, 0.0);
  switch (kind) {
    case K_NAME:
      liveName(L, meta, off, t);
      break;
    // K_STATIC: none (drift only).
    case K_CHART:
      liveChart(L, meta, off, t);
      break;
    case K_REDACTED:
      liveRedacted(L, meta, off, t);
      break;
    case K_PULSE:
      livePulse(L, meta, off, t);
      break;
    case K_LATTICE:
      liveLattice(L, meta, off, t);
      break;
    case K_DECK:
      liveDeck(L, meta, off, t);
      break;
    case K_CONSTELLATION:
      liveConstellation(L, meta, off, t);
      break;
    case K_STACK:
      liveStack(L, meta, off, t);
      break;
    case K_BEACON:
      liveBeacon(L, meta, off, t);
      break;
    case K_FLATLINE:
      liveFlatline(L, meta, off, t);
      break;
    default:
      break;
  }
  return L;
}
