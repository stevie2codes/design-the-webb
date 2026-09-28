// noise.glsl — 3D simplex noise with analytic gradient, curl noise, the Low
// tier's sin flow, and a cheap hash (SPEC §3.6, §3.7).
// Simplex: Ashima Arts / Stefan Gustavson, "webgl-noise" (MIT), gradient
// variant. Spliced into field.vert.glsl by material.ts (see `// @include`).

vec3 n_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 n_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 n_permute(vec4 x) { return n_mod289(((x * 34.0) + 10.0) * x); }
vec4 n_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Simplex noise in [-1, 1]; `g` receives its gradient.
float snoiseGrad(vec3 v, out vec3 g) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 gg = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - gg;
  vec3 i1 = min(gg.xyz, l.zxy);
  vec3 i2 = max(gg.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = n_mod289(i);
  vec4 p = n_permute(n_permute(n_permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = n_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec4 temp = m2 * m * pdotx;
  g = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  g += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
  g *= 105.0;
  return 105.0 * dot(m4, pdotx);
}

// Divergence-free curl of three decorrelated simplex fields. Magnitude is
// normalised to ≈ 1 (CURL_GAIN) so callers scale by an amplitude in su.
#define CURL_GAIN 0.28
vec3 curl(vec3 p) {
  vec3 g1;
  vec3 g2;
  vec3 g3;
  snoiseGrad(p, g1);
  snoiseGrad(p + vec3(31.416, -47.853, 12.793), g2);
  snoiseGrad(p + vec3(-233.145, -113.408, -185.31), g3);
  return vec3(g3.y - g2.z, g1.z - g3.x, g2.x - g1.y) * CURL_GAIN;
}

// Low tier idle drift (§3.7): a 2-octave sin flow, same amplitude, cheaper.
vec3 sinFlow(vec3 p) {
  return vec3(
    sin(p.y * 1.7 + p.z * 0.9) + 0.5 * sin(p.z * 3.1 - p.x * 1.3),
    sin(p.z * 1.5 + p.x * 1.1) + 0.5 * sin(p.x * 2.9 + p.y * 1.7),
    sin(p.x * 1.3 - p.y * 1.9) + 0.5 * sin(p.y * 3.3 + p.z * 1.1)
  ) * 0.6;
}

// Cheap hash in [0, 1).
float hash11(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
