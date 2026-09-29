// live/s02.glsl — S2 CHART live animation (SPEC §3.10 S2). Spliced into
// live.glsl (after the Live struct, before live()); called as
//   case K_CHART: liveChart(L, meta, off, t); break;
// Local positions (su about the chart frame's centre; the frame IS the S2
// anchor box, so y = (years / 7 − .5)·H). Generator: states/s02-chart.ts.
//
// - Bars (fill / edge) and the axis never move: heights are data.
// - "+" fizz (role FLOW, g1 over 4+, g3 over 6+): each grain rises through
//   its half-year band, y = base + fract(u0 + .12t)·band, α·(1 − f)² (with a
//   short fade-in at the bar top, so a grain wrapping to the bottom of the
//   band never pops). u0 is meta.b. The band is recovered from the stored
//   position: the generator writes y = band·(n + u0) with n = 2·from − 7
//   (n = 1 above 4 yrs, n = 5 above 6 yrs), so band = y / (n + u0).
// - The AI point (g4): the core (role SPARK) pulses at .5 Hz, α .8 → 1; the
//   reticle dots (role RING, dot angle / 2π in meta.b) orbit the point at
//   .3 rad/s on a ring of r .028 su.
//
// Reduced motion: t frozen at POSTER_TIME (0): fizz at its generated
// heights, faded; core α .9; reticle at its base angles.

#define CHART_FIZZ_RATE 0.12
#define CHART_FIZZ_FADE_IN 0.08
#define CHART_FIZZ_SWAY 0.0015
#define CHART_RETICLE_R 0.028
#define CHART_RETICLE_SPIN 0.3

void liveChart(inout Live L, vec4 meta, vec4 off, float t) {
  int role = roleOf(meta);
  if (role == R_FLOW) {
    float u0 = meta.b;
    float n = groupOf(meta) == 3 ? 5.0 : 1.0;
    float band = L.p.y / (n + u0);
    float f = fract(u0 + CHART_FIZZ_RATE * t);
    L.p.y += (f - u0) * band;
    L.p.x += CHART_FIZZ_SWAY * sin(TAU * (1.5 * f + gSeed.y));
    L.alpha *= (1.0 - f) * (1.0 - f) * smoothstep(0.0, CHART_FIZZ_FADE_IN, f);
  } else if (role == R_SPARK) {
    L.alpha *= 0.9 + 0.1 * sin(PI * t);
  } else if (role == R_RING) {
    float th = TAU * meta.b;
    vec2 c = L.p.xy - CHART_RETICLE_R * vec2(cos(th), sin(th));
    float a = th + CHART_RETICLE_SPIN * t;
    L.p.xy = c + CHART_RETICLE_R * vec2(cos(a), sin(a));
  }
}
