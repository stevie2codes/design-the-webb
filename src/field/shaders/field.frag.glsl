// field.frag.glsl — point sprite (SPEC §3.8). GLSL ES 3.00; three.js
// prepends #version and precision. Premultiplied additive: the material
// blends ONE, ONE, so the colour is pre-multiplied here.
//   crisp: a tight Gaussian pinpoint (in focus)
//   disc:  a lens disc with a faint rim (bokeh), crossfaded by vBokeh
//   soft:  a wide soft Gaussian (glow), mixed in by vSoft
// The GLOW variant (sparks only, second Points) is a soft wide halo.

in vec3 vColor;
in float vAlpha;
in float vBokeh;
in float vSoft;
in float vSeed;
uniform float uSketch;

layout(location = 0) out highp vec4 fragColor;

void main() {
  float d = 2.0 * length(gl_PointCoord - 0.5);
  if (d > 1.0) discard;
#ifdef GLOW
  float a = exp(-d * d * 4.0) * vAlpha;
#else
  float a;
  if (uSketch > 0.5) {
    // Sketch theme (normal blending over paper): an in-focus grain is a
    // short pencil tick at its own angle (a dot when tiny); a defocused one
    // a charcoal smudge with a wobbly edge; the printed halo stays soft.
    float ang = vSeed * 18.8496;
    vec2 p = gl_PointCoord - 0.5;
    vec2 q = vec2(cos(ang) * p.x + sin(ang) * p.y, cos(ang) * p.y - sin(ang) * p.x);
    float tick = smoothstep(0.2, 0.08, abs(q.y) + 0.12 * abs(q.x)) * smoothstep(0.5, 0.34, abs(q.x));
    tick = max(tick, exp(-d * d * 9.0) * 0.6);
    float edge = 1.0 + 0.12 * sin(atan(p.y, p.x) * 5.0 + ang * 3.0);
    float smudge = smoothstep(1.0, 0.25, d * edge) * 0.55;
    float halo = exp(-d * d * 3.2);
    a = min(mix(mix(tick, smudge, vBokeh), halo, vSoft) * vAlpha, 0.92);
    fragColor = vec4(vColor * a, a);
    return;
  }
  float crisp = exp(-d * d * 7.0);
  // Lens disc: a soft plateau, a brighter rim (the "soap bubble" edge of real
  // bokeh, tuned up from §3.8's faint rim) and a little centre weight.
  float disc = smoothstep(1.0, 0.86, d) * 0.42 + smoothstep(0.6, 0.9, d) * smoothstep(1.0, 0.9, d) * 0.5
             + exp(-d * d * 4.0) * 0.3;
  float soft = exp(-d * d * 3.2);                     // glow: the printed name's halo
  a = mix(mix(crisp, disc, vBokeh), soft, vSoft) * vAlpha;
#endif
  fragColor = vec4(vColor * a, a);
}
