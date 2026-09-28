/**
 * The director (SPEC §4.3, §4.4, §9.4): one function per frame turns the
 * store into a FieldFrame — film position (damped), the pair on screen,
 * entering params, segment-shaped aperture, anchor transforms, text-safe
 * rects, damped fx, pointer, and the hero lock edge.
 *
 * CONTRACT MODULE — see docs/redesign/CONTRACTS.md. Owner: scroll.
 * Called by the engine's renderFrame, once per gsap tick, AFTER Lenis and
 * ScrollTrigger have updated the store (§9.5). Budget ≤ .3 ms: no DOM, no
 * allocation per frame (the returned frame is one reused object).
 * SSR-safe.
 */
import { StateId } from '../field/states/ids.ts';
import { PathId, STATE_PARAMS } from '../field/uniforms.ts';
import { activeSafeRects, anchorTransform, createSafeRectBuffer } from './anchors.ts';
import { CHAPTER_STATE, HOME_ORDER } from './chapters.ts';
import { HERO_P } from './segments.ts';
import type {
  ChapterRecord,
  EnteringParams,
  FieldFrame,
  FieldStore,
  FilmOverride,
  RouteKind,
  Seg,
} from './store.ts';

/** The home film runs F ∈ [0, 9] (S0 → S9). */
export const FILM_MAX = 9;
/** Longest dt a tick integrates (tab switches, long tasks), seconds. */
export const MAX_DT = 0.25;

/** Film damp half-lives (§4.3): F += (F* − F)·(1 − 2^(−dt/h)). */
export const FILM_HALF_LIFE = { normal: 0.12, rewind: 0.06 } as const;

/** Jump cut (§4.4). Seconds. */
export const JUMP_CUT = {
  /** |F* − F| above this… */
  threshold: 1.5,
  /** …for longer than this… */
  sustain: 0.08,
  /** …and not within this long of the previous cut. */
  cooldown: 0.8,
  /** Fade out, snap, fade in. */
  out: 0.25,
  in: 0.4,
} as const;

/** Hero lock Schmitt trigger (§5 C0, §9.5). p thresholds come from HERO_P[layout].p1. */
export const LOCK = {
  /** On: p ≥ p1 && F ≥ fOn (&& F ≤ fMax). */
  fOn: 0.97,
  /** Off: p < p1 − pHysteresis || F < fOff || F > fMax. */
  fOff: 0.9,
  fMax: 1.0,
  pHysteresis: 0.06,
} as const;

/** fx damp durations (≈ 97% settled after this long), seconds (§9.5 step 3, §3.7). */
export const FX_DUR = { groupW: 0.5, focusOn: 0.5, charge: 0.4, disperse: 0.4, mouseAmt: 0.4 } as const;
/** Pointer follow rate per 60 Hz frame, dt-corrected (§3.7). */
export const MOUSE_RATE = 0.14;

// ---------------------------------------------------------------------------
// Pure helpers.

/** Scroll → target film position (§9.4): holds return integers, segments k + t. */
export function filmTarget(y: number, segs: readonly Seg[]): number {
  if (!segs.length || y <= segs[0].y0) return 0;
  for (let k = 0; k < segs.length; k++) {
    if (y < segs[k].y0) return k;
    if (y < segs[k].y1) return k + (y - segs[k].y0) / (segs[k].y1 - segs[k].y0);
  }
  return segs.length;
}

/** Entering params of a state (it is the pair's B side) — §3.9. Shared, read-only. */
export function enteringParams(id: StateId): Readonly<EnteringParams> {
  return STATE_PARAMS[id].enter;
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Segment-shaped aperture (§3.9) for home segment `seg` at mix `m`. */
export function segAperture(seg: number, m: number): number {
  switch (seg) {
    case 0:
      return 0.9 + (0.04 - 0.9) * smoothstep(0, 0.9, m);
    case 1:
      return 0.04 + 0.14 * Math.sin(Math.PI * m);
    case 5:
      return 0.04 + 0.31 * Math.sin(Math.PI * m);
    default:
      return 0.04;
  }
}

/** A home-film override for position F (intro, `?film=` pin). */
export function filmOverride(F: number, snap = false): FilmOverride {
  const c = Math.min(FILM_MAX, Math.max(0, F));
  const a = Math.min(Math.floor(c), FILM_MAX - 1);
  return { a: a as StateId, b: (a + 1) as StateId, m: c - a, snap };
}

/** HUD S/N (§6): 1 − clamp(.75·(aperture − .04)/.86 + .25·turb/.4, 0, 1). */
export function signalToNoise(aperture: number, turb: number): number {
  return 1 - Math.min(1, Math.max(0, (0.75 * (aperture - 0.04)) / 0.86 + (0.25 * turb) / 0.4));
}

/**
 * S/N of a frame: the turbulence term is the entering T weighted so rest
 * noise (F = 0) reads 0.03 and every hold reads 1.00 — T·(1 − m) in seg0,
 * T·sin(πm) elsewhere. The HUD damps it (200 ms) and writes it at ≤ 10 Hz.
 */
export function hudSignal(f: Readonly<FieldFrame>): number {
  const w = f.seg === 0 ? 1 - f.mix : Math.sin(Math.PI * f.mix);
  return signalToNoise(f.aperture, f.turb * w);
}

/**
 * S/N at home film position F without a frame (same weighting as hudSignal).
 * The HUD uses it while no engine is producing frames (no WebGL, fallback,
 * before the field is ready), from the scroll-derived target.
 */
export function hudSignalAt(F: number): number {
  const c = Math.min(FILM_MAX, Math.max(0, F));
  const seg = Math.min(Math.floor(c), FILM_MAX - 1);
  const m = c - seg;
  const w = seg === 0 ? 1 - m : Math.sin(Math.PI * m);
  return signalToNoise(segAperture(seg, m), STATE_PARAMS[(seg + 1) as StateId].enter.turb * w);
}

/** Home film target of the current store (the override, else scroll), without damping. */
export function filmTargetOf(s: FieldStore): number {
  return targetOf(s);
}

// ---------------------------------------------------------------------------
// Texture availability (§9.9).

let ceiling = FILM_MAX;

/**
 * The engine reports the highest k such that S0…Sk are all resident. The
 * target never passes it: the field holds at the last available state and,
 * when textures arrive, glides (≤ 1.5) or jump-cuts forward.
 */
export function setFilmCeiling(k: number): void {
  ceiling = Math.min(FILM_MAX, Math.max(0, Math.floor(k)));
}

function targetOf(s: FieldStore): number {
  const o = s.film.override;
  const F = o ? o.a + o.m : filmTarget(s.scroll.y, s.segments);
  return Math.min(FILM_MAX, ceiling, Math.max(0, F));
}

/** Snap the displayed film to its target now (nav jump cut step 3, jump-cut resync, §4.4, §6). */
export function snapFilm(s: FieldStore): void {
  s.film.target = targetOf(s);
  s.film.shown = s.film.target;
  s.film.farFor = 0;
}

// ---------------------------------------------------------------------------
// The frame.

export function createFieldFrame(): FieldFrame {
  return {
    now: 0,
    dt: 0,
    F: 0,
    target: 0,
    seg: 0,
    a: StateId.STATIC,
    b: StateId.NAME,
    mix: 0,
    settled: true,
    cutting: false,
    ...STATE_PARAMS[StateId.NAME].enter,
    aperture: 0.9,
    offA: [0, 0, 1, 1],
    offB: [0, 0, 1, 1],
    safe: createSafeRectBuffer(),
    groupW: new Float32Array(8).fill(1),
    focusOn: 0,
    disperse: 0,
    charge: 0,
    nova: 0,
    beat: 0,
    sink: 0,
    printed: 0,
    scanX: 0,
    exposure: 1,
    opacity: 1,
    mouse: [0, 0, 0],
    mouseAmt: 0,
    mouseMode: STATE_PARAMS[StateId.STATIC].mouse,
    ripple: [0, 0, -1, 0],
    velocity: 0,
    scrollPx: 0,
    lockEdge: 0,
  };
}

const FRAME = createFieldFrame();

/** The last frame tick() produced (read-only; HUD / debug read it at ≤ 10 Hz). */
export const frame: Readonly<FieldFrame> = FRAME;

// ---------------------------------------------------------------------------
// Route mode (§9.4) and reduced-motion posters (§8.2).

/** Route-mode mix (detail / 404), damped toward override.m. */
let routeMix = 0;

/**
 * Enter a route's film mode (§9.4). Each page calls it on mount (HomePage
 * with 'home', ProjectDetailPage with its emblem pair, NotFoundPage with
 * '404'):
 * - `'home'`: clears the override; the film follows scroll again (then
 *   `snapFilm` after the home scroll restore, the §6 jump-cut resync).
 * - `'detail'`: the pair is locked to `{ a: emblem, b: nextEmblem }` (b
 *   defaults to a) at m = 0. The UI peeks / commits by tweening
 *   `store.film.override.m` (.25 on hover over 600 ms, 1 on commit over
 *   1,100 ms; set `snap: true` while tweening, or leave it off to let the
 *   director damp toward m). Unknown slugs pass `{ a: StateId.STATIC }`.
 * - `'404'`: `{ FLATLINE, FLATLINE, 0 }`; aperture .5 → .04 follows the
 *   damped `fx.charge` (the CTA hover sets `fx.charge = 1`).
 */
export function enterRoute(
  s: FieldStore,
  kind: RouteKind,
  slug = '',
  pair?: { readonly a: StateId; readonly b?: StateId },
): void {
  s.route.kind = kind;
  s.route.slug = slug;
  routeMix = 0;
  if (kind === 'home') {
    s.film.override = null;
    return;
  }
  const a = kind === '404' ? StateId.FLATLINE : (pair?.a ?? StateId.STATIC);
  const b = kind === '404' ? StateId.FLATLINE : (pair?.b ?? a);
  s.film.override = { a, b, m: 0 };
}

/** Reduced motion (§8.2): the crossfade between chapter posters, seconds. */
export const POSTER_FADE = 0.4;

let posterFrom = -1;
let posterTo = -1;
let posterT0 = 0;

/**
 * Reduced motion (§8.2): the home state whose chapter has crossed 50% of the
 * viewport — CHAPTER_STATE, with C3 resolved per panel (S4 + panel index).
 * Flow panels are found from their emblem anchors (each panel holds its
 * anchor at the same offset), a stuck C3 stage from its progress.
 */
export function posterState(s: FieldStore): StateId {
  const mid = s.scroll.y + s.scroll.H / 2;
  let state: number = CHAPTER_STATE.top;
  for (const id of HOME_ORDER) {
    const ch = s.chapters[id];
    if (!ch || ch.top > mid) continue;
    state = id === 'projects' ? StateId.PULSE + projectPanel(s, ch, mid) : CHAPTER_STATE[id];
  }
  return state as StateId;
}

function projectPanel(s: FieldStore, ch: ChapterRecord, mid: number): number {
  if (ch.sticky) return Math.min(3, Math.max(0, Math.floor(ch.progress * 4)));
  const first = s.anchors.get(StateId.PULSE);
  if (!first || first.chapter !== 'projects') return 0;
  const base = first.cy - first.h / 2;
  let k = 0;
  for (let i = 1; i < 4; i++) {
    const rec = s.anchors.get((StateId.PULSE + i) as StateId);
    if (!rec || rec.chapter !== 'projects') break;
    if (ch.top + (rec.cy - rec.h / 2) - base <= mid) k = i;
  }
  return k;
}

const dampK = (dt: number, dur: number): number => 1 - Math.pow(2, (-dt * 5) / dur);
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * One frame (§9.4, §9.5 step 3.1). `dt` and `now` in seconds on the gsap
 * ticker clock. Mutates the director-owned store fields (film.*,
 * flags.printedLock) and returns the reused frame.
 *
 * Paths, in priority order:
 * 1. Route mode — an override on another route, or a non-film pair: the
 *    override pair is shown directly (seg −1).
 * 2. Reduced motion (store.mode 'reduced', no override) — posters: (a, b, mix)
 *    is a CROSSFADE, not a morph (the engine draws A at α·(1 − mix) and B at
 *    α·mix, two draw calls, §8.2); seg −1, S = T = 0, and `settled` is false
 *    only while a 400 ms fade runs (keep ticking until it is true).
 * 3. The home film — override (intro, `?film=` pin with `snap`) or scroll,
 *    with the jump cut and the 120 ms damp (60 ms while rewinding).
 */
export function tick(s: FieldStore, dtIn: number, now: number): FieldFrame {
  const f = FRAME;
  const dt = Math.min(MAX_DT, Math.max(0, dtIn));
  f.now = now;
  f.dt = dt;
  const o = s.film.override;
  const routePair = o !== null && (o.b !== o.a + 1 || s.route.kind !== 'home');
  const posters = !routePair && o === null && s.mode === 'reduced';
  let cutAlpha = 1;

  // fx first (§9.5 step 3, moved ahead of the uniform writes): damped
  // targets (groupW, focusOn, charge, disperse); the rest is copied.
  const fx = s.fx;
  const kG = dampK(dt, FX_DUR.groupW);
  for (let i = 0; i < 8; i++) f.groupW[i] += (fx.groupW[i] - f.groupW[i]) * kG;
  f.focusOn += (fx.focusOn - f.focusOn) * dampK(dt, FX_DUR.focusOn);
  f.charge += (fx.charge - f.charge) * dampK(dt, FX_DUR.charge);
  f.disperse += (fx.disperse - f.disperse) * dampK(dt, FX_DUR.disperse);
  f.nova = fx.nova;
  f.beat = fx.beat;
  f.sink = fx.sink;
  f.printed = fx.printed;
  f.scanX = fx.scanX;
  f.exposure = fx.exposure;
  f.ripple[0] = fx.ripple[0];
  f.ripple[1] = fx.ripple[1];
  f.ripple[2] = fx.ripple[2];
  f.ripple[3] = fx.ripple[3];

  if (!posters) posterTo = -1;

  if (routePair) {
    // 1. Route mode (§9.4): the override pair is shown directly.
    routeMix = o.snap ? o.m : routeMix + (o.m - routeMix) * (1 - Math.pow(2, -dt / FILM_HALF_LIFE.normal));
    s.film.target = o.a + o.m;
    s.film.shown = o.a + routeMix;
    s.film.farFor = 0;
    f.target = s.film.target;
    f.F = s.film.shown;
    f.seg = -1;
    f.a = o.a;
    f.b = o.b;
    f.mix = routeMix;
    f.cutting = false;
    f.settled = Math.abs(o.m - routeMix) < 1e-3;
    if (o.a === StateId.FLATLINE && o.b === StateId.FLATLINE) {
      // 404 (§6): the lost signal sharpens (.5 → .04) as the CTA is hovered.
      f.aperture = 0.5 + (0.04 - 0.5) * f.charge;
    } else {
      const pa = STATE_PARAMS[o.a].aperture;
      f.aperture = pa + (STATE_PARAMS[o.b].aperture - pa) * routeMix;
    }
  } else if (posters) {
    // 2. Reduced motion (§8.2): registered posters, 400 ms crossfades.
    const want = Math.min(posterState(s), Math.max(ceiling, StateId.NAME)) as StateId;
    if (posterTo < 0) {
      posterFrom = posterTo = want;
    } else if (want !== posterTo) {
      // A new fade starts from whichever poster dominates right now.
      if (clamp01((now - posterT0) / POSTER_FADE) >= 0.5) posterFrom = posterTo;
      posterTo = want;
      posterT0 = now;
    }
    let m = posterFrom === posterTo ? 1 : clamp01((now - posterT0) / POSTER_FADE);
    if (m >= 1) {
      posterFrom = posterTo;
      m = 1;
    }
    const a = posterFrom as StateId;
    const b = posterTo as StateId;
    s.film.target = want;
    s.film.shown = a + (b - a) * m;
    s.film.farFor = 0;
    f.target = want;
    f.F = s.film.shown;
    f.seg = -1;
    f.a = a;
    f.b = b;
    f.mix = m;
    f.cutting = false;
    f.settled = m >= 1;
    const pa = STATE_PARAMS[a].aperture;
    f.aperture = pa + (STATE_PARAMS[b].aperture - pa) * m;
  } else {
    // 3. The home film.
    const Fstar = targetOf(s);
    s.film.target = Fstar;
    let cutting = false;

    if (o?.snap) {
      s.film.shown = Fstar;
      s.film.farFor = 0;
    } else {
      // Jump cut (§4.4): |F* − F| > 1.5 for > 80 ms, not rewinding, not in the intro.
      const far =
        !s.flags.rewinding && !s.flags.intro && Math.abs(Fstar - s.film.shown) > JUMP_CUT.threshold;
      s.film.farFor = far ? s.film.farFor + dt : 0;
      if (s.film.farFor > JUMP_CUT.sustain && now - s.film.lastCut > JUMP_CUT.cooldown) {
        s.film.lastCut = now;
        s.film.farFor = 0;
      }
      const tc = now - s.film.lastCut;
      if (tc < JUMP_CUT.out) {
        cutting = true; // fading out: hold the picture
        cutAlpha = 1 - tc / JUMP_CUT.out;
      } else if (tc < JUMP_CUT.out + JUMP_CUT.in) {
        cutting = true; // snapped: fade back in on the target
        s.film.shown = Fstar;
        cutAlpha = (tc - JUMP_CUT.out) / JUMP_CUT.in;
      } else {
        const h = s.flags.rewinding ? FILM_HALF_LIFE.rewind : FILM_HALF_LIFE.normal;
        s.film.shown += (Fstar - s.film.shown) * (1 - Math.pow(2, -dt / h));
      }
    }

    const F = s.film.shown;
    let seg = Math.min(Math.floor(F), FILM_MAX - 1);
    let m = F - seg;
    // Never show a pair whose B texture is missing: F = ceiling is (ceiling − 1, ceiling) at mix 1.
    if (seg + 1 > ceiling && ceiling >= 1) {
      seg = ceiling - 1;
      m = 1;
    }
    f.target = Fstar;
    f.F = F;
    f.seg = seg;
    f.a = seg as StateId;
    f.b = (seg + 1) as StateId;
    f.mix = m;
    f.cutting = cutting;
    f.settled = !cutting && Math.abs(Fstar - F) < 1e-3;
    f.aperture = segAperture(seg, m);
  }

  if (posters) {
    f.stagger = 0;
    f.turb = 0;
    f.path = PathId.DEFAULT;
  } else {
    const enter = STATE_PARAMS[f.b].enter;
    f.stagger = enter.stagger;
    f.turb = enter.turb;
    f.path = enter.path;
  }
  f.opacity = fx.opacity * cutAlpha;

  // Anchors follow their stages; safe rects likewise (§9.6).
  anchorTransform(f.a, s, f.offA, f.disperse);
  anchorTransform(f.b, s, f.offB, f.disperse);
  activeSafeRects(s, f.safe);

  // Pointer (§3.7): fine pointers under full motion only.
  const p = s.pointer;
  const want = p.active && p.fine && s.mode === 'full' ? 1 : 0;
  if (p.active) {
    const km = f.mouseAmt < 1e-3 ? 1 : 1 - Math.pow(1 - MOUSE_RATE, dt * 60);
    f.mouse[0] += (p.x - f.mouse[0]) * km;
    f.mouse[1] += (p.y - f.mouse[1]) * km;
  }
  f.mouseAmt += (want - f.mouseAmt) * dampK(dt, FX_DUR.mouseAmt);
  f.mouseMode = STATE_PARAMS[f.mix < 0.5 ? f.a : f.b].mouse;

  f.velocity = Math.min(1, Math.max(-1, s.scroll.vel / 40));
  f.scrollPx = s.scroll.y;

  // Hero lock (§9.5): Schmitt trigger on hero progress and displayed F. Off
  // in route mode and under reduced motion (no beam: the engine shows the
  // printed poster directly).
  const was = s.flags.printedLock;
  let lock = was;
  if (routePair || posters) lock = false;
  else {
    const pOn = HERO_P[s.layout].p1;
    const p = s.chapters.top?.progress ?? 0;
    if (!was && p >= pOn && f.F >= LOCK.fOn && f.F <= LOCK.fMax) lock = true;
    else if (was && (p < pOn - LOCK.pHysteresis || f.F < LOCK.fOff || f.F > LOCK.fMax)) lock = false;
  }
  s.flags.printedLock = lock;
  f.lockEdge = lock === was ? 0 : lock ? 1 : -1;

  return f;
}
