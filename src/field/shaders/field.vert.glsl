// field.vert.glsl — the point field (SPEC §3.6). GLSL ES 3.00.
// three.js (ShaderMaterial, glslVersion GLSL3) prepends #version 300 es,
// precision, the built-in uniforms (projectionMatrix, modelViewMatrix) and
// `in vec3 position`. material.ts splices noise.glsl and live.glsl in at the
// `// @include` markers and adds the tier defines (GLOW, IDLE_SIN).
//
// Per particle: texelFetch the pair (A, B) → per-particle progress from the
// ENTERING key → each endpoint's live() + anchor transform → path → curl
// turbulence → idle drift → scroll inertia → pointer / ripple → DOF, size,
// alpha, colour ramp, group focus → text-safe mask on the final screen px.

#define PI 3.141592653589793
#define TAU 6.283185307179586
#define CAM_Z 3.732

// Roles (uniforms.ts Role; meta.a = role << 4 | group).
#define R_FILL 0
#define R_EDGE 1
#define R_SPARK 2
#define R_DUST 3
#define R_HALO 4
#define R_FLOW 5
#define R_GHOST 6
#define R_BLINK 7
#define R_RING 8
#define R_PACKET 9

// State kinds (states/ids.ts StateId).
#define K_STATIC 0
#define K_NAME 1
#define K_CHART 2
#define K_REDACTED 3
#define K_PULSE 4
#define K_LATTICE 5
#define K_DECK 6
#define K_CONSTELLATION 7
#define K_STACK 8
#define K_BEACON 9
#define K_FLATLINE 10

// Paths (uniforms.ts PathId).
#define P_DEFAULT 0
#define P_POUR 1
#define P_TOPPLE 2
#define P_DIGITIZE 3
#define P_DEAL 4
#define P_SPIRAL 5

// Pointer (uniforms.ts MouseMode, §3.7).
#define M_LOUPE 0
#define M_PUSH 1
#define M_ATTRACT 2
#define MOUSE_R 0.24
// Loupe (tuned, CONTRACTS.md): the inner LOUPE_CORE of MOUSE_R is fully in
// focus with a soft edge — a (1 − d/r)² pull left only ~5–11 px sharp,
// under the 24 px cursor ring.
#define LOUPE_CORE 0.35

// Text-safe mask (§2.3; tuned, CONTRACTS.md): ×.22 with a smootherstep
// feather, then an ABSOLUTE ceiling — after FIELD_GAIN the relative ×.22
// alone still let one crisp grain reach ~.4 α behind text.
#define SAFE_FEATHER 56.0
#define SAFE_ALPHA_MUL 0.5
#define SAFE_ALPHA_MAX 0.06
#define RIPPLE_PX 240.0
#define RIPPLE_S 0.6
#define GLOW_SIZE 5.0
#define GLOW_ALPHA 0.07
// Tuning (docs/redesign/CONTRACTS.md "Tuning notes"). Bokeh-eligible points
// get their own cap between BOKEH_SPREAD.x and .y × uBokehCap (mean ≈ 1), so
// the defocused volume shows discs of many sizes instead of one; light
// falls off with the drawn growth ^ BOKEH_FALLOFF (§3.6 says 1.6: too dark
// once discs are capped).
#define BOKEH_SPREAD vec2(0.5, 1.5)
#define BOKEH_FALLOFF 1.3

in vec4 aSeed; // x size, y twinkle rate, z scroll inertia, w bokeh eligibility (< .35)

uniform highp sampler2D uPosA;
uniform highp sampler2D uPosB;
uniform highp sampler2D uMetaA;
uniform highp sampler2D uMetaB;
uniform int uTexW;
uniform int uKindA;
uniform int uKindB;
uniform vec4 uOffA; // xy anchor centre (su), z scale, w alpha
uniform vec4 uOffB;
uniform float uMix;
uniform float uStagger;
uniform float uTurb;
uniform int uPath;
uniform float uTime;
uniform float uTimeA; // live() clock per endpoint (poster time under reduced motion)
uniform float uTimeB;
uniform float uMotion; // 1 full motion, 0 reduced (drift, twinkle, inertia, pointer off)
uniform float uAperture;
uniform float uFocusZ;
uniform float uBokehCap;
uniform float uDpr;
uniform float uSizeMin;
uniform float uSizeMax;
uniform float uDensityA;
uniform float uDensityB;
uniform vec3 uIdleA; // amp, freq, speed
uniform vec3 uIdleB;
uniform vec3 uMouse;
uniform float uMouseAmt;
uniform int uMouseMode;
uniform vec4 uRipple; // x, y (su), t0 (s), amp
uniform float uScrollPx;
uniform float uVelocity;
uniform vec4 uSafe[6]; // viewport CSS px: x0, y0, x1, y1
uniform int uSafeCount;
uniform float uGroupW[8];
uniform float uFocusOn;
uniform float uDisperse;
uniform float uCharge;
uniform float uNova;
uniform float uBeat;
uniform float uScanX;
uniform float uPrinted;
uniform vec2 uBarPivot[3];
uniform float uOpacity;
uniform float uExposure;
uniform vec3 uPalette[5];
uniform float uAspect;
uniform vec2 uViewport; // canvas CSS px
uniform float uPxSu;    // su per CSS px (2 / canvas height)

out vec3 vColor;
out float vAlpha;
out float vBokeh;
out float vSoft; // 1 = soft glow profile (the printed name's halo)

vec4 gSeed; // aSeed, visible to live()

int roleOf(vec4 m) { return int(m.a * 255.0 + 0.5) >> 4; }
int groupOf(vec4 m) { return int(m.a * 255.0 + 0.5) & 15; }
float groupW(vec4 m) { return uGroupW[min(groupOf(m), 7)]; }

// @include noise
// @include live

float cubicInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5; }
float sineInOut(float t) { return 0.5 - 0.5 * cos(PI * t); }
float quadIn(float t) { return t * t; }

// cubicInOut unless the path says otherwise (POUR eases x and y itself).
float easeFor(int path, float t) {
  return path >= 0 ? cubicInOut(t) : t;
}

vec3 ramp(float x) {
  float s = clamp(x, 0.0, 1.0) * 4.0;
  int i = int(min(s, 3.0));
  return mix(uPalette[i], uPalette[i + 1], s - float(i));
}

// §3.6 path table. pa / pb are world (anchored) positions.
vec3 pathMix(int path, vec3 pa, vec3 pb, float e, float tl, vec4 mA) {
  if (path == P_POUR) {
    // Grains fall column by column: x sineInOut, y quadIn (gravity), then a
    // damped 6px landing bounce over tl ∈ [.88, 1].
    vec3 p = vec3(mix(pa.x, pb.x, sineInOut(tl)), mix(pa.y, pb.y, quadIn(tl)), mix(pa.z, pb.z, e));
    if (tl > 0.88) {
      float s = (tl - 0.88) / 0.12;
      p.y += 0.013 * sin(TAU * s) * (1.0 - s);
    }
    return p;
  }
  if (path == P_TOPPLE) {
    // Quadratic Bézier pa → c → pb with c = pivot + R(−60°)(pa − pivot): the
    // bars fall to the right like dominoes. Pivots are S2-local (A side).
    int g = groupOf(mA);
    vec2 pv = uBarPivot[g <= 1 ? g : 2] * uOffA.z + uOffA.xy;
    vec2 d = pa.xy - pv;
    vec3 c = vec3(pv + vec2(0.5 * d.x + 0.8660254 * d.y, -0.8660254 * d.x + 0.5 * d.y), mix(pa.z, pb.z, 0.5));
    float u = 1.0 - e;
    return u * u * pa + 2.0 * u * e * c + e * e * pb;
  }
  vec3 p = mix(pa, pb, e);
  if (path == P_DIGITIZE) {
    // 60% quantised to a .05 su grid for .3 < e < .7 (soft window edges).
    float w = 0.6 * smoothstep(0.3, 0.36, e) * (1.0 - smoothstep(0.64, 0.7, e));
    p = mix(p, floor(p / 0.05 + 0.5) * 0.05, w);
  } else if (path == P_DEAL) {
    p.z += 0.7 * sin(PI * e); // cards deal through the lens
  } else if (path == P_SPIRAL) {
    // Polar lerp about the beacon centre with one extra turn: the radius
    // lerps while the in-flight offset winds in, landing exactly on pb.
    vec2 c = uOffB.xy;
    vec2 da = pa.xy - c;
    vec2 db = pb.xy - c;
    float aa = atan(da.y, da.x);
    float dth = atan(db.y, db.x) - aa;
    dth -= TAU * floor((dth + PI) / TAU);
    float th = aa + (dth + TAU) * e;
    p.xy = c + mix(length(da), length(db), e) * vec2(cos(th), sin(th));
  }
  return p;
}

void main() {
  int i = int(position.x + 0.5);
  ivec2 tc = ivec2(i % uTexW, i / uTexW);
  vec4 A = texelFetch(uPosA, tc, 0);
  vec4 B = texelFetch(uPosB, tc, 0);
  vec4 mA = texelFetch(uMetaA, tc, 0);
  vec4 mB = texelFetch(uMetaB, tc, 0);
  gSeed = aSeed;
  bool dust = roleOf(mB) == R_DUST;

  // 1. Per-particle progress; the key comes from the ENTERING state, so
  //    reverse scroll is an exact mirror.
  float tl = clamp((uMix - B.w * uStagger) / max(1.0 - uStagger, 1e-4), 0.0, 1.0);
  float e = easeFor(uPath, tl);

  // 2. Each endpoint runs its live animation, then its anchor transform.
  Live la = live(uKindA, A.xyz, mA, uOffA, uTimeA);
  Live lb = live(uKindB, B.xyz, mB, uOffB, uTimeB);
  vec3 pa = la.p * uOffA.z + vec3(uOffA.xy, 0.0);
  vec3 pb = lb.p * uOffB.z + vec3(uOffB.xy, 0.0);

  // 3. Path + turbulence. Dust is world-space and never morphs; it drifts
  //    at 15% of content speed with scroll, wrapped modulo 2.8.
  vec3 p;
  vec3 pl; // noise coordinate (moves rigidly with the shape)
  float settle;
  if (dust) {
    p = vec3(A.x, mod(A.y + uScrollPx * uPxSu * 0.15 + 1.4, 2.8) - 1.4, A.z);
    pl = A.xyz;
    settle = 1.0;
  } else {
    p = pathMix(uPath, pa, pb, e, tl, mA);
    float tw = uTurb * sin(PI * tl);
    if (tw > 1e-4) p += curl(p * 1.6 + aSeed.xyz * 17.0) * tw;
    pl = mix(A.xyz, B.xyz, e);
    settle = 1.0 - sin(PI * tl);
  }

  // Idle drift: per-state amp / freq / speed mixed by e (§3.7).
  vec3 idle = mix(uIdleA, uIdleB, e);
  if (uMotion > 0.0 && idle.x > 0.0) {
    vec3 q = pl * idle.y + vec3(0.0, 0.0, uTime * idle.z);
#ifdef IDLE_SIN
    p += sinFlow(q * 1.3 + vec3(uTime * idle.z * 4.0, 0.0, 0.0)) * idle.x * uMotion;
#else
    p += curl(q) * idle.x * uMotion;
#endif
  }

  // Scroll inertia (the field has mass) and the settled velocity shiver.
  p.y -= uVelocity * 0.018 * aSeed.z * uMotion;
  float shiver = 0.01 * abs(uVelocity) * settle * uMotion;
  if (shiver > 1e-5) {
    p += (vec3(hash11(aSeed.x * 91.7 + uTime * 61.0), hash11(aSeed.y * 57.3 + uTime * 47.0),
               hash11(aSeed.z * 23.1 + uTime * 71.0)) * 2.0 - 1.0) * shiver;
  }

  // Pointer (§3.7), measured on the z = 0 projection so effects stay under
  // the cursor at any depth.
  float bright = mix(la.bright, lb.bright, e);
  float loupe = 0.0; // 1 = racked into focus by the loupe
  if (uMouseAmt > 0.001) {
    float persp0 = CAM_Z / (CAM_Z - p.z);
    vec2 sp = p.xy * persp0;
    vec2 d = sp - uMouse.xy;
    float dist = length(d);
    if (dist < MOUSE_R) {
      if (uMouseMode == M_LOUPE) {
        // A lens of sharpness: pull onto the focal plane, keeping the screen
        // position, and (below) drive the circle of confusion to 1.
        loupe = uMouseAmt * (1.0 - smoothstep(LOUPE_CORE * MOUSE_R, MOUSE_R, dist));
        float nz = mix(p.z, uFocusZ, 0.95 * loupe);
        p = vec3(sp * (CAM_Z - nz) / CAM_Z, nz);
        bright *= 1.0 + 0.3 * loupe;
      } else {
        float fall = 1.0 - dist / MOUSE_R;
        fall *= fall * uMouseAmt;
        vec2 dir = dist > 1e-5 ? d / dist : vec2(0.0);
        if (uMouseMode == M_PUSH) p.xy += dir * (0.05 * fall / persp0);
        else p.xy -= dir * (min(0.08 * fall, dist) / persp0);
        bright *= 1.0 + 0.3 * fall;
      }
    }
  }
  if (uRipple.z >= 0.0 && uMotion > 0.0) {
    float tau = (uTime - uRipple.z) / RIPPLE_S;
    if (tau >= 0.0 && tau < 1.0) {
      float persp1 = CAM_Z / (CAM_Z - p.z);
      vec2 d = p.xy * persp1 - uRipple.xy;
      float dist = length(d);
      float k = (1.0 - smoothstep(0.0, 0.02, abs(dist - tau * RIPPLE_PX * uPxSu))) * (1.0 - tau) * (1.0 - tau) * uRipple.w;
      p.xy += (dist > 1e-5 ? d / dist : vec2(0.0)) * (0.03 * k / persp1);
      bright *= 1.0 + 0.4 * k;
    }
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float persp = CAM_Z / (CAM_Z - p.z);

  // Group focus (uGroupW, damped on the CPU; 1 = neutral). S8's unfocused
  // plates also rack out of focus (+1.2 CoC).
  float wA = groupW(mA);
  float wB = groupW(mB);
  float w = mix(wA, wB, e);
  float stackA = uKindA == K_STACK ? 1.0 : 0.0;
  float stackB = uKindB == K_STACK ? 1.0 : 0.0;

  // Depth of field and size.
#ifdef GLOW
  float dof = 1.0;
#else
  float gBlur = mix(stackA * 1.2 * (1.0 - wA), stackB * 1.2 * (1.0 - wB), e);
  float dof = 1.0 + uAperture * min(abs(p.z - uFocusZ), 3.0) * 4.5 + gBlur;
  dof = mix(dof, 1.0, loupe);
#endif
  float baseSize = mix(uSizeMin, uSizeMax, aSeed.x * aSeed.x) * persp * mix(la.size, lb.size, e);
#ifdef GLOW
  gl_PointSize = baseSize * GLOW_SIZE * uDpr;
  float alpha = GLOW_ALPHA * mix(mA.g * la.alpha, mB.g * lb.alpha, e);
#else
  float cap = aSeed.w < 0.35 ? uBokehCap * mix(BOKEH_SPREAD.x, BOKEH_SPREAD.y, aSeed.w / 0.35) : 6.0;
  float drawn = min(baseSize * dof, max(cap, baseSize));
  gl_PointSize = drawn * uDpr;
  // §3.6 divides α by dof^1.6; a capped point stops growing but would keep
  // dimming, so the falloff uses the growth actually drawn (light is
  // conserved once the bokeh cap binds).
  float grow = max(1.0, drawn / max(baseSize, 1e-3));
  float alpha = mix(mA.g * la.alpha, mB.g * lb.alpha, e) * mix(uDensityA, uDensityB, e) / pow(grow, BOKEH_FALLOFF);
#endif
  alpha *= FIELD_GAIN * uOpacity * uExposure * mix(uOffA.w, uOffB.w, e);
  // Twinkle in settled states.
  alpha *= 1.0 + 0.15 * sin(uTime * (0.5 + 2.0 * aSeed.y) + TAU * aSeed.y) * settle * uMotion;
  alpha *= mix(0.35, 1.0, w);

  // Colour ramp; S8's focused plate mixes 70% toward ember.
  float rampPos = clamp(mix(mA.r, mB.r, e) + mix(la.ramp, lb.ramp, e), 0.0, 1.0);
  rampPos = mix(rampPos, 0.75, 0.7 * smoothstep(0.7, 1.0, w) * uFocusOn * mix(stackA, stackB, e));

  // Text-safe mask (§2.3, §3.6) on the final screen position: particles
  // inside a [data-safe] block (smootherstep feather) get α ×.22, no ember,
  // no extra brightness (beam, loupe) and, whatever the gain, at most
  // SAFE_ALPHA_MAX — so the field behind text stays at or below #262A34.
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 px = vec2((ndc.x * 0.5 + 0.5) * uViewport.x, (0.5 - ndc.y * 0.5) * uViewport.y);
  float insideMax = 0.0;
  for (int k = 0; k < 6; k++) {
    if (k >= uSafeCount) break;
    vec4 r = uSafe[k];
    vec2 d = max(r.xy - px, px - r.zw);
    float x = clamp(1.0 - max(d.x, d.y) / SAFE_FEATHER, 0.0, 1.0);
    float inside = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    alpha *= mix(1.0, SAFE_ALPHA_MUL, inside);
    rampPos = mix(rampPos, min(rampPos, 0.5), inside);
    insideMax = max(insideMax, inside);
  }
  alpha = mix(alpha, min(alpha, SAFE_ALPHA_MAX), insideMax);
  bright = mix(bright, min(bright, 1.0), insideMax);

  vColor = ramp(rampPos) * bright;
  vAlpha = alpha;
  vBokeh = smoothstep(2.0, 3.5, dof);
  vSoft = mix(la.soft, lb.soft, e);
  // Invisible points never reach the rasteriser.
  if (alpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
