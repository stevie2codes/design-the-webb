// live/s09.glsl — S9 BEACON live animation (SPEC §3.10 S9, §5 C5). Spliced
// into live.glsl (after the Live struct, before live()); called as
//   case K_BEACON: liveBeacon(L, meta, off, t); break;
// Generator: states/s09-beacon.ts — the constants below mirror its BEACON,
// BEACON_ALPHA, rimWeight / backWeight / infallRamp. Local su about the
// beacon centre (= the DOM CTA disc's centre), y up, +z toward the camera.
// Nothing here needs R: every motion is a rotation or a scaling about the
// centre, so the shader stays scale-free.
//
// - Shell (edge): spins about Y at .06 rad/s and breathes ×(1 + .03·sin(2π·.2t)).
//   The rim (abs(n·v) < .25, v = +z) is ember and brighter, the back
//   hemisphere dimmer; both are recomputed from the rotated normal as the
//   ratio to the weights the generator baked for t = 0.
// - Core (fill) and sparks: σ ×1.4 under uCharge; the sparks flicker.
// - Ring (ring): spins about its own axis at .12 rad/s. uCharge ×3 without a
//   phase jump: half the particles (aSeed.z < .5) spin at .12, half at .36,
//   and the charge crossfades from one population to the other.
// - Infall (flow): u = fract(u0 − .07t), u0 = meta.b. A log spiral is
//   self-similar, so moving a particle by Δu = u − u0 along its arm is a
//   scaling by 2.6^Δu and a turn of −2π·TURNS·Δu in the infall disc — its
//   offset from the arm travels with it. Fades in at 2.6R, out into the shell;
//   colour warms from steel to ember as it falls.
// - uCharge: rim threshold .25 → .45, brightness +25%. uNova: ×1.8 about
//   the centre (the halo ×1.4) and brighter.
// - uSink (the finale; tuned, CONTRACTS.md): the CTA disc that covers the
//   core fades over the first quarter of the sink, so the core and the
//   sparks fade with it (to ×.2) — a bare, dense core would sum to white
//   (the anchor's area-conserving α handles the rest, scroll/anchors.ts).
//
// Reduced motion: t frozen at POSTER_TIME (0): breath at mean radius.

#define BEACON_SPIN 0.06
#define BEACON_BREATH 0.03
#define BEACON_BREATH_HZ 0.2
#define BEACON_RING_SPIN 0.12
#define BEACON_RING_CHARGED 3.0
#define BEACON_INFALL_RATE 0.07
#define BEACON_INFALL_OUTER 2.6
#define BEACON_TURNS 0.42
#define BEACON_RIM 0.25
#define BEACON_RIM_CHARGED 0.45
#define BEACON_RIM_SOFT 0.05
#define BEACON_RIM_GAIN 2.4
#define BEACON_BACK 0.5
#define BEACON_RING_BACK 0.6
#define BEACON_CORE_CHARGED 1.4
#define BEACON_CHARGE_GAIN 0.25
#define BEACON_NOVA 0.8
#define BEACON_NOVA_GAIN 0.5
#define BEACON_SINK_CORE 0.8   // core / sparks fade by this much…
#define BEACON_SINK_BARE 0.25  // …over this much of the sink (the disc's fade)
// Ring frame: tilt 18° about X, roll 8° about Z (cos, sin).
#define BEACON_RING_T vec2(0.9510565, 0.3090170)
#define BEACON_RING_R vec2(0.9902681, 0.1391731)
// Infall frame: tilt 30° about X, roll 8° about Z.
#define BEACON_INF_T vec2(0.8660254, 0.5)
#define BEACON_INF_R vec2(0.9902681, 0.1391731)

// Disc frame (x, z in the plane, y the axis) → local: tilt about X, then roll about Z.
vec3 beaconFromDisc(vec3 d, vec2 tilt, vec2 roll) {
  vec3 q = vec3(d.x, d.y * tilt.x - d.z * tilt.y, d.y * tilt.y + d.z * tilt.x);
  return vec3(q.x * roll.x - q.y * roll.y, q.x * roll.y + q.y * roll.x, q.z);
}

vec3 beaconToDisc(vec3 p, vec2 tilt, vec2 roll) {
  vec3 q = vec3(p.x * roll.x + p.y * roll.y, -p.x * roll.y + p.y * roll.x, p.z);
  return vec3(q.x, q.y * tilt.x + q.z * tilt.y, -q.y * tilt.y + q.z * tilt.x);
}

// Turn the in-plane (x, z) by a (θ increasing: the ring's and the infall's sense).
vec3 beaconTurn(vec3 d, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
}

float beaconRim(float nz, float th) {
  return 1.0 - smoothstep(th - BEACON_RIM_SOFT, th + BEACON_RIM_SOFT, abs(nz));
}

float beaconBack(float nz) {
  return BEACON_BACK + (1.0 - BEACON_BACK) * smoothstep(-0.7, 0.35, nz);
}

float beaconInfallRamp(float u) {
  return mix(0.72, 0.3, u);
}

void liveBeacon(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  float charge = uCharge;
  float nova = 1.0 + BEACON_NOVA * uNova;
  if (role == R_EDGE) {
    vec3 n0 = normalize(L.p);
    float a = BEACON_SPIN * t;
    float c = cos(a);
    float s = sin(a);
    vec3 p = vec3(L.p.x * c + L.p.z * s, L.p.y, -L.p.x * s + L.p.z * c);
    vec3 n = normalize(p);
    float rim0 = beaconRim(n0.z, BEACON_RIM);
    float rim = beaconRim(n.z, mix(BEACON_RIM, BEACON_RIM_CHARGED, charge));
    L.alpha *= (1.0 + (BEACON_RIM_GAIN - 1.0) * rim) * beaconBack(n.z) /
               ((1.0 + (BEACON_RIM_GAIN - 1.0) * rim0) * beaconBack(n0.z));
    L.ramp += 0.25 * (rim - rim0);
    L.p = p * (1.0 + BEACON_BREATH * sin(TAU * BEACON_BREATH_HZ * t)) * nova;
  } else if (role == R_FILL) {
    L.p *= mix(1.0, BEACON_CORE_CHARGED, charge) * nova;
    L.alpha *= 1.0 - BEACON_SINK_CORE * smoothstep(0.0, BEACON_SINK_BARE, uSink);
  } else if (role == R_SPARK) {
    L.p *= mix(1.0, BEACON_CORE_CHARGED, charge) * nova;
    L.alpha *= 0.8 + 0.2 * sin(TAU * (0.7 + 0.8 * gSeed.y) * t + TAU * gSeed.x);
    L.alpha *= 1.0 - BEACON_SINK_CORE * smoothstep(0.0, BEACON_SINK_BARE, uSink);
  } else if (role == R_RING) {
    bool fast = gSeed.z >= 0.5;
    float speed = BEACON_RING_SPIN * (fast ? BEACON_RING_CHARGED : 1.0);
    L.alpha *= 2.0 * (fast ? charge : 1.0 - charge);
    vec3 d = beaconTurn(beaconToDisc(L.p, BEACON_RING_T, BEACON_RING_R), speed * t);
    // The half behind the shell (disc z < 0) recedes.
    L.alpha *= mix(BEACON_RING_BACK, 1.0, smoothstep(-0.35, 0.35, d.z / max(length(d.xz), 1e-5)));
    L.p = beaconFromDisc(d, BEACON_RING_T, BEACON_RING_R) * nova;
  } else if (role == R_FLOW) {
    float u0 = meta.b;
    float u = fract(u0 - BEACON_INFALL_RATE * t);
    float du = u - u0;
    vec3 d = beaconToDisc(L.p, BEACON_INF_T, BEACON_INF_R);
    d = beaconTurn(d, -TAU * BEACON_TURNS * du) * pow(BEACON_INFALL_OUTER, du);
    L.p = beaconFromDisc(d, BEACON_INF_T, BEACON_INF_R) * nova;
    L.alpha *= smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.78, 1.0, u));
    L.ramp += beaconInfallRamp(u) - beaconInfallRamp(u0);
  } else {
    L.p *= 1.0 + 0.5 * BEACON_NOVA * uNova;
  }
  L.bright *= (1.0 + BEACON_CHARGE_GAIN * charge) * (1.0 + BEACON_NOVA_GAIN * uNova);
}
