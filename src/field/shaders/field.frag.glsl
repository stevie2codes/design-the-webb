// field.frag.glsl — point sprite (SPEC §3.8). GLSL ES 3.00; three.js
// prepends #version and precision. Premultiplied additive: the material
// blends ONE, ONE, so the colour is pre-multiplied here.
//   crisp: a tight Gaussian pinpoint (in focus)
//   disc:  a lens disc with a faint rim (bokeh), crossfaded by vBokeh
// The GLOW variant (sparks only, second Points) is a soft wide halo.

in vec3 vColor;
in float vAlpha;
in float vBokeh;

layout(location = 0) out highp vec4 fragColor;

void main() {
  float d = 2.0 * length(gl_PointCoord - 0.5);
  if (d > 1.0) discard;
#ifdef GLOW
  float a = exp(-d * d * 4.0) * vAlpha;
#else
  float crisp = exp(-d * d * 7.0);
  float disc = smoothstep(1.0, 0.86, d) * 0.55 + exp(-d * d * 4.0) * 0.45;
  float a = mix(crisp, disc, vBokeh) * vAlpha;
#endif
  fragColor = vec4(vColor * a, a);
}
