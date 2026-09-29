// live/s04.glsl — S4 PULSE live animation (SPEC §3.10 S4). Spliced into
// live.glsl (after the Live struct, before live()); called as
//   case K_PULSE: livePulse(L, meta, off, t); break;
// Generator: states/s04-pulse.ts — the constants below mirror its PULSE,
// PULSE_BUBBLE, PULSE_APEX and PULSE_PHASE (local units: W = 1 = the
// bubble width, y up, origin at the anchor centre).
//
// - Highlight: a Gaussian (σ .03 in u) travels along the ECG's arc length u
//   (meta.b) once every 2.4 s, from −.1 to 1.1 so it enters and leaves
//   cleanly, shifting the trace from signal to ember (+160% brightness).
// - Persistence ghosts (group k = 1..3): lit only by the highlight lagging
//   .02k behind — a phosphor trail that cools and widens as it ages.
// - Sparks (the spike): smoulder, and flare as the highlight crosses them.
// - Rings: expand +.12W·φ and fade; φ wraps to 0 exactly as the highlight
//   crosses the apex, so a new ring is born there with a ping while the others
//   hand their radii on (the generator gives every ring the same density per
//   unit angle, so the wrap is seamless). Ring particles carry the unit length
//   in z (z = −.04W su, exact): no per-state uniform. Clipped to the bubble.
// - uCharge (hovering the project title): +35% brightness, rings ×1.6 α.
//
// Reduced motion: t frozen at POSTER_TIME = 2.4 × PULSE_PHASE ≈ .9819 s: the
// highlight centred on the spike apex, the newest ring just pinged.

#define PULSE_PERIOD 2.4
#define PULSE_SIGMA 0.03
#define PULSE_MARGIN 0.1
// fract(t / period) when the head sits on the apex: (u_apex + margin) / (1 + 2·margin), u_apex = .390940.
#define PULSE_PHASE 0.4091166
#define PULSE_GHOST_DU 0.02
#define PULSE_RING_ZK 0.04
#define PULSE_RING_R0 0.12
#define PULSE_RING_GROW 0.12
#define PULSE_RING_SPAN 0.36
#define PULSE_APEX vec2(-0.04, 0.250112)
#define PULSE_BUBBLE_C vec2(0.0, 0.0704)
#define PULSE_BUBBLE_H vec2(0.5, 0.2496)
#define PULSE_BUBBLE_R 0.16
#define PULSE_HI_GAIN 1.6
#define PULSE_HI_EMBER 0.25
#define PULSE_CHARGE 0.35

float pulseHi(float u, float head) {
  float d = (u - head) / PULSE_SIGMA;
  return exp(-0.5 * d * d);
}

void livePulse(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  float ph = fract(t / PULSE_PERIOD);
  float head = -PULSE_MARGIN + (1.0 + 2.0 * PULSE_MARGIN) * ph;
  float u = meta.b;
  float charge = 1.0 + PULSE_CHARGE * uCharge;
  // The C3 curtain (uDisperse): the ECG trace, its ghosts and the spike fade
  // out as the halo opens (final review: they poked out of both sides of the
  // open card as stray hair segments), so only the outline and the rings
  // frame the card.
  if (role == R_FLOW || role == R_GHOST || role == R_SPARK) L.alpha *= 1.0 - smoothstep(0.3, 0.6, uDisperse);

  if (role == R_FLOW) {
    float h = pulseHi(u, head);
    L.bright *= (1.0 + PULSE_HI_GAIN * h) * charge;
    L.ramp += PULSE_HI_EMBER * h;
    L.size *= 1.0 + 0.35 * h;
  } else if (role == R_GHOST) {
    // Trail: ghost k lights where the head was .02k of u ago.
    float k = float(groupOf(meta));
    float h = pulseHi(u + PULSE_GHOST_DU * k, head);
    L.alpha *= 1.8 * h;
    L.bright *= charge;
    L.ramp += PULSE_HI_EMBER * h * (1.0 - 0.3 * k);
  } else if (role == R_SPARK) {
    float h = pulseHi(u, head);
    float flick = 0.75 + 0.25 * sin(TAU * (1.3 * t + gSeed.y * 7.0));
    L.alpha *= (0.45 * flick + 1.2 * h) * charge;
    L.size *= 1.0 + 0.4 * h;
  } else if (role == R_RING) {
    float W = -L.p.z / PULSE_RING_ZK;
    if (W > 1e-4) {
      vec2 apex = PULSE_APEX * W;
      vec2 d = L.p.xy - apex;
      float r = length(d) / W;
      float phi = fract(ph - PULSE_PHASE);
      float r2 = r + PULSE_RING_GROW * phi;
      L.p.xy = apex + d * (r2 / max(r, 1e-4));
      // Fade as it expands (1 at birth → 0 at .48W), clip to the bubble.
      float env = clamp(1.0 - (r2 - PULSE_RING_R0) / PULSE_RING_SPAN, 0.0, 1.0);
      vec2 q = abs(L.p.xy / W - PULSE_BUBBLE_C) - (PULSE_BUBBLE_H - PULSE_BUBBLE_R);
      float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - PULSE_BUBBLE_R;
      float inside = 1.0 - smoothstep(-0.03, -0.008, sd);
      float ping = 1.0 - smoothstep(PULSE_RING_R0, PULSE_RING_R0 + 0.07, r2);
      L.alpha *= env * sqrt(env) * inside * (1.0 + 0.6 * uCharge) * (1.0 + 0.8 * ping);
      L.bright *= 1.0 + 0.8 * ping;
      L.ramp += 0.3 * ping;
    }
  } else if (role == R_EDGE) {
    L.bright *= charge;
  }
}
