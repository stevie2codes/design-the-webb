// live/s10.glsl — S10 FLATLINE live animation (SPEC §3.10 S10, §6 404).
// Spliced into live.glsl (after the Live struct, before live()); called as
//   case K_FLATLINE: liveFlatline(L, meta, off, t); break;
// Generator: states/s10-flatline.ts — the constants below mirror its FLAT.
// Local su about the line's centre, x along it; meta.b = the log-encoded line
// length; ghost k = group − 4.
//
// - The line is flat. uBeat (0 → 1 → 0 over 600 ms, fired by the CTA's hover
//   / focus) raises one heartbeat centred on screen: y += uBeat·.14·ECG(x),
//   ECG = P + Q + R + S + T Gaussians (§3.10) with R at the line's centre.
//   Heat rises to ember (and brighter) where abs(ECG) > .5. The halo follows
//   at .6; ghost k echoes it at (1 − .14k).
// - Scan head (sparks) crosses the line every 3.2 s, entering and leaving
//   by a 6% margin; it rides the heartbeat too. The trace brightens under
//   it; the ghosts are the phosphor trail behind it (decay .06k of the line,
//   measured modulo the sweep so the wrap never pops) and all show while a
//   beat plays.
// - Depth: the generator writes FLAT positions with a z spread for the
//   aperture to blur. Here each particle's anchored position is divided by
//   its perspective, so depth changes its blur, never its place: the line
//   stays registered to its DOM anchor at any z (and the beat's amplitude is
//   exact on screen).
//
// - uCharge (the CTA hover / focus; the director racks the aperture .5 →
//   .04 with it): the global bokeh falloff (α / grow^1.3, tuned for S0)
//   makes a defocused line emit MORE light than a focused one, so the
//   sharpening read as the signal fading out. The line and its ghosts gain
//   α ×4 with the charge, the halo ×2.4 (at .04 the drawn energy then
//   matches or exceeds the defocused rest) and lift a touch toward p-signal — the
//   trace snaps into a crisp, brighter line ("the lost signal sharpens",
//   §6). BOKEH_FALLOFF itself is untouched.
//
// Reduced motion: uBeat stays 0 (flat) and t is frozen at POSTER_TIME
// (FLAT_POSTER_T ≈ 2.229 s): the head at .72 of the line, its trail behind.

#define FLAT_L_MIN 0.25
#define FLAT_L_LOG 3.4657359 // ln(8 / .25)
#define FLAT_AMP 0.14
#define FLAT_R_AT 0.5
#define FLAT_SCAN_PERIOD 3.2
#define FLAT_SCAN_MARGIN 0.06
#define FLAT_HEAD_W 0.01
#define FLAT_HEAD_GAIN 1.6
#define FLAT_TAIL 0.06
#define FLAT_HALO_FOLLOW 0.6
#define FLAT_GHOST_DROP 0.14
#define FLAT_CHARGE_GAIN 4.0  // α × this at uCharge 1 (focused line energy ≥ the defocused rest; measured)
#define FLAT_CHARGE_HALO 2.4  // the halo less: focused, its grains read as specks, not glow
#define FLAT_CHARGE_LIFT 0.1  // ramp lift toward p-signal at uCharge 1 (steel halo / ghosts; the line is signal already)

float flatGauss(float x, float m, float s) {
  float d = (x - m) / s;
  return exp(-0.5 * d * d);
}

// §3.10: P +.12 @ .18 σ .025; Q −.12 @ .37 σ .008; R +1 @ .40 σ .010;
// S −.28 @ .43 σ .010; T +.28 @ .62 σ .04.
float flatEcg(float x) {
  return 0.12 * flatGauss(x, 0.18, 0.025) - 0.12 * flatGauss(x, 0.37, 0.008) + flatGauss(x, 0.40, 0.010) -
         0.28 * flatGauss(x, 0.43, 0.010) + 0.28 * flatGauss(x, 0.62, 0.04);
}

void liveFlatline(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  float len = FLAT_L_MIN * exp(meta.b * FLAT_L_LOG);
  float sweep = 1.0 + 2.0 * FLAT_SCAN_MARGIN;
  float head = -FLAT_SCAN_MARGIN + sweep * fract(t / FLAT_SCAN_PERIOD);
  float beat = uBeat;
  float shift = 0.40 - FLAT_R_AT;
  if (role == R_SPARK) {
    float xs = head + L.p.x / len; // this spark's place: the head plus its offset
    L.p.x += (head - 0.5) * len;
    L.p.y += beat * FLAT_AMP * flatEcg(xs + shift);
    // Fade with the line's own tapered ends (the head enters and leaves by the margin).
    L.alpha *= smoothstep(-0.02, 0.06, xs) * (1.0 - smoothstep(0.94, 1.02, xs));
  } else {
    float xf = L.p.x / len + 0.5;
    float e = flatEcg(xf + shift);
    float k = role == R_GHOST ? float(groupOf(meta) - 4) : 0.0;
    float follow = role == R_HALO ? FLAT_HALO_FOLLOW : 1.0 - FLAT_GHOST_DROP * k;
    L.p.y += beat * FLAT_AMP * e * follow;
    if (role != R_HALO) {
      float hot = smoothstep(0.35, 0.65, abs(e)) * min(1.0, 1.5 * beat);
      L.ramp += 0.25 * hot;
      L.bright *= 1.0 + 0.8 * hot;
    }
    // The sharpening reads as the signal returning (see the header).
    L.alpha *= mix(1.0, role == R_HALO ? FLAT_CHARGE_HALO : FLAT_CHARGE_GAIN, uCharge);
    L.ramp += min(FLAT_CHARGE_LIFT, max(0.0, 0.5 - meta.r)) * uCharge; // toward p-signal, never past it
    if (role == R_GHOST) {
      float behind = mod(head - xf, sweep);
      L.alpha *= max(exp(-behind / (FLAT_TAIL * k)), 0.85 * beat);
    } else if (role == R_FLOW) {
      float hw = flatGauss(xf, head, FLAT_HEAD_W);
      L.bright *= 1.0 + FLAT_HEAD_GAIN * hw;
      L.ramp += 0.15 * hw;
    }
  }
  // Depth blurs, never moves: undo the perspective of the anchored position.
  float persp = CAM_Z / (CAM_Z - L.p.z * off.z);
  vec2 world = L.p.xy * off.z + off.xy;
  L.p.xy = (world / persp - off.xy) / max(off.z, 1e-4);
}
