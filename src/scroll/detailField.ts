/**
 * The project detail route's field placement (SPEC §6 "Project detail",
 * §6 "Page transitions", §9.4 route mode): where the locked emblem pair
 * sits on /work/:slug, frame by frame.
 *
 * `detailAnchorTransform(id, s, out)` is the route-mode branch of
 * scroll/anchors.ts `anchorTransform` for S4–S7 on a detail route (it is
 * called from there). It
 * composes, in order:
 *
 * 1. The detail anchor — (74vw, 40svh) × .8 on desktop, (50vw, 22svh) × .7
 *    on mobile (layout.ts DETAIL_ANCHOR).
 * 2. Scroll parallax: as the page scrolls 0 → 100svh the emblem rises .3 su
 *    (.15·H px: 1 su = H/2 px); it dims to α .25 by 60svh and to .12 by
 *    120svh, so the writeup sits over near-void. `detailFx.restore` (0 → 1 while "Next project" commits)
 *    brings it back to rest, so the next page — which opens at y 0 — starts
 *    exactly where the commit left it.
 *    Reduced motion (§8.2): no parallax; the emblem is registered to the
 *    header and scrolls with it, at full α.
 * 3. MCP App re-stage (S7, no screenshot): over the 100svh aria-hidden
 *    spacer (`[data-detail-stage]`, measured on refresh into
 *    `detailFx.stageTop / stageH`) the constellation moves to the spacer's
 *    centre at × 1.3 and full α, riding in and out with it. Reduced motion:
 *    it is registered to one place or the other (the header or the spacer,
 *    whichever is nearer the viewport centre) and swaps where its α is 0.
 * 4. The home → detail hand-off: the emblem keeps its home transform (card
 *    box, curtain applied) at the route swap and tweens to the result of
 *    1–3 as `handoff.t` runs 0 → 1 (700 ms expo.inOut, driven by the page).
 *    No re-morph: only the anchor moves.
 *
 * Pure and allocation-free (it runs in the render loop, ≤ .3 ms director
 * budget, §8.5): no DOM, no layout reads. The DOM measures happen in
 * chapters/projects/detail.ts at refresh / resize time. SSR-safe. Imports carry `.ts`
 * extensions like scroll/anchors.ts (node's type stripping).
 */
import { DETAIL_ANCHOR, resolveLen } from '../field/layout.ts';
import { StateId } from '../field/states/ids.ts';
import type { FieldStore, Vec4 } from './store.ts';

/** §6 detail tuning. */
export const DETAIL_FIELD = {
  /** Rise over the first 100svh of scroll, in px per px of H (.3 su = .15·H). */
  parallax: 0.15,
  /**
   * α .25 after the first `dimBy` of scroll, then `farTo` by `farBy` (tuned,
   * final review: at 100svh → .25 the emblem stayed bright beside the
   * screenshot figure and the lede, and its ember highlight still read
   * beside the writeup).
   */
  dimTo: 0.25,
  dimBy: 0.6,
  farTo: 0.12,
  farBy: 1.2,
  /** Home → detail anchor tween (§6 step 4), seconds, expo.inOut. */
  handoffS: 0.7,
  /**
   * MCP re-stage weight: 1 while the spacer's centre is within `in`·H of the
   * viewport centre, 0 beyond `out`·H (smoothstep between).
   */
  stage: { in: 0.12, out: 0.62 },
} as const;

/**
 * The home transform at the route swap (viewport px centre, scale, α) and
 * the hand-off progress `t` (1 = none). Written by chapters/projects/route.ts
 * (capture) and chapters/projects/detail.ts (the tween); read here.
 */
export const handoff = { x: 0, y: 0, scale: 1, alpha: 1, t: 1 };

/**
 * Detail-page state the placement needs (written by chapters/projects/detail.ts):
 * - `restore` 0 → 1: the "Next project" commit returns the emblem to rest.
 * - `stageTop` / `stageH`: the MCP spacer's document top and height in px
 *   (−1 when the page has none), measured on refresh / resize.
 */
export const detailFx = { restore: 0, stageTop: -1, stageH: 0 };

const VP = { W: 0, H: 0 };

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/**
 * S4–S7 on a detail route: [x px, y px, scale, α] (see the file header).
 * Writes `out` and returns it.
 */
export function detailAnchorTransform(id: StateId, s: FieldStore, out: Vec4): Vec4 {
  const d = DETAIL_ANCHOR[s.layout];
  VP.W = s.scroll.W;
  VP.H = s.scroll.H;
  const H = VP.H;
  const sy = s.scroll.y;
  const reduced = s.mode === 'reduced';
  const cx = resolveLen(d.cx, VP);
  const cy = resolveLen(d.cy, VP);

  let x = cx;
  let y: number;
  let scale: number = d.scale;
  let alpha: number;
  if (reduced) {
    // Registered to the header: it scrolls with the page, still and at full α.
    y = cy - sy;
    alpha = 1;
  } else {
    const keep = 1 - detailFx.restore;
    const v = H > 0 ? sy / H : 0; // scroll in viewport heights
    const t = clamp01(v) * keep;
    y = cy - DETAIL_FIELD.parallax * H * t;
    const dim = smoothstep(0, DETAIL_FIELD.dimBy, v) * keep;
    const far = smoothstep(DETAIL_FIELD.dimBy, DETAIL_FIELD.farBy, v) * keep;
    alpha = (1 - (1 - DETAIL_FIELD.dimTo) * dim) * (1 - (1 - DETAIL_FIELD.farTo / DETAIL_FIELD.dimTo) * far);
  }

  if (id === StateId.CONSTELLATION && detailFx.stageTop >= 0 && H > 0) {
    const c = detailFx.stageTop - sy + detailFx.stageH / 2; // spacer centre, viewport px
    const k = 1 - smoothstep(DETAIL_FIELD.stage.in, DETAIL_FIELD.stage.out, Math.abs(c - H / 2) / H);
    const mx = VP.W / 2;
    const ms = DETAIL_ANCHOR.mcpScale;
    if (reduced) {
      // One registration or the other, swapped where α passes through 0.
      if (k >= 0.5) {
        x = mx;
        y = c;
        scale = ms;
      }
      alpha = Math.abs(2 * k - 1);
    } else {
      x += (mx - x) * k;
      y += (c - y) * k;
      scale += (ms - scale) * k;
      alpha += (1 - alpha) * k;
    }
  }

  const h = handoff;
  if (h.t < 1) {
    const t = clamp01(h.t);
    x = h.x + (x - h.x) * t;
    y = h.y + (y - h.y) * t;
    scale = h.scale + (scale - h.scale) * t;
    alpha = h.alpha + (alpha - h.alpha) * t;
  }

  out[0] = x;
  out[1] = y;
  out[2] = scale;
  out[3] = alpha;
  return out;
}
