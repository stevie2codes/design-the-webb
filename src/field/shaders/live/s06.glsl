// live/s06.glsl — S6 PROMPT DECK live animation (SPEC §3.10 S6). Spliced
// into live.glsl (after the Live struct, before live()); called as
//   case K_DECK: liveDeck(L, meta, off, t); break;
// Generator: states/s06-deck.ts — the constants below mirror its DECK,
// DECK_T, DECK_SHIFT and the deckTaper / deckCore / deckRamp profiles
// (deck units, y up; local su = (unit + DECK_SHIFT)·s).
//
// - Caret (role blink: the underscore; spark g1: its sparks): a 1.06 s
//   square wave with 80 ms edges, α 1 ↔ .12. t = 0 is the middle of an ON
//   phase.
// - Art stroke (role flow): streams along its arc length u at .05/s, head
//   (u = 0, ember) → tail (u = 1, signal), wrapping. Stroke particles sit at
//   z = −DECK_ZK·s exactly, which gives the unit length s; each particle is
//   decomposed against the curve's frame at its stored (8-bit) u — the
//   along-tangent residual j and the normal offset in σ units g — and
//   rebuilt at u' with σ(u'), so the tapered silhouette stays put while its
//   grains flow. α and colour are re-evaluated at u' (the head brightest
//   and ember, the thin tail dimmer), with 2.5% / 6% fades where the flow
//   wraps. 40% of the grains draw as wide soft sprites: a luminous body.
// - Head sparks (spark g0, also at z = −DECK_ZK·s): half flicker in the
//   ember head, half drift off it — outward, rising, away from the stroke —
//   and die over a .9–2.6 s life: a live pen tip throwing sparks.
// - uCharge (hovering the project title): +35% brightness.
// - uDisperse (the C3 curtain: anchor ×1.6 at α ×.35): card outlines grow
//   ×1.35 and gain ×1.8 α, so the deck still frames the open card.
//
// Reduced motion: t frozen at POSTER_TIME = 0 (DECK_POSTER_T): caret on, the
// stroke at its generated pose, the sparks mid-life.

#define DECK_ZK 0.02
#define DECK_SHIFT vec2(-0.025365, -0.211581)
#define DECK_SIGMA 0.035
#define DECK_FLOW 0.05
#define DECK_BLINK_P 1.06
#define DECK_BLINK_E 0.08
#define DECK_BLINK_LO 0.12
#define DECK_HEAD_U 0.04
#define DECK_P0 vec2(-0.85, 0.72)
#define DECK_P1 vec2(-0.3, 1.25)
#define DECK_P2 vec2(0.35, 0.3)
#define DECK_P3 vec2(0.9, 0.95)
#define DECK_RAMP_SIGNAL 0.5
#define DECK_RAMP_EMBER 0.75
// Head sparks: lives per second (× .7–1.3 per spark), drift over a life (units).
#define DECK_SPARK_RATE 0.6
#define DECK_SPRAY 0.075
#define DECK_CHARGE 0.35
#define DECK_CURTAIN_SIZE 0.35
#define DECK_CURTAIN_ALPHA 0.8
// A share of the stroke's grains draws as wide soft sprites (the S1 halo's
// profile): a luminous brush body under the crisp grain.
#define DECK_SOFT_SHARE 0.4
#define DECK_SOFT_SIZE 3.4
#define DECK_SOFT_ALPHA 0.16

// Bézier t at arc-length fraction i / 16 (s06-deck.ts DECK_T).
const float DECK_T[17] = float[17](0.0, 0.054969, 0.116393, 0.182303, 0.249569, 0.315906, 0.38063, 0.444076,
                                   0.506989, 0.570207, 0.634491, 0.700253, 0.767029, 0.832876, 0.894818, 0.950665, 1.0);

float deckTOf(float u) {
  float x = clamp(u, 0.0, 1.0) * 16.0;
  int i = min(int(x), 15);
  return mix(DECK_T[i], DECK_T[i + 1], x - float(i));
}

vec2 deckBez(float t) {
  float a = 1.0 - t;
  return a * a * a * DECK_P0 + 3.0 * a * a * t * DECK_P1 + 3.0 * a * t * t * DECK_P2 + t * t * t * DECK_P3;
}

vec2 deckTan(float t) {
  float a = 1.0 - t;
  vec2 d = 3.0 * a * a * (DECK_P1 - DECK_P0) + 6.0 * a * t * (DECK_P2 - DECK_P1) + 3.0 * t * t * (DECK_P3 - DECK_P2);
  return d / max(length(d), 1e-6);
}

// Width profile (× σ; ≥ .15, it divides), α along u, colour along u.
float deckTaper(float u) { return 0.15 + 0.85 * smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.4, 1.0, u)); }
float deckCore(float u) { return (1.0 - 0.45 * u) * (0.55 + 0.45 * deckTaper(u)); }
float deckRamp(float u) { return mix(DECK_RAMP_EMBER, DECK_RAMP_SIGNAL, smoothstep(0.0, 0.85, u)); }
float deckFade(float u) { return smoothstep(0.0, 0.025, u) * (1.0 - smoothstep(0.94, 1.0, u)); }

// 1 while the caret is on: a square wave with DECK_BLINK_E edges, ON centred on t = 0.
float deckCaret(float t) {
  float x = abs(fract(t / DECK_BLINK_P + 0.5) - 0.5);
  float e = 0.5 * DECK_BLINK_E / DECK_BLINK_P;
  return 1.0 - smoothstep(0.25 - e, 0.25 + e, x);
}

void liveDeck(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  float charge = 1.0 + DECK_CHARGE * uCharge;
  if (role == R_FLOW) {
    float s = -L.p.z / DECK_ZK;
    if (s > 1e-5) {
      float u0 = meta.b;
      float t0 = deckTOf(u0);
      vec2 T0 = deckTan(t0);
      vec2 d = L.p.xy / s - DECK_SHIFT - deckBez(t0);
      float j = dot(d, T0);
      float g = (T0.x * d.y - T0.y * d.x) / (DECK_SIGMA * deckTaper(u0));
      float u1 = fract(u0 + DECK_FLOW * t);
      float t1 = deckTOf(u1);
      vec2 T1 = deckTan(t1);
      vec2 q = deckBez(t1) + T1 * j + vec2(-T1.y, T1.x) * (g * DECK_SIGMA * deckTaper(u1));
      L.p.xy = (q + DECK_SHIFT) * s;
      L.alpha *= deckCore(u1) / deckCore(u0) * deckFade(u1);
      L.ramp += deckRamp(u1) - meta.r;
    }
    float soft = step(gSeed.y, DECK_SOFT_SHARE);
    L.size *= mix(1.0, DECK_SOFT_SIZE, soft);
    L.alpha *= mix(1.0, DECK_SOFT_ALPHA, soft);
    L.soft = soft;
    L.bright *= charge;
  } else if (role == R_BLINK) {
    L.alpha *= mix(DECK_BLINK_LO, 1.0, deckCaret(t));
    L.bright *= charge;
  } else if (role == R_SPARK) {
    if (groupOf(meta) == 1) {
      L.alpha *= mix(DECK_BLINK_LO, 1.0, deckCaret(t));
    } else {
      float s = -L.p.z / DECK_ZK;
      vec2 head = (deckBez(deckTOf(DECK_HEAD_U)) + DECK_SHIFT) * s;
      float flick = 0.7 + 0.3 * sin(TAU * (2.3 * t * (0.6 + gSeed.y) + gSeed.x * 5.0));
      if (gSeed.w > 0.5) {
        vec2 d = L.p.xy - head;
        float r = length(d);
        vec2 dir = r > 1e-6 ? d / r : vec2(0.0, 1.0);
        float life = fract(DECK_SPARK_RATE * (0.7 + 0.6 * gSeed.y) * t + gSeed.z * 7.13);
        L.p.xy += (dir + vec2(-0.3, 0.55)) * (DECK_SPRAY * s * life);
        L.alpha *= (1.0 - life) * (1.0 - life) * (0.6 + 0.8 * flick);
        L.size *= 1.0 - 0.35 * life;
      } else {
        L.alpha *= flick;
      }
    }
    L.bright *= charge;
  } else if (role == R_EDGE) {
    // Card outlines: under the C3 curtain (the anchor ×1.6 at α ×.35) their
    // hairlines would vanish around the open card; thicken and lift them.
    L.size *= 1.0 + DECK_CURTAIN_SIZE * uDisperse;
    L.alpha *= 1.0 + DECK_CURTAIN_ALPHA * uDisperse;
    L.bright *= charge;
  } else if (role != R_HALO) {
    L.bright *= charge;
  }
}
