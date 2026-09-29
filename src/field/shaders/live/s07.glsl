// live/s07.glsl — S7 CONSTELLATION live animation (SPEC §3.10 S7). Spliced
// into live.glsl (after the Live struct, before live()); called as
//   case K_CONSTELLATION: liveConstellation(L, meta, off, t); break;
// Generator: states/s07-constellation.ts — the constants below mirror its
// CONSTELLATION, SPOKE_U0 / SPOKE_U1 and PACKET_PHASE.
//
// Everything happens in the MODEL frame (orbit in XZ, hub at the origin),
// reached by undoing the display tilt Rx(28°) and redone at the end:
// - Spokes (role flow, spoke k = group) and packets (role packet): move
//   along spoke k, u = U0 + fract(v0 ± .2t / span)·span over the visible
//   span U0…U1 (hub surface → satellite surface): odd spokes outbound,
//   even spokes inbound (request / response). The spoke's length is
//   dot(p, dir_k) / u0 (u0 is 8-bit exact and the jitter is ⟂ the spoke),
//   so no unit length is needed. Packets draw 1.8× and fade in / out at the
//   ends.
// - Satellites (role edge, k < 6) brighten (+70%, warmer) as a packet
//   reaches (odd) or leaves (even) them.
// - The whole graph spins about the model Y (the orbit's axis) at
//   .07 rad/s: satellites travel the ellipse, the dotted ring slides, the
//   halo shell (oblate about the same axis) keeps its silhouette.
// - uCharge (hovering the project title): +35% brightness (halo excepted).
//
// Reduced motion: t frozen at POSTER_TIME = 0 (CONSTELLATION_POSTER_T): the
// leading packet of each spoke mid-spoke, the graph at its generated pose.

#define CON_TC 0.8829476 // cos 28 deg
#define CON_TS 0.4694716 // sin 28 deg
#define CON_SPIN 0.07
#define CON_U0 0.1490196 // 38 / 255
#define CON_U1 0.9254902 // 236 / 255
#define CON_FLOW 0.2
#define CON_PACKET_SIZE 1.8
#define CON_PACKETS 2.0
#define CON_GLOW_W 0.06
#define CON_GLOW 0.7
#define CON_CHARGE 0.35

// Leading packet centre per spoke at t = 0, as a fraction of the span.
const float CON_PHASE[6] = float[6](0.5, 0.58, 0.45, 0.62, 0.4, 0.54);

vec3 conUntilt(vec3 p) { return vec3(p.x, p.y * CON_TC + p.z * CON_TS, p.z * CON_TC - p.y * CON_TS); }
vec3 conTilt(vec3 q) { return vec3(q.x, q.y * CON_TC - q.z * CON_TS, q.y * CON_TS + q.z * CON_TC); }
// Odd spokes carry requests out (+), even spokes responses in (−).
float conSign(int k) { return (k & 1) == 1 ? 1.0 : -1.0; }

void liveConstellation(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  int k = groupOf(meta);
  vec3 q = conUntilt(L.p);
  float span = CON_U1 - CON_U0;
  float rate = CON_FLOW / span;
  if ((role == R_FLOW || role == R_PACKET) && k < 6) {
    float th = float(k) * (PI / 3.0);
    vec3 dir = vec3(cos(th), 0.0, sin(th));
    float u0 = meta.b;
    float along = dot(q, dir);
    vec3 perp = q - along * dir;
    float len = along / max(u0, 0.05);
    float v = fract((u0 - CON_U0) / span + conSign(k) * rate * t);
    q = dir * ((CON_U0 + v * span) * len) + perp;
    if (role == R_PACKET) {
      L.size *= CON_PACKET_SIZE;
      L.alpha *= smoothstep(0.0, 0.08, v) * (1.0 - smoothstep(0.9, 1.0, v));
    }
  } else if (role == R_EDGE && k < 6) {
    float g = 0.0;
    for (int j = 0; j < 2; j++) {
      float vc = fract(CON_PHASE[k] + float(j) / CON_PACKETS + conSign(k) * rate * t);
      float d = min(vc, 1.0 - vc) / CON_GLOW_W;
      g += exp(-d * d);
    }
    L.bright *= 1.0 + CON_GLOW * g;
    L.ramp += 0.1 * g;
  }
  float a = CON_SPIN * t;
  float c = cos(a);
  float sn = sin(a);
  q.xz = vec2(c * q.x - sn * q.z, sn * q.x + c * q.z);
  L.p = conTilt(q);
  if (role != R_HALO) L.bright *= 1.0 + CON_CHARGE * uCharge;
}
