// live/s08.glsl — S8 STACK live animation (SPEC §3.10 S8, §5 C4). Spliced
// into live.glsl (after the Live struct, before live()); called as
//   case K_STACK: liveStack(L, meta, off, t); break;
// Generator: states/s08-stack.ts — the constants below mirror its DRAWER,
// Z_FLAT and STACK_S_UNIT. Local su about the stack centre; group = plate
// index 0–3 (top first); meta.b = s / STACK_S_UNIT.
//
// Focus (uGroupW damped on the CPU, uFocusOn): the active plate (w → 1,
// weighted by uFocusOn so neutral w = 1 with focus off never moves) is pulled
// like a drawer: +.06s along its local y (up off the stack) and +.08s along
// its local x. Inactive plates (w → 0) turn p-steel. field.vert.glsl adds the
// rest for K_STACK: α ×mix(.35, 1, w), +.6 CoC for (1 − w), and the 70%
// ember mix of the focused plate. Sparks (the filled tile, the chart markers,
// the cursor tip) smoulder and travel with their plate.
//
// Reduced motion: no time-driven motion (POSTER_TIME 0); the focus still
// shows (it is a state, not an animation).

#define STACK_S_UNIT 1.25
#define STACK_SLIDE 0.08
#define STACK_LIFT 0.06
#define STACK_ZFLAT 0.3
#define STACK_SPARK_REST 0.75
// Integration tuning (CONTRACTS.md): gain .5 → .8, rest dim .3 → .1 — at
// .3 the three resting plates all but vanished (α ×.35 × .7, +1.2 CoC).
#define STACK_ACTIVE_GAIN 0.8
#define STACK_REST_DIM 0.1
// Final review: the resting plates' OUTLINES stay legible (four isometric
// layers, one drawer out): edges ×(1 + 1.3) against the shader's α ×.35, so
// a resting outline sits near .8 of its lit alpha while its fill stays dim.
#define STACK_REST_EDGE 1.3
// The plate's local x and y after 45° about Y and 35.264° about X, depth ×Z_FLAT.
#define STACK_EX vec3(0.7071068, 0.4082483, -0.5773503 * STACK_ZFLAT)
#define STACK_EY vec3(0.0, 0.8164966, 0.5773503 * STACK_ZFLAT)

void liveStack(inout Live L, vec4 meta, vec4 off, float t) {
  float w = groupW(meta);
  float act = w * uFocusOn;
  float rest = (1.0 - w) * uFocusOn;
  float s = meta.b * STACK_S_UNIT;
  // Ease the drawer so it settles softly as the damped weight arrives.
  float pull = act * act * (3.0 - 2.0 * act);
  L.p += (STACK_EX * STACK_SLIDE + STACK_EY * STACK_LIFT) * (s * pull);
  L.ramp += (0.25 - meta.r) * rest;
  // Tuning: the pulled drawer outshines the rest (its 70% ember mix reads
  // darker than bone), and the unfocused plates recede a little further
  // than the shader's α ×.35 (their +1.2 CoC spreads the same light wider).
  L.bright *= 1.0 + STACK_ACTIVE_GAIN * pull;
  if (roleOf(meta) == R_EDGE) L.alpha *= 1.0 + STACK_REST_EDGE * rest;
  else L.alpha *= 1.0 - STACK_REST_DIM * rest;
  if (roleOf(meta) == R_SPARK) {
    // Dense ember clusters would still glare at α ×.35: an unfocused plate's
    // sparks fade further, so only the pulled drawer burns.
    L.alpha *= (0.78 + 0.22 * sin(TAU * (0.35 + 0.6 * gSeed.y) * t + TAU * gSeed.x)) * (1.0 - STACK_SPARK_REST * rest);
    L.bright *= 1.0 + 0.35 * pull;
  }
}
