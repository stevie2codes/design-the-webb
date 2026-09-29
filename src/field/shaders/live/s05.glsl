// live/s05.glsl — S5 CIVIC LATTICE live animation (SPEC §3.10 S5). Spliced
// into live.glsl (after the Live struct, before live()); called as
//   case K_LATTICE: liveLattice(L, meta, off, t); break;
// Generator: states/s05-lattice.ts. meta.b = row / 51 (row 0 = bottom; 8-bit
// exact) on every lattice particle and spark; the halo is left alone.
//
// The write-head: head = floor(τ / 3.2 · 52) for τ = t mod 4 < 3.2, then 52
// (fully printed) through the .8 s hold — the same formula as latticeRow(t)
// in s05-lattice.ts, which drives the DOM "ROWS nn/52" counter.
// - Rows below the head: printed, crisp: each node's z-stack (8 layers, .018
//   su apart) is registered onto the node's line of sight, so the stack
//   reads as one sharp record instead of a perspective streak (up to ≈ 18 px
//   on a desktop card's far side). The few rows just printed cool from ember
//   (a short trail behind the head).
// - The head row: ember, +80% brightness; the sparks live here only.
// - Rows above: dim (×.5 of printed, spread thin), the stack unregistered (its natural
//   parallax) with a ±.01 su jitter at 8 Hz, cooler: "not yet generated".
//   Printing snaps the records into register.
// - The hold's last .3 s dissolve the print back to "not yet", so the next
//   sweep starts from a settled dim building instead of a hard cut.
// - uCharge (hovering the project title): +35% brightness on the print.
// - uDisperse (the C3 curtain: the anchor scales ×1.6 at α ×.35): records
//   grow ×1.5 and gain ×1.9 α, so the lattice still frames the card as a
//   living halo (its pinpoints do not scale with the anchor, and at ×.35
//   they vanished; S4's dense strokes need no help).
//
// Reduced motion: t frozen at POSTER_TIME = 3.5 s (mid-hold): fully printed.

#define LAT_ROWS 52.0
#define LAT_SWEEP 3.2
#define LAT_PERIOD 4.0
#define LAT_RESET 0.3
// §3.10: α .22 of .85; raised (tuned): the unregistered, jittering stack spreads
// its light over ≈ 3 px, so ×.26 left the unprinted rows invisible.
#define LAT_ABOVE 0.5
#define LAT_JITTER 0.01
#define LAT_JITTER_HZ 8.0
#define LAT_HEAD_GAIN 1.8
#define LAT_TRAIL 2.5
#define LAT_CHARGE 0.35
// Printed records draw a touch larger than the base pinpoint (tuned, like S1's grains).
#define LAT_RECORD_SIZE 1.35
#define LAT_CURTAIN_SIZE 0.5
#define LAT_CURTAIN_ALPHA 0.9

// Printed rows at t (0–52): the CPU twin is latticeRow() in s05-lattice.ts.
float latticeHead(float t) {
  float tau = mod(t, LAT_PERIOD);
  return tau < LAT_SWEEP ? min(LAT_ROWS, floor(tau / LAT_SWEEP * LAT_ROWS)) : LAT_ROWS;
}

// Register a back layer onto its node's line of sight (amount k): the world
// xy (anchor scale off.z, centre off.xy) scaled by 1 / persp of its depth
// projects exactly onto the front layer's screen point.
void latticeRegister(inout Live L, vec4 off, float k) {
  float zw = L.p.z * off.z;
  if (k <= 0.0 || zw > -1e-5 || off.z <= 0.0) return;
  vec2 w = L.p.xy * off.z + off.xy;
  vec2 reg = (w * ((CAM_Z - zw) / CAM_Z) - off.xy) / off.z;
  L.p.xy = mix(L.p.xy, reg, k);
}

void liveLattice(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  if (role == R_HALO) return;
  L.size *= 1.0 + LAT_CURTAIN_SIZE * uDisperse;
  L.alpha *= 1.0 + LAT_CURTAIN_ALPHA * uDisperse;
  float row = floor(meta.b * (LAT_ROWS - 1.0) + 0.5);
  float tau = mod(t, LAT_PERIOD);
  float head = latticeHead(t);
  // Continuous head position (rows), for the cooling trail; runs on past 52 in the hold.
  float hf = tau / LAT_SWEEP * LAT_ROWS;
  float reset = smoothstep(LAT_PERIOD - LAT_RESET, LAT_PERIOD, tau);

  if (role == R_SPARK) {
    float on = row == head ? 1.0 : (row == head - 1.0 ? 0.3 : 0.0);
    // A hair of upward flicker: the head is hot.
    float fl = hash11(gSeed.x * 131.7 + mod(floor(t * 20.0), 1024.0));
    L.alpha *= on * (0.6 + 0.4 * fl);
    L.p.y += 0.004 * fl * on;
    return;
  }

  float charge = 1.0 + LAT_CHARGE * uCharge;
  // Printed amount: 1 below the head (and through the hold), 0 above, the
  // reset dissolving it at the end of the hold.
  float printed = row < head ? 1.0 - reset : 0.0;
  if (row == head) {
    L.ramp += 0.75 - meta.r;
    L.bright *= LAT_HEAD_GAIN * charge;
    L.size *= LAT_RECORD_SIZE;
    latticeRegister(L, off, 1.0);
    return;
  }
  float age = hf - row - 1.0;
  float warm = row < head ? exp(-max(age, 0.0) / LAT_TRAIL) * (1.0 - reset) : 0.0;
  L.ramp += (0.75 - meta.r) * 0.55 * warm - 0.08 * (1.0 - printed);
  L.bright *= mix(1.0, charge, printed) * (1.0 + 0.3 * warm);
  L.alpha *= mix(LAT_ABOVE, 1.0, printed);
  L.size *= mix(1.0, LAT_RECORD_SIZE, printed);
  latticeRegister(L, off, printed);
  // "Not yet generated": a smooth ±.01 su wander, per particle, at 8 Hz.
  float un = 1.0 - printed;
  if (un > 0.0) {
    // Step indices wrap at 1024 (small hash arguments keep GPU sin precise);
    // j1 of step n is j0 of step n + 1, so the wander stays continuous.
    float n = floor(t * LAT_JITTER_HZ);
    float n0 = mod(n, 1024.0);
    float n1 = mod(n + 1.0, 1024.0);
    float f = smoothstep(0.0, 1.0, fract(t * LAT_JITTER_HZ));
    vec2 j0 = vec2(hash11(gSeed.x * 97.3 + n0), hash11(gSeed.y * 57.1 + n0));
    vec2 j1 = vec2(hash11(gSeed.x * 97.3 + n1), hash11(gSeed.y * 57.1 + n1));
    L.p.xy += (mix(j0, j1, f) * 2.0 - 1.0) * LAT_JITTER * un;
  }
}
